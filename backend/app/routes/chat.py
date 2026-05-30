import uuid
import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload

from app.database import get_db, AsyncSessionLocal
from app import models, schemas
from app.auth import get_current_user
from app.ai_service import get_ai_response, stream_ai_response, generate_chat_title
from app.rate_limiter import rate_limit

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chats", tags=["chats"])


# ─── List all chats ───────────────────────────────────────────────────────────

@router.get("", response_model=list[schemas.ChatResponse])
async def list_chats(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # Get chats with message count and last message
    result = await db.execute(
        select(models.Chat)
        .where(models.Chat.user_id == current_user.id)
        .options(selectinload(models.Chat.messages))
        .order_by(desc(models.Chat.updated_at))
        .limit(limit)
        .offset(offset)
    )
    chats = result.scalars().all()

    response = []
    for chat in chats:
        last_msg = chat.messages[-1].content[:100] if chat.messages else None
        response.append(
            schemas.ChatResponse(
                id=chat.id,
                title=chat.title,
                created_at=chat.created_at,
                updated_at=chat.updated_at,
                message_count=len(chat.messages),
                last_message=last_msg,
            )
        )
    return response


# ─── Get single chat with messages ───────────────────────────────────────────

@router.get("/{chat_id}", response_model=schemas.ChatDetailResponse)
async def get_chat(
    chat_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    result = await db.execute(
        select(models.Chat)
        .where(models.Chat.id == chat_id, models.Chat.user_id == current_user.id)
        .options(selectinload(models.Chat.messages))
    )
    chat = result.scalar_one_or_none()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    return chat


# ─── Send message (non-streaming) ────────────────────────────────────────────

@router.post("/message", response_model=schemas.SendMessageResponse, dependencies=[Depends(rate_limit(20, 60))])
async def send_message(
    payload: schemas.SendMessageRequest,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # Create or fetch chat
    if payload.chat_id:
        result = await db.execute(
            select(models.Chat)
            .where(models.Chat.id == payload.chat_id, models.Chat.user_id == current_user.id)
            .options(selectinload(models.Chat.messages))
        )
        chat = result.scalar_one_or_none()
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
    else:
        fallback_title = " ".join(payload.content.split()[:5]) + ("…" if len(payload.content.split()) > 5 else "")
        chat = models.Chat(
            user_id=current_user.id,
            title=fallback_title[:50],
        )
        db.add(chat)
        await db.flush()
        await db.refresh(chat)

    # Save user message
    user_msg = models.Message(
        chat_id=chat.id,
        role="user",
        content=payload.content,
    )
    db.add(user_msg)
    await db.flush()

    # Build conversation history for AI
    if payload.chat_id:
        history = [
            {"role": msg.role, "content": msg.content}
            for msg in chat.messages
        ]
    else:
        history = []
    history.append({"role": "user", "content": payload.content})
    
    is_new_chat = len(chat.messages) == 0 and not payload.chat_id
    if is_new_chat:
        logger.info("New chat created. ChatID=%s UserID=%s", chat.id, current_user.id)
    
    # Commit to release DB lock before slow AI calls
    await db.commit()

    # Get AI response
    try:
        ai_content = await get_ai_response(history, chat_id=str(chat.id), user_id=current_user.id)
    except Exception as e:
        logger.error("AI service error in send_message: %s", e)
        raise HTTPException(status_code=502, detail=f"AI service error: {str(e)}")
        
    new_title = None
    if is_new_chat:
        try:
            logger.info("Generating chat title for ChatID=%s", chat.id)
            new_title = await generate_chat_title(payload.content)
            logger.info("Generated title for ChatID=%s: '%s'", chat.id, new_title)
        except Exception as e:
            logger.warning("Failed to generate chat title for ChatID=%s: %s", chat.id, e)
            pass

    # Save AI message
    ai_msg = models.Message(
        chat_id=chat.id,
        role="assistant",
        content=ai_content,
    )
    db.add(ai_msg)

    # Update chat title if this is the first message
    if is_new_chat and new_title:
        chat.title = new_title

    await db.commit()
    await db.refresh(user_msg)
    await db.refresh(ai_msg)
    await db.refresh(chat)

    return schemas.SendMessageResponse(
        chat_id=chat.id,
        chat_title=chat.title,
        user_message=schemas.MessageResponse.model_validate(user_msg),
        assistant_message=schemas.MessageResponse.model_validate(ai_msg),
    )


# ─── Stream message ───────────────────────────────────────────────────────────

@router.post("/message/stream", dependencies=[Depends(rate_limit(20, 60))])
async def stream_message(
    payload: schemas.SendMessageRequest,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Stream AI response using Server-Sent Events."""
    # Create or fetch chat
    if payload.chat_id:
        result = await db.execute(
            select(models.Chat)
            .where(models.Chat.id == payload.chat_id, models.Chat.user_id == current_user.id)
            .options(selectinload(models.Chat.messages))
        )
        chat = result.scalar_one_or_none()
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
    else:
        fallback_title = " ".join(payload.content.split()[:5]) + ("…" if len(payload.content.split()) > 5 else "")
        chat = models.Chat(
            user_id=current_user.id,
            title=fallback_title[:50],
        )
        db.add(chat)
        await db.flush()
        await db.refresh(chat)

    # Save user message
    user_msg = models.Message(
        chat_id=chat.id,
        role="user",
        content=payload.content,
    )
    db.add(user_msg)
    await db.flush()
    await db.refresh(user_msg)
    
    # We must construct these strings/variables before returning the generator
    # because the `db` session will be closed once this function returns
    if payload.chat_id:
        history = [
            {"role": msg.role, "content": msg.content}
            for msg in chat.messages
        ]
    else:
        history = []
    history.append({"role": "user", "content": payload.content})
    
    # Extract needed attributes to avoid accessing the model objects later
    chat_id_str = str(chat.id)
    chat_title_str = chat.title
    user_msg_id_str = str(user_msg.id)
    
    await db.commit() # Commit the user message before returning

    async def event_generator():
        # Send chat info first
        yield f"data: {json.dumps({'type': 'chat_info', 'chat_id': chat_id_str, 'chat_title': chat_title_str, 'user_message_id': user_msg_id_str})}\n\n"

        full_response = []
        try:
            async for chunk in stream_ai_response(history, chat_id=chat_id_str, user_id=current_user.id):
                full_response.append(chunk)
                yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
            return

        # Generate AI title if this was a new chat (Do this BEFORE opening DB session to avoid lock)
        new_title = None
        if not payload.chat_id:
            try:
                new_title = await generate_chat_title(payload.content)
            except Exception:
                pass

        # Save complete AI message using a fresh session
        ai_content = "".join(full_response)
        async with AsyncSessionLocal() as session:
            ai_msg = models.Message(
                chat_id=chat_id_str,
                role="assistant",
                content=ai_content,
            )
            session.add(ai_msg)
            
            if new_title:
                db_chat = await session.get(models.Chat, chat_id_str)
                if db_chat:
                    db_chat.title = new_title

            await session.commit()
            await session.refresh(ai_msg)
            ai_msg_id_str = str(ai_msg.id)

        if new_title:
            yield f"data: {json.dumps({'type': 'title_update', 'title': new_title})}\n\n"

        yield f"data: {json.dumps({'type': 'done', 'message_id': ai_msg_id_str})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ─── Delete chat ──────────────────────────────────────────────────────────────

@router.delete("/{chat_id}", status_code=204)
async def delete_chat(
    chat_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    result = await db.execute(
        select(models.Chat).where(
            models.Chat.id == chat_id, models.Chat.user_id == current_user.id
        )
    )
    chat = result.scalar_one_or_none()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    await db.delete(chat)


# ─── Update chat title ────────────────────────────────────────────────────────

@router.patch("/{chat_id}", response_model=schemas.ChatResponse)
async def update_chat_title(
    chat_id: str,
    payload: schemas.ChatCreate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    result = await db.execute(
        select(models.Chat).where(
            models.Chat.id == chat_id, models.Chat.user_id == current_user.id
        ).options(selectinload(models.Chat.messages))
    )
    chat = result.scalar_one_or_none()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    chat.title = payload.title
    await db.flush()
    await db.refresh(chat)
    return schemas.ChatResponse(
        id=chat.id,
        title=chat.title,
        created_at=chat.created_at,
        updated_at=chat.updated_at,
        message_count=len(chat.messages),
    )

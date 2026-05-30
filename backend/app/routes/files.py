import uuid
import os
import aiofiles
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app import models, schemas
from app.auth import get_current_user
from app.config import settings
from app.rate_limiter import rate_limit

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/files", tags=["files"])

ALLOWED_TYPES = {
    "application/pdf", "text/plain", "text/markdown",
    "text/csv", "application/json",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

MAX_SIZE = settings.MAX_FILE_SIZE_MB * 1024 * 1024


@router.post("/upload", response_model=schemas.FileResponse, status_code=201, dependencies=[Depends(rate_limit(10, 60))])
async def upload_file(
    file: UploadFile = File(...),
    chat_id: str = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # Parse filename and validate extension
    filename = file.filename or ""
    ext = Path(filename).suffix.lower()
    allowed_extensions = {".pdf", ".txt", ".md", ".csv", ".json", ".docx"}
    
    if ext not in allowed_extensions:
        logger.warning("Upload rejected: disallowed file extension '%s' for file '%s'", ext, filename)
        raise HTTPException(
            status_code=400,
            detail=f"Disallowed file extension: '{ext}'. Allowed: .pdf, .txt, .md, .csv, .json, .docx",
        )

    # Validate that content-type matches whitelist and matches the extension (prevent spoofing)
    EXT_TO_MIME = {
        ".pdf": {"application/pdf"},
        ".txt": {"text/plain"},
        ".md": {"text/markdown", "text/plain"},
        ".csv": {"text/csv", "text/plain"},
        ".json": {"application/json", "text/plain"},
        ".docx": {"application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
    }
    
    expected_mimes = EXT_TO_MIME.get(ext)
    if not expected_mimes or file.content_type not in expected_mimes:
        logger.warning("Upload rejected: content-type '%s' is not valid for extension '%s' for file '%s'", file.content_type, ext, filename)
        raise HTTPException(
            status_code=400,
            detail=f"Content-type '{file.content_type}' is invalid for extension '{ext}'",
        )

    # Read and validate size
    content = await file.read()
    if len(content) > MAX_SIZE:
        logger.warning("Upload rejected: file '%s' exceeds size limit (%d bytes)", filename, len(content))
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Max size: {settings.MAX_FILE_SIZE_MB}MB",
        )

    # Check magic bytes for binary files to prevent masquerading
    if ext == ".pdf":
        if not content.startswith(b"%PDF"):
            logger.warning("Upload rejected: PDF signature check failed for file '%s'", filename)
            raise HTTPException(
                status_code=400,
                detail="Invalid PDF file structure (signature check failed)",
            )
    elif ext == ".docx":
        if not content.startswith(b"PK\x03\x04"):
            logger.warning("Upload rejected: DOCX signature check failed for file '%s'", filename)
            raise HTTPException(
                status_code=400,
                detail="Invalid DOCX file structure (signature check failed)",
            )

    logger.info("Starting file upload: '%s' (%d bytes) for user ID %s", file.filename, len(content), current_user.id)

    # Save to disk
    upload_dir = Path(settings.UPLOAD_DIR) / str(current_user.id)
    upload_dir.mkdir(parents=True, exist_ok=True)

    safe_name = f"{uuid.uuid4()}_{Path(file.filename or 'file').name}"
    file_path = upload_dir / safe_name

    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    # Resolve chat_id
    resolved_chat_id = None
    if chat_id:
        try:
            resolved_chat_id = str(uuid.UUID(chat_id))
        except ValueError:
            pass

    # Save metadata
    db_file = models.UploadedFile(
        user_id=current_user.id,
        chat_id=resolved_chat_id,
        filename=safe_name,
        original_filename=file.filename or "unknown",
        file_path=str(file_path),
        file_size=len(content),
        mime_type=file.content_type,
    )
    db.add(db_file)
    await db.flush()
    await db.refresh(db_file)

    # Ingest into RAG pipeline
    from app.rag_service import ingest_uploaded_file
    import asyncio
    
    logger.info("Ingesting uploaded file '%s' into RAG pipeline...", file.filename)
    loop = asyncio.get_event_loop()
    chunk_count = await loop.run_in_executor(
        None,
        lambda: ingest_uploaded_file(str(file_path), chat_id=resolved_chat_id, user_id=current_user.id)
    )
    logger.info("Ingestion completed: '%s' -> %d chunks embedded.", file.filename, chunk_count)
    
    # Optional: if chat_id is provided, add an AI message indicating ingestion
    if resolved_chat_id:
        msg_text = f"✅ **File loaded:** `{file.filename}` — `{chunk_count}` chunks embedded and indexed. You can now ask questions about this document."
        ai_msg = models.Message(
            chat_id=str(resolved_chat_id),
            role="assistant",
            content=msg_text,
        )
        db.add(ai_msg)

    await db.commit()
    logger.info("File upload and RAG ingestion transaction committed: FileID=%s", db_file.id)

    return schemas.FileResponse.model_validate(db_file)


@router.get("", response_model=list[schemas.FileResponse])
async def list_files(
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    result = await db.execute(
        select(models.UploadedFile)
        .where(models.UploadedFile.user_id == current_user.id)
        .order_by(models.UploadedFile.created_at.desc())
    )
    return [schemas.FileResponse.model_validate(f) for f in result.scalars().all()]


@router.delete("/{file_id}", status_code=204)
async def delete_file(
    file_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    result = await db.execute(
        select(models.UploadedFile).where(
            models.UploadedFile.id == str(file_id),
            models.UploadedFile.user_id == current_user.id,
        )
    )
    f = result.scalar_one_or_none()
    if not f:
        logger.warning("Delete file failure: File %s not found for user %s", file_id, current_user.id)
        raise HTTPException(status_code=404, detail="File not found")

    # Remove from disk
    try:
        os.remove(f.file_path)
        logger.info("Removed file from disk: %s", f.file_path)
    except FileNotFoundError:
        logger.warning("File not found on disk during deletion: %s", f.file_path)
        pass

    await db.delete(f)
    await db.commit()
    logger.info("File entry deleted from DB: FileID=%s UserID=%s", file_id, current_user.id)

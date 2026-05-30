import uuid
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app import models, schemas
from app.auth import (
    hash_password,
    verify_password,
    create_access_token,
    verify_google_id_token,
    _generate_unique_username,
)
from app.rate_limiter import rate_limit

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=schemas.TokenResponse, status_code=201, dependencies=[Depends(rate_limit(5, 60))])
async def signup(payload: schemas.SignupRequest, db: AsyncSession = Depends(get_db)):
    # Check email uniqueness
    existing = await db.execute(
        select(models.User).where(models.User.email == payload.email)
    )
    if existing.scalar_one_or_none():
        logger.warning("Signup failure: email already registered")
        raise HTTPException(status_code=409, detail="Email already registered")

    # Check username uniqueness
    existing_un = await db.execute(
        select(models.User).where(models.User.username == payload.username)
    )
    if existing_un.scalar_one_or_none():
        logger.warning("Signup failure: username already taken")
        raise HTTPException(status_code=409, detail="Username already taken")

    user = models.User(
        email=payload.email,
        username=payload.username,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    logger.info("New user signed up successfully: UserID=%s", user.id)
    token = create_access_token(user.id, user.email)
    return schemas.TokenResponse(
        access_token=token,
        user=schemas.UserPublic.model_validate(user),
    )


@router.post("/login", response_model=schemas.TokenResponse, dependencies=[Depends(rate_limit(5, 60))])
async def login(payload: schemas.LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.User).where(models.User.email == payload.email)
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.hashed_password):
        logger.warning("Login failure: invalid credentials")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not user.is_active:
        logger.warning("Login failure: disabled account")
        raise HTTPException(status_code=403, detail="Account is disabled")

    logger.info("User logged in: UserID=%s", user.id)
    token = create_access_token(user.id, user.email)
    return schemas.TokenResponse(
        access_token=token,
        user=schemas.UserPublic.model_validate(user),
    )


@router.post("/google", response_model=schemas.TokenResponse, dependencies=[Depends(rate_limit(5, 60))])
async def google_login(payload: schemas.GoogleLoginRequest, db: AsyncSession = Depends(get_db)):
    try:
        claims = await verify_google_id_token(payload.id_token)
    except Exception as exc:
        logger.warning("Google login token verification failed: %s", exc)
        raise

    email = claims.get("email")
    if not email:
        logger.warning("Google login failure: token missing email claim")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google token missing email")

    result = await db.execute(select(models.User).where(models.User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        logger.info("Registering new user via Google login")
        username = await _generate_unique_username(email, db)
        user = models.User(
            email=email,
            username=username,
            hashed_password=hash_password(str(uuid.uuid4())),
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)

    if not user.is_active:
        logger.warning("Google login failure: user account is disabled")
        raise HTTPException(status_code=403, detail="Account is disabled")

    logger.info("User logged in via Google: UserID=%s", user.id)
    token = create_access_token(user.id, user.email)
    return schemas.TokenResponse(
        access_token=token,
        user=schemas.UserPublic.model_validate(user),
    )


@router.get("/me", response_model=schemas.UserPublic)
async def me(current_user: models.User = Depends(__import__("app.auth", fromlist=["get_current_user"]).get_current_user)):
    return schemas.UserPublic.model_validate(current_user)

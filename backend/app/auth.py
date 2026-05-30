from datetime import datetime, timedelta, timezone
from typing import Optional
import re
import uuid
import logging

import bcrypt
import httpx
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import settings
from app.database import get_db
from app import models

logger = logging.getLogger(__name__)
bearer_scheme = HTTPBearer()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {
        "sub": str(user_id),
        "email": email,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_ISSUERS = ("https://accounts.google.com", "accounts.google.com")


async def _fetch_google_jwks() -> list[dict]:
    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.get(GOOGLE_CERTS_URL)
        res.raise_for_status()
        data = res.json()
    return data.get("keys", [])


async def verify_google_id_token(id_token: str) -> dict:
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google login is not configured",
        )

    unverified_header = jwt.get_unverified_header(id_token)
    kid = unverified_header.get("kid")
    if not kid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google token")

    jwks = await _fetch_google_jwks()
    key = next((item for item in jwks if item.get("kid") == kid), None)
    if not key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unable to verify Google token")

    try:
        payload = jwt.decode(
            id_token,
            key,
            algorithms=["RS256"],
            audience=settings.GOOGLE_CLIENT_ID,
            issuer=GOOGLE_ISSUERS,
        )
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired Google token")

    if not payload.get("email_verified"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google account email not verified")

    return payload


async def _generate_unique_username(base_email: str, db: AsyncSession) -> str:
    base_name = re.sub(r"[^a-z0-9_]", "", base_email.split("@")[0].lower()) or "user"
    candidate = base_name
    suffix = 1
    while True:
        existing = await db.execute(select(models.User).where(models.User.username == candidate))
        if existing.scalar_one_or_none() is None:
            return candidate
        suffix += 1
        candidate = f"{base_name}{suffix}"


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError as exc:
        logger.warning("Token decoding failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> models.User:
    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        logger.warning("Token payload missing 'sub' claim")
        raise HTTPException(status_code=401, detail="Invalid token payload")

    result = await db.execute(select(models.User).where(models.User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        logger.warning("Authentication failure: user ID %s not found or inactive", user_id)
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user

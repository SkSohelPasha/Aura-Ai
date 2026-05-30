from pydantic import BaseModel, EmailStr, field_validator
from datetime import datetime
from typing import Optional


# ─── Auth ────────────────────────────────────────────────────────────────────

class SignupRequest(BaseModel):
    email: EmailStr
    username: str
    password: str

    @field_validator("username")
    @classmethod
    def username_alphanumeric(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3 or len(v) > 50:
            raise ValueError("Username must be 3–50 characters")
        return v

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if len(v) > 72:
            raise ValueError("Password cannot exceed 72 characters")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class GoogleLoginRequest(BaseModel):
    id_token: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserPublic"


class UserPublic(BaseModel):
    id: str
    email: str
    username: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Chat ─────────────────────────────────────────────────────────────────────

class ChatCreate(BaseModel):
    title: str = "New Chat"


class ChatResponse(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int = 0
    last_message: Optional[str] = None

    model_config = {"from_attributes": True}


class MessageResponse(BaseModel):
    id: str
    chat_id: str
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatDetailResponse(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    messages: list[MessageResponse] = []

    model_config = {"from_attributes": True}


class SendMessageRequest(BaseModel):
    chat_id: Optional[str] = None  # if None, create new chat
    content: str
    stream: bool = False

    @field_validator("content")
    @classmethod
    def content_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Message cannot be empty")
        if len(v) > 32000:
            raise ValueError("Message too long (max 32000 chars)")
        return v


class SendMessageResponse(BaseModel):
    chat_id: str
    chat_title: str
    user_message: MessageResponse
    assistant_message: MessageResponse


# ─── Files ───────────────────────────────────────────────────────────────────

class FileResponse(BaseModel):
    id: str
    filename: str
    original_filename: str
    file_size: int
    mime_type: Optional[str]
    processed: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Generic ─────────────────────────────────────────────────────────────────

class MessageOut(BaseModel):
    message: str


class ErrorResponse(BaseModel):
    detail: str

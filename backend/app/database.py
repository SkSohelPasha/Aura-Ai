import logging
from typing import AsyncGenerator
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from dotenv import load_dotenv
from urllib.parse import quote_plus
import os

# Load environment variables from .env
load_dotenv()

logger = logging.getLogger(__name__)

# ── Fetch connection variables ────────────────────────────────────────────────

USER = os.getenv("user")
PASSWORD = os.getenv("password")
HOST = os.getenv("host")
PORT = os.getenv("port")
DBNAME = os.getenv("dbname")

ENCODED_USER = quote_plus(USER or "")
ENCODED_PASSWORD = quote_plus(PASSWORD or "")

# ── Sync engine (psycopg2) — connection test + migrations ────────────────────

DATABASE_URL = (
    f"postgresql+psycopg2://{ENCODED_USER}:{ENCODED_PASSWORD}"
    f"@{HOST}:{PORT}/{DBNAME}?sslmode=require"
)

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)

# Test connection at startup and emit a structured log
try:
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    logger.info("PostgreSQL connection established successfully (psycopg2).")
except Exception as exc:
    logger.error("Failed to connect to PostgreSQL (psycopg2): %s", exc)

# ── Async engine (asyncpg) — runtime FastAPI sessions ─────────────────────────

ASYNC_DATABASE_URL = (
    f"postgresql+asyncpg://{ENCODED_USER}:{ENCODED_PASSWORD}"
    f"@{HOST}:{PORT}/{DBNAME}?ssl=require"
)

async_engine = create_async_engine(
    ASYNC_DATABASE_URL,
    echo=os.getenv("APP_ENV") == "development",
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)

AsyncSessionLocal = async_sessionmaker(
    async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    pass


# ── Dependency injection ───────────────────────────────────────────────────────

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ── Table initialisation ───────────────────────────────────────────────────────

async def init_db():
    """Create all tables on startup if they do not already exist."""
    async with async_engine.begin() as conn:
        from app import models  # noqa: F401 — ensure models are registered
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database schema verified / tables initialised (asyncpg).")
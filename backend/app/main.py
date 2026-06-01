from contextlib import asynccontextmanager
from typing import Any
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.config import settings
from app.database import init_db
from app.routes import auth, chat, files
from app.rag_service import init_rag_pipeline

# Configure global logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up Aura AI Backend (env: %s)...", settings.APP_ENV)

    # Production security checks
    if settings.APP_ENV != "development":
        if (
            settings.SECRET_KEY == "change-me-in-production-at-least-32-characters-long"
            or settings.SECRET_KEY == "local-dev-secret-key-change-in-production-min-32-chars"
            or len(settings.SECRET_KEY) < 32
        ):
            logger.critical("Insecure SECRET_KEY configured for production environment!")
            raise RuntimeError("Insecure SECRET_KEY configured for production environment")

        if "*" in settings.allowed_origins_list:
            logger.critical("Wildcard CORS origin '*' is not allowed in production environment!")
            raise RuntimeError("Wildcard CORS origin is not allowed in production environment")

    try:
        await init_db()

        # ✅ SAFE RAG INIT (prevents crash from breaking API routes)
        try:
            init_rag_pipeline()
            logger.info("RAG pipeline initialized successfully.")
        except Exception as rag_err:
            logger.error("RAG initialization failed but server will continue: %s", rag_err)

        logger.info("Application startup completed successfully.")

    except Exception as exc:
        logger.critical("Error during backend startup: %s", exc)
        raise

    yield

    logger.info("Shutting down Aura AI Backend...")


app = FastAPI(
    title="Aura AI API",
    description="Production-ready AI chat backend",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.APP_ENV == "development" else None,
    redoc_url="/redoc" if settings.APP_ENV == "development" else None,
)

# ─── Middleware ────────────────────────────────────────────────────────────────

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = "default-src 'self'; frame-ancestors 'none';"

    if settings.APP_ENV != "development":
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"

    return response


app.add_middleware(GZipMiddleware, minimum_size=1000)

cors_kwargs: dict[str, Any] = {
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
    "expose_headers": ["X-Request-ID"],
}

if settings.APP_ENV == "development":
    cors_kwargs["allow_origin_regex"] = r"^http://localhost(:[0-9]+)?$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    **cors_kwargs,
)

# ─── Routes ───────────────────────────────────────────────────────────────────

app.include_router(auth.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1")
app.include_router(files.router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}
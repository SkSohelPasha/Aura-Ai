from pydantic_settings import BaseSettings
from functools import lru_cache
from urllib.parse import quote_plus


class Settings(BaseSettings):
    user: str = "postgres"
    password: str = "password"
    host: str = "localhost"
    port: str = "5432"
    dbname: str = "aura_db"
    DATABASE_URL: str = ""
    SECRET_KEY: str = "change-me-in-production-at-least-32-characters-long"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days
    OPENAI_API_KEY: str = ""
    GOOGLE_API_KEY: str = ""
    GOOGLE_CLIENT_ID: str = ""
    APP_ENV: str = "development"
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:5174,http://localhost:3000"
    UPLOAD_DIR: str = "./uploads"
    MAX_FILE_SIZE_MB: int = 10

    class Config:
        env_file = ".env"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]

    @property
    def database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL

        encoded_user = quote_plus(self.user)
        encoded_password = quote_plus(self.password)
        return (
            f"postgresql+asyncpg://{encoded_user}:{encoded_password}@{self.host}:{self.port}/{self.dbname}?sslmode=require"
        )


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

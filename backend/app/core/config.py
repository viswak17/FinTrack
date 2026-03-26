from pydantic_settings import BaseSettings
from pydantic import Field
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    # App
    APP_NAME: str = "FinTrack"
    APP_VERSION: str = "2.1.0"
    DEBUG: bool = False
    SECRET_KEY: str = Field(..., env="SECRET_KEY")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # MongoDB Atlas
    MONGODB_URI: str = Field(..., env="MONGODB_URI")
    MONGODB_DB_NAME: str = "fintrack"

    # Redis
    REDIS_URL: str = Field(default="redis://localhost:6379", env="REDIS_URL")
    REDIS_PASSWORD: Optional[str] = Field(default=None, env="REDIS_PASSWORD")

    # Groq LLM
    GROQ_API_KEY: str = Field(default="", env="GROQ_API_KEY")
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    LLM_MAX_TOKENS: int = 600
    LLM_TEMPERATURE: float = 0.4

    # External APIs
    EXCHANGE_RATE_API_KEY: str = Field(default="", env="EXCHANGE_RATE_API_KEY")
    COINGECKO_API_URL: str = "https://api.coingecko.com/api/v3"

    # Rate limits
    LLM_CALLS_PER_DAY: int = 20

    # Cache TTL (seconds)
    CACHE_TTL_FX_RATE: int = 21600      # 6 hours
    CACHE_TTL_CRYPTO: int = 900          # 15 min
    CACHE_TTL_AI_PULSE: int = 21600      # 6 hours
    CACHE_TTL_ML_MODEL: int = 86400      # 24 hours

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000", "https://fintrack-ec5s.onrender.com"]

    # ML
    ML_MIN_SAMPLES_CATEGORIZER: int = 20
    ML_MIN_SAMPLES_FORECAST: int = 30
    ML_RETRAIN_BATCH_SIZE: int = 10

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

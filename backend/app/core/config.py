import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/TARS"
    SYNC_DATABASE_URL: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/TARS"
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Security / Auth
    SECRET_KEY: str = "supersecretkey"
    
    # API Keys
    GROQ_API_KEY: str = ""
    
    # Application State
    DEBUG: bool = True
    MODEL_PATH: str = "./ml_models/"

    # Detection Thresholds
    ANOMALY_THRESHOLD: float = 0.65

    # Safety Layer
    SHADOW_MODE: bool = True
    HUMAN_APPROVAL_MODE: bool = False
    HIGH_CONFIDENCE_THRESHOLD: float = 0.8
    MEDIUM_CONFIDENCE_THRESHOLD: float = 0.5
    AUTO_ROLLBACK_MINUTES: int = 30
    TRUSTED_IPS: list[str] = []
    
    # Metrics
    METRICS_RETENTION_DAYS: int = 90
    BASELINE_LEARNING_DAYS: int = 7
    COST_PER_BLOCKED_REQUEST: float = 0.001

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

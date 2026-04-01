import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/TARS"
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Security / Auth
    SECRET_KEY: str = "supersecretkey"
    
    # API Keys
    GROQ_API_KEY: str = ""
    
    # Application State
    DEBUG: bool = True
    MODEL_PATH: str = "./ml_models/"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

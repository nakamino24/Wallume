from __future__ import annotations

from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # MongoDB
    mongo_url: str = "mongodb://localhost:27017"
    db_name: str = "wallume"

    # Auth
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_days: int = 30

    # Integrations
    groq_api_key: str = ""
    emergent_llm_key: str = ""

    # Rate limits
    login_rate_limit: str = "10/minute"
    signup_rate_limit: str = "5/minute"
    default_rate_limit: str = "200/minute"

    # CORS
    allowed_origins: list[str] = [
        "http://localhost:8081",
        "http://localhost:8001",
    ]

    model_config = {"env_file": Path(__file__).parent.parent.parent / ".env", "env_file_encoding": "utf-8"}


settings = Settings()
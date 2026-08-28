from __future__ import annotations

from pathlib import Path
from typing import ClassVar
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DEFAULT_JWT_SECRET: ClassVar[str] = "change-me-in-production"

    # Runtime environment. Railway also exposes RAILWAY_ENVIRONMENT_NAME, so
    # production safety does not depend on one provider-specific convention.
    environment: str = "development"
    railway_environment_name: str = ""

    # MongoDB
    mongo_url: str = "mongodb://localhost:27017"
    db_name: str = "wallume"

    # Auth
    jwt_secret: str = DEFAULT_JWT_SECRET
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

    # Admin (template management) — comma-separated emails in env ADMIN_EMAILS
    admin_emails: list[str] = []

    model_config = {"env_file": Path(__file__).parent.parent.parent / ".env", "env_file_encoding": "utf-8"}

    def validate_production_safety(self) -> None:
        environments = {self.environment.lower(), self.railway_environment_name.lower()}
        if environments.intersection({"production", "prod"}) and self.jwt_secret == self.DEFAULT_JWT_SECRET:
            raise RuntimeError(
                "Refusing to start in production with the default JWT_SECRET. "
                "Configure a strong, unique JWT_SECRET first."
            )


settings = Settings()

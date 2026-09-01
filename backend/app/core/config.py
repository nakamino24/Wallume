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

    # Password recovery is opt-in until a transactional email provider and
    # dedicated HMAC secret are configured. Never reuse JWT_SECRET here.
    password_reset_enabled: bool = False
    password_reset_secret: str = "development-only-password-reset-secret"
    password_reset_email_provider: str = "disabled"
    password_reset_from_email: str = ""
    resend_api_key: str = ""
    password_reset_otp_minutes: int = 10
    password_reset_token_minutes: int = 10
    password_reset_cooldown_seconds: int = 60
    password_reset_max_attempts: int = 5

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
        is_prod = bool(environments.intersection({"production", "prod"}))
        if is_prod and self.jwt_secret == self.DEFAULT_JWT_SECRET:
            raise RuntimeError(
                "Refusing to start in production with the default JWT_SECRET. "
                "Configure a strong, unique JWT_SECRET first."
            )
        if is_prod:
            mongo = (self.mongo_url or "").strip()
            if not mongo:
                raise RuntimeError("Refusing to start in production with empty MONGO_URL.")
            if mongo in ("mongodb://localhost:27017", "mongodb://127.0.0.1:27017") or mongo.startswith("mongodb://localhost") or mongo.startswith("mongodb://127.0.0.1"):
                raise RuntimeError("Refusing to start in production with localhost MONGO_URL.")
            db = (self.db_name or "").strip()
            if not db:
                raise RuntimeError("Refusing to start in production with empty DB_NAME.")
            if db.lower() in ("test",):
                raise RuntimeError("Refusing to start in production with unsafe DB_NAME 'test'.")
            if self.password_reset_enabled:
                reset_secret = (self.password_reset_secret or "").strip()
                if len(reset_secret) < 32 or reset_secret == "development-only-password-reset-secret":
                    raise RuntimeError("Refusing to enable password recovery with unsafe PASSWORD_RESET_SECRET.")
                if reset_secret == (self.jwt_secret or "").strip():
                    raise RuntimeError("PASSWORD_RESET_SECRET must not reuse JWT_SECRET.")
                if self.password_reset_email_provider.lower() != "resend":
                    raise RuntimeError("PASSWORD_RESET_EMAIL_PROVIDER must be 'resend' in production.")
                if not (self.password_reset_from_email or "").strip():
                    raise RuntimeError("PASSWORD_RESET_FROM_EMAIL is required when password recovery is enabled.")
                if not (self.resend_api_key or "").strip():
                    raise RuntimeError("RESEND_API_KEY is required when password recovery is enabled.")
                if not (1 <= self.password_reset_otp_minutes <= 60):
                    raise RuntimeError("PASSWORD_RESET_OTP_MINUTES must be between 1 and 60.")
                if not (1 <= self.password_reset_token_minutes <= 60):
                    raise RuntimeError("PASSWORD_RESET_TOKEN_MINUTES must be between 1 and 60.")
                if self.password_reset_cooldown_seconds < 1:
                    raise RuntimeError("PASSWORD_RESET_COOLDOWN_SECONDS must be positive.")
                if not (1 <= self.password_reset_max_attempts <= 10):
                    raise RuntimeError("PASSWORD_RESET_MAX_ATTEMPTS must be between 1 and 10.")


settings = Settings()

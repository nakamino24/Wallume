from __future__ import annotations

from html import escape
from typing import Protocol

import httpx

from app.core.config import Settings, settings


class PasswordResetMailer(Protocol):
    async def send_password_reset_code(
        self, email: str, code: str, expires_minutes: int, locale: str
    ) -> None: ...


class ResendPasswordResetMailer:
    def __init__(self, config: Settings = settings) -> None:
        self.api_key = config.resend_api_key
        self.from_email = config.password_reset_from_email

    async def send_password_reset_code(
        self, email: str, code: str, expires_minutes: int, locale: str
    ) -> None:
        is_id = locale == "id"
        subject = "Kode reset password Wallume" if is_id else "Your Wallume password reset code"
        intro = "Kode reset password kamu:" if is_id else "Your password reset code:"
        expiry = (
            f"Kode ini kedaluwarsa dalam {expires_minutes} menit."
            if is_id else f"This code expires in {expires_minutes} minutes."
        )
        ignore = (
            "Kalau kamu tidak meminta perubahan ini, abaikan email ini."
            if is_id else "If you didn't request this change, you can ignore this email."
        )
        text = f"Wallume\n\n{intro}\n\n{code}\n\n{expiry}\n\n{ignore}"
        html = (
            f"<h2>Wallume</h2><p>{escape(intro)}</p>"
            f"<p style=\"font-size:28px;font-weight:700;letter-spacing:6px\">{escape(code)}</p>"
            f"<p>{escape(expiry)}</p><p>{escape(ignore)}</p>"
        )
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "from": self.from_email,
                    "to": [email],
                    "subject": subject,
                    "text": text,
                    "html": html,
                },
            )
            response.raise_for_status()


def build_password_reset_mailer(config: Settings = settings) -> PasswordResetMailer:
    if config.password_reset_email_provider.lower() == "resend":
        return ResendPasswordResetMailer(config)
    raise RuntimeError("Password reset email provider is not configured")

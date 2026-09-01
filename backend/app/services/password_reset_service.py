from __future__ import annotations

import hashlib
import hmac
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Protocol

from fastapi import HTTPException

from app.core.config import Settings, settings
from app.repositories.repos import PasswordResetRepository, UserRepository, UserSessionRepository
from app.security.auth import hash_password, password_policy_error
from app.services.email_sender import PasswordResetMailer, build_password_reset_mailer
from app.utils.email import normalize_email
from app.utils.helpers import now_utc


log = logging.getLogger("wallume.password_reset")
PUBLIC_MESSAGE = "If an eligible account exists, a verification code has been sent."
INVALID_CODE = "Invalid or expired verification code"
INVALID_TOKEN = "Invalid or expired reset token"


class BackgroundTaskScheduler(Protocol):
    def add_task(self, func: Any, *args: Any, **kwargs: Any) -> None: ...


class PasswordResetService:
    def __init__(
        self,
        config: Settings = settings,
        mailer: PasswordResetMailer | None = None,
    ) -> None:
        self.config = config
        self.users = UserRepository()
        self.sessions = UserSessionRepository()
        self.challenges = PasswordResetRepository()
        self.mailer = mailer

    def _response(self, request_id: str) -> dict[str, str]:
        return {"request_id": request_id, "message": PUBLIC_MESSAGE}

    def _code_hash(self, request_id: str, code: str) -> str:
        message = f"{request_id}:{code}".encode("utf-8")
        return hmac.new(
            self.config.password_reset_secret.encode("utf-8"),
            message,
            hashlib.sha256,
        ).hexdigest()

    @staticmethod
    def _token_hash(token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    @staticmethod
    def _eligible(user: dict | None) -> bool:
        return bool(
            user
            and user.get("provider") == "email"
            and user.get("password_hash")
            and user.get("user_id")
        )

    def _cooling_down(self, created_at: datetime | None, now: datetime) -> bool:
        if not created_at:
            return False
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        return (now - created_at).total_seconds() < self.config.password_reset_cooldown_seconds

    def _mailer(self) -> PasswordResetMailer:
        if self.mailer is None:
            self.mailer = build_password_reset_mailer(self.config)
        return self.mailer

    async def request(
        self,
        email: str,
        locale: str = "en",
        background_tasks: BackgroundTaskScheduler | None = None,
    ) -> dict[str, str]:
        request_id = secrets.token_urlsafe(24)
        normalized_email = normalize_email(email)
        if background_tasks is not None and self.config.password_reset_enabled:
            # Keep the public response independent of account existence and
            # email-provider latency. Starlette executes this only after the
            # response has been sent.
            background_tasks.add_task(
                self._process_request, request_id, normalized_email, locale
            )
        else:
            await self._process_request(request_id, normalized_email, locale)
        return self._response(request_id)

    async def _process_request(
        self, request_id: str, email: str, locale: str
    ) -> None:
        if not self.config.password_reset_enabled:
            log.info("password_reset.request accepted eligible=false")
            return

        user = await self.users.find_by_email(email)
        if not self._eligible(user):
            log.info("password_reset.request accepted eligible=false")
            return

        now = now_utc()
        latest = await self.challenges.find_latest_for_user(user["user_id"])
        if latest and self._cooling_down(latest.get("created_at"), now):
            log.info("password_reset.request accepted cooldown=true")
            return

        code = f"{secrets.randbelow(1_000_000):06d}"
        expires_at = now + timedelta(minutes=self.config.password_reset_otp_minutes)
        await self.challenges.invalidate_for_user(user["user_id"], now)
        await self.challenges.create_challenge({
            "id": request_id,
            "user_id": user["user_id"],
            "code_hash": self._code_hash(request_id, code),
            "created_at": now,
            "expires_at": expires_at,
            "attempt_count": 0,
            "verified_at": None,
            "used_at": None,
            "reset_token_hash": None,
            "reset_token_expires_at": None,
            "locale": locale,
        })
        try:
            await self._mailer().send_password_reset_code(
                email, code, self.config.password_reset_otp_minutes, locale
            )
        except Exception:
            await self.challenges.invalidate(request_id, now_utc())
            log.warning("password_reset.request delivery_failed")
        else:
            log.info("password_reset.request accepted eligible=true")

    async def resend(
        self,
        request_id: str,
        background_tasks: BackgroundTaskScheduler | None = None,
    ) -> dict[str, str]:
        if background_tasks is not None and self.config.password_reset_enabled:
            # As with the initial request, no challenge/account/provider branch
            # or email-provider call runs before the generic response is sent.
            background_tasks.add_task(self._process_resend, request_id)
        else:
            await self._process_resend(request_id)
        return self._response(request_id)

    async def _process_resend(self, request_id: str) -> None:
        if not self.config.password_reset_enabled:
            return
        challenge = await self.challenges.find_by_id(request_id)
        now = now_utc()
        if not challenge or challenge.get("used_at") is not None:
            return
        expires_at = challenge.get("expires_at")
        if not isinstance(expires_at, datetime):
            return
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at <= now:
            return
        if self._cooling_down(challenge.get("created_at"), now):
            return
        user = await self.users.find_by_user_id(challenge.get("user_id", ""))
        if not self._eligible(user):
            return

        code = f"{secrets.randbelow(1_000_000):06d}"
        expires_at = now + timedelta(minutes=self.config.password_reset_otp_minutes)
        updated = await self.challenges.replace_code(
            request_id, self._code_hash(request_id, code), now, expires_at
        )
        if not updated:
            return
        try:
            await self._mailer().send_password_reset_code(
                user["email"], code, self.config.password_reset_otp_minutes, challenge.get("locale", "en")
            )
        except Exception:
            await self.challenges.invalidate(request_id, now_utc())
            log.warning("password_reset.resend delivery_failed")

    async def verify(self, request_id: str, code: str) -> dict[str, int | str]:
        if not self.config.password_reset_enabled:
            raise HTTPException(400, INVALID_CODE)
        now = now_utc()
        reset_token = secrets.token_urlsafe(32)
        token_expires = now + timedelta(minutes=self.config.password_reset_token_minutes)
        verified = await self.challenges.verify_code(
            request_id=request_id,
            code_hash=self._code_hash(request_id, code),
            now=now,
            max_attempts=self.config.password_reset_max_attempts,
            reset_token_hash=self._token_hash(reset_token),
            reset_token_expires_at=token_expires,
        )
        if not verified:
            await self.challenges.record_failed_attempt(
                request_id, now, self.config.password_reset_max_attempts
            )
            log.warning("password_reset.verify failed")
            raise HTTPException(400, INVALID_CODE)
        log.info("password_reset.verify success")
        return {
            "reset_token": reset_token,
            "expires_in": self.config.password_reset_token_minutes * 60,
        }

    async def confirm(
        self, reset_token: str, new_password: str, confirm_password: str
    ) -> None:
        if new_password != confirm_password:
            raise HTTPException(400, "Password confirmation does not match")
        policy_error = password_policy_error(new_password)
        if policy_error:
            raise HTTPException(400, policy_error)
        if not self.config.password_reset_enabled:
            raise HTTPException(400, INVALID_TOKEN)

        token_hash = self._token_hash(reset_token)
        now = now_utc()
        # Claim first: replay is impossible even if a later persistence step
        # fails. The user can safely request a new challenge in that case.
        challenge = await self.challenges.claim_reset_token(token_hash, now)
        if not challenge:
            raise HTTPException(400, INVALID_TOKEN)
        user = await self.users.find_by_user_id(challenge.get("user_id", ""))
        if not self._eligible(user):
            raise HTTPException(400, INVALID_TOKEN)
        updated = await self.users.update_password_and_auth_version(
            user["user_id"], hash_password(new_password)
        )
        if not updated:
            raise HTTPException(400, INVALID_TOKEN)
        await self.sessions.delete_by_user(user["user_id"])
        log.info("password_reset.confirm success")

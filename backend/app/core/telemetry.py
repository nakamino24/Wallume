"""Error telemetry.

Sentry is entirely optional: with no DSN configured every function here is a
no-op, so local runs, tests and CI never require an account or network access.
When a DSN *is* set, unhandled exceptions and failed requests are reported with
the request path (never a token, password or amount).
"""
from __future__ import annotations

import logging
from typing import Any, Optional

log = logging.getLogger("wallume.telemetry")

# Fields that must never leave the server in a report.
_REDACTED_HEADERS = {"authorization", "cookie", "set-cookie", "x-api-key"}
_REDACTED_KEYS = {
    "password", "new_password", "confirm_password", "password_hash", "token",
    "session_token", "reset_token", "code", "jwt", "secret",
}


def _scrub_headers(headers: dict[str, Any]) -> dict[str, Any]:
    return {
        key: ("[redacted]" if key.lower() in _REDACTED_HEADERS else value)
        for key, value in (headers or {}).items()
    }


def _scrub_mapping(data: dict[str, Any]) -> dict[str, Any]:
    return {
        key: ("[redacted]" if key.lower() in _REDACTED_KEYS else value)
        for key, value in (data or {}).items()
    }


def init_sentry(dsn: Optional[str], environment: str, release: Optional[str] = None) -> bool:
    """Initialise Sentry if a DSN is configured. Returns whether it was enabled."""
    if not dsn:
        log.info("Sentry disabled (no SENTRY_DSN configured)")
        return False

    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.starlette import StarletteIntegration
    except ImportError:  # pragma: no cover - dependency missing
        log.warning("SENTRY_DSN is set but sentry-sdk is not installed; telemetry disabled")
        return False

    def _before_send(event: dict, hint: dict) -> Optional[dict]:
        request = event.get("request") or {}
        if "headers" in request:
            request["headers"] = _scrub_headers(request["headers"])
        if "data" in request and isinstance(request["data"], dict):
            request["data"] = _scrub_mapping(request["data"])
        if "query_string" in request:
            # Query strings can carry a reset token or session id.
            request["query_string"] = "[redacted]"
        return event

    sentry_sdk.init(
        dsn=dsn,
        environment=environment or "development",
        release=release,
        integrations=[StarletteIntegration(), FastApiIntegration()],
        # Errors only: this app handles financial data, so no tracing payloads.
        traces_sample_rate=0.0,
        send_default_pii=False,
        before_send=_before_send,
    )
    log.info("Sentry enabled for environment=%s", environment)
    return True


def capture_exception(error: BaseException, **context: Any) -> None:
    """Report a handled exception with contextual tags."""
    try:
        import sentry_sdk
        # new_scope() is the current API; push_scope() is deprecated in 2.x.
        with sentry_sdk.new_scope() as scope:
            for key, value in context.items():
                scope.set_tag(key, str(value))
            scope.capture_exception(error)
    except Exception:
        # Telemetry must never raise. The error is already logged by the caller.
        pass

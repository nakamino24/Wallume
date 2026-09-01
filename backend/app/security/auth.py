from datetime import datetime, timezone, timedelta
from typing import Any
import uuid
import bcrypt
import jwt
from app.core.config import settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except Exception:
        return False


def password_policy_error(password: str) -> str | None:
    """Return the existing Wallume password-policy error, if any."""
    if len(password) < 8:
        return "Password must be at least 8 characters"
    if not any(c.isdigit() for c in password):
        return "Password must contain at least one number"
    if not any(c.isupper() for c in password):
        return "Password must contain at least one uppercase letter"
    return None


def create_access_token(user_id: str, auth_version: int = 0) -> str:
    jti = uuid.uuid4().hex[:16]
    payload = {
        "sub": user_id,
        "jti": jti,
        "ver": int(auth_version),
        "iat": int(datetime.now(timezone.utc).timestamp()),
        "exp": int((datetime.now(timezone.utc) + timedelta(days=settings.jwt_expire_days)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])

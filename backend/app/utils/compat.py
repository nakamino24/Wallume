"""Small explicit compatibility helpers — READ OLD + READ NEW, WRITE NEW.

Keep near persistence boundary, not in UI.
"""

from typing import Any

from app.utils.email import normalize_email
from app.utils.helpers import to_canonical_date


def normalize_user_document(doc: dict[str, Any]) -> dict[str, Any]:
    """Return canonical user shape, tolerating legacy missing optional fields."""
    if not doc:
        return doc
    out = dict(doc)
    # Email always canonical lower+strip if present
    if "email" in out and isinstance(out["email"], str):
        out["email"] = normalize_email(out["email"])
    # Ensure optional fields have defaults (legacy may miss them)
    out.setdefault("provider", "email")
    out.setdefault("currency", "USD")
    out.setdefault("theme", "light")
    out.setdefault("payday_day", None)
    out.setdefault("work_week", 5)
    out.setdefault("picture", None)
    # Historical users and JWTs predate session versioning. Both normalize to
    # zero until the first credential reset increments the persisted version.
    out.setdefault("auth_version", 0)
    return out


def normalize_transaction_document(doc: dict[str, Any]) -> dict[str, Any]:
    """Normalize proven historical ISO transaction dates without mutating Mongo."""
    if not doc or "date" not in doc:
        return doc
    out = dict(doc)
    if isinstance(out["date"], str):
        out["date"] = to_canonical_date(out["date"])
    return out

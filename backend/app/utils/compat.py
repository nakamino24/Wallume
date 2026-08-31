"""Small explicit compatibility helpers — READ OLD + READ NEW, WRITE NEW.

Keep near persistence boundary, not in UI.
"""

from typing import Any

from app.utils.email import normalize_email


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
    return out


def normalize_money_value(value: Any):
    """Delegate to existing tolerant to_decimal — legacy int/float/str/Decimal/Decimal128 → Decimal."""
    from app.utils.money import to_decimal

    return to_decimal(value)


def normalize_transaction_document(doc: dict[str, Any]) -> dict[str, Any]:
    """Tolerate historical date forms; writer still emits YYYY-MM-DD."""
    if not doc or "date" not in doc:
        return doc
    out = dict(doc)
    v = out["date"]
    if isinstance(v, str) and "T" in v:
        # Legacy ISO datetime → keep calendar date part (no timezone fabrication)
        out["date"] = v.split("T")[0]
    return out

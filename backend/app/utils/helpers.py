from __future__ import annotations

from typing import Any
from datetime import datetime, timezone


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def new_id(prefix: str = "id") -> str:
    import uuid
    return f"{prefix}_{uuid.uuid4().hex[:16]}"


def clean_user(user: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in user.items() if k not in {"_id", "password_hash"}}


def advance_date(iso_date: str, frequency: str) -> str:
    from datetime import timedelta
    d = datetime.fromisoformat(iso_date.replace("Z", "+00:00")) if "T" in iso_date else datetime.fromisoformat(iso_date)
    if frequency == "weekly":
        d += timedelta(days=7)
    elif frequency == "yearly":
        try:
            d = d.replace(year=d.year + 1)
        except ValueError:
            d += timedelta(days=365)
    else:
        month = d.month + 1
        year = d.year + (1 if month > 12 else 0)
        month = 1 if month > 12 else month
        day = min(d.day, 28)
        d = d.replace(year=year, month=month, day=day)
    return d.isoformat()
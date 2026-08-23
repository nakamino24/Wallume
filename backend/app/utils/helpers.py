from __future__ import annotations

import re
from typing import Any
from datetime import datetime, timezone


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def to_canonical_date(value: str | None) -> str | None:
    """Normalize any transaction date to the canonical YYYY-MM-DD form.

    The transactions collection stores user-facing dates as plain
    "YYYY-MM-DD" strings; mixed formats would make lexicographic ordering and
    range queries ambiguous (this exact bug was migrated away on 2026-08-22).
    Full ISO strings are converted via their UTC calendar date; unrecognized
    values pass through untouched rather than being dropped.
    """
    if not value or len(value) == 10:
        return value
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if dt.tzinfo is not None:
            dt = dt.astimezone(timezone.utc)
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        return value


_CANONICAL_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def strict_canonical_date(value: str | None) -> str | None:
    """`to_canonical_date` plus a hard guarantee: the result is either a true
    YYYY-MM-DD string or None. API boundaries use this so unrecognized inputs
    (e.g. "not-a-date") can be rejected instead of stored verbatim."""
    c = to_canonical_date(value)
    return c if c and _CANONICAL_RE.match(c) else None


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
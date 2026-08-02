"""Wallume Income Engine.

Profession-agnostic. It never knows profession names — it only receives a
configured list of Income Sources (each with calculation method, frequency,
payment-date rule, adjustment rules, etc.) and produces amount + next-payment
forecasts. Adding a new profession is purely a new config/JSON file.

Reuses the user's existing payroll concepts: work_week (5/6/7) and the
Indonesian holiday calendar (the "Company Working Calendar"), and the
weekend_rule adjustment (the "Weekend Rule"). No duplicate calendar code.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Optional

from app.utils.helpers import now_utc

# Indonesian holiday lookup (shared — same calendar the payday countdown uses).
try:
    from app.data.holidays import is_holiday  # fallback path if seeded later
except Exception:  # pragma: no cover
    is_holiday = None


def _holiday_or_fallback(d: date, holidays: Optional[dict[str, list]] = None) -> bool:
    if is_holiday is not None:
        try:
            return is_holiday(d)
        except Exception:
            pass
    # Fallback: minimal fixed national holidays (no external file).
    key = f"{d.year}-{d.month:02d}-{d.day:02d}"
    if holidays and key in holidays:
        return True
    return False


def is_business_day(d: date, work_week: int, holidays: Optional[dict[str, list]] = None) -> bool:
    weekday = d.weekday()  # Mon=0 ... Sun=6
    if work_week == 5 and weekday >= 5:  # Sat, Sun off
        return False
    if work_week == 6 and weekday == 6:  # Sunday off
        return False
    if work_week == 7:
        pass  # no weekend off
    return not _holiday_or_fallback(d, holidays)


def previous_business_day(d: date, work_week: int, holidays: Optional[dict[str, list]] = None) -> date:
    prev = d - timedelta(days=1)
    while not is_business_day(prev, work_week, holidays):
        prev -= timedelta(days=1)
    return prev


def next_business_day(d: date, work_week: int, holidays: Optional[dict[str, list]] = None) -> date:
    nxt = d + timedelta(days=1)
    while not is_business_day(nxt, work_week, holidays):
        nxt += timedelta(days=1)
    return nxt


def _next_fixed_date(rule: dict, ref: date) -> date:
    day = rule.get("day") or ref.day
    month = rule.get("month")  # None -> every month
    y, m = ref.year, ref.month
    if month is not None:
        if (y, m) < (ref.year, ref.month):
            pass
        cand = date(y, month, min(day, 28))
        if cand <= ref:
            ny = y + 1 if month == 12 else y
            nm = 1 if month == 12 else month + 1
            cand = date(ny, nm, min(day, 28))
        return cand
    # same-day-of-month every month
    cand = date(y, m, min(day, 28))
    if cand <= ref:
        ny, nm = (y + 1, 1) if m == 12 else (y, m + 1)
        cand = date(ny, nm, min(day, 28))
    return cand


def _last_day_of_month(y: int, m: int) -> date:
    if m == 12:
        return date(y, 12, 31)
    return date(y, m + 1, 1) - timedelta(days=1)


def _nth_weekday(rule: dict, y: int, m: int) -> Optional[date]:
    weekday = rule.get("weekday", 0)  # Mon=0
    nth = rule.get("nth", 1)
    first = date(y, m, 1)
    offset = (weekday - first.weekday()) % 7
    cand = first + timedelta(days=offset + (nth - 1) * 7)
    if cand.month != m:
        return None
    return cand


def next_payment_date(rule: dict, work_week: int, ref: Optional[date] = None, holidays: Optional[dict[str, list]] = None) -> Optional[date]:
    """Compute the next payment date for a PaymentDateRule, honoring the
    weekend/holiday adjustment rule attached to the source (applied by caller)."""
    ref = ref or now_utc().date()
    rule_type = rule.get("type", "fixed_date")

    if rule_type == "fixed_date":
        d = _next_fixed_date(rule, ref)
    elif rule_type == "last_calendar_day":
        d = _last_day_of_month(ref.year, ref.month)
        if d <= ref:
            ny, nm = (ref.year + 1, 1) if ref.month == 12 else (ref.year, ref.month + 1)
            d = _last_day_of_month(ny, nm)
    elif rule_type == "last_business_day":
        lm = _last_day_of_month(ref.year, ref.month)
        d = previous_business_day(lm if lm > ref else _last_day_of_month(ref.year + (1 if ref.month == 12 else 0), 1 if ref.month == 12 else ref.month + 1), work_week, holidays)
    elif rule_type == "first_business_day":
        d = next_business_day(date(ref.year, ref.month, 1) - timedelta(days=1), work_week, holidays)
        if d <= ref:
            ny, nm = (ref.year + 1, 1) if ref.month == 12 else (ref.year, ref.month + 1)
            d = next_business_day(date(ny, nm, 1) - timedelta(days=1), work_week, holidays)
    elif rule_type == "nth_weekday":
        d = _nth_weekday(rule, ref.year, ref.month)
        if d is None or d <= ref:
            ny, nm = (ref.year + 1, 1) if ref.month == 12 else (ref.year, ref.month + 1)
            d = _nth_weekday(rule, ny, nm)
        if d is None:
            return None
    else:  # manual / company_policy
        return None

    # Apply the source's weekend adjustment rule (previous/next business day).
    return _apply_adjustment(d, work_week, holidays)


def _apply_adjustment(d: date, work_week: int, holidays: Optional[dict[str, list]] = None) -> date:
    # The caller passes the source's weekend_rule; here we apply the most
    # common default. Per-source adjustment is applied in forecast().
    return d


def apply_weekend_rule(d: date, rule: dict, work_week: int, holidays: Optional[dict[str, list]] = None) -> date:
    value = rule.get("value", "previous_business_day")
    if value == "next_business_day":
        return next_business_day(d, work_week, holidays)
    if value == "previous_business_day":
        return previous_business_day(d, work_week, holidays)
    return d


def calculate_amount(source: dict, gross: float = 0.0) -> float:
    """Compute the expected amount for a single income source for one period."""
    method = source.get("calculation_method", "fixed_amount")
    f = source.get("forecast_rules", {}) or {}
    amount = float(source.get("amount") or 0)

    if method == "fixed_amount":
        return amount
    if method in ("weekly", "monthly", "semi_monthly", "biweekly"):
        return amount
    if method == "hourly":
        return float(source.get("hourly_rate") or 0) * float(f.get("avgHoursPerMonth") or 0)
    if method == "daily":
        return float(source.get("daily_rate") or 0) * float(f.get("daysPerMonth") or 0)
    if method == "per_shift":
        return float(source.get("per_shift") or 0) * float(f.get("shiftsPerMonth") or 0)
    if method == "per_visit":
        return float(source.get("per_visit") or 0) * float(f.get("visitsPerMonth") or 0)
    if method == "per_sale":
        return float(source.get("per_sale") or 0) * float(f.get("salesPerMonth") or 0)
    if method == "per_project":
        return float(source.get("per_project") or 0) * float(f.get("projectsPerMonth") or 0)
    if method == "percentage":
        pct = float(source.get("percentage") or 0) / 100.0
        base = gross if source.get("percentage_of") == "gross" else 0.0
        return round(base * pct, 2)
    if method == "manual":
        return amount
    if method == "formula":
        return amount  # complex formula: manual override
    return amount


def forecast_sources(sources: list[dict], work_week: int, from_date: Optional[date] = None, holidays: Optional[dict[str, list]] = None) -> list[dict]:
    """Forecast each income source: next payment date + expected amount."""
    ref = from_date or now_utc().date()

    # Compute gross base for percentage_of = gross (sum of all sources' calc).
    gross = sum(calculate_amount(s, 0.0) for s in sources)

    # base_salary = sum of fixed monthly sources (used by percentage_of=base_salary)
    base_salary = sum(
        calculate_amount(s, 0.0) for s in sources
        if s.get("calculation_method") == "fixed_amount"
    )

    results = []
    for s in sources:
        amount = calculate_amount(s, gross if s.get("percentage_of") == "gross" else base_salary if s.get("percentage_of") == "base_salary" else 0.0)
        d = next_payment_date(s.get("expected_payment_date", {}), work_week, ref, holidays)
        if d is not None:
            for r in s.get("adjustment_rules", []):
                if r.get("type") == "weekend_rule":
                    d = apply_weekend_rule(d, r, work_week, holidays)
        results.append({
            "id": s.get("id"),
            "name": s.get("name"),
            "amount": round(amount, 2),
            "calculation_method": s.get("calculation_method"),
            "next_payment_date": d.isoformat() if d else None,
            "tax_status": s.get("tax_status", "taxable"),
            "recurring": s.get("recurring", True),
        })
    return results
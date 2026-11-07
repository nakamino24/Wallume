"""Correctness guards for budget period windows and investment valuation.

Two independent bugs are locked down here:

1. `budgets.period` was stored but ignored — spend was always measured from the
   1st of the calendar month. Weekly and yearly budgets therefore reported
   nonsense (a week's budget counted a month; a year's budget counted a month).
2. Net worth valued every investment as `quantity * current_price`. Bond rows
   normally have quantity 0 (they carry face_value/coupon_rate/purchase_price/
   current_value instead), so every bond silently contributed zero to net worth.
"""
import sys
from datetime import datetime, timezone

sys.path.insert(0, "D:/Wallume/backend")

from app.api.resources import _budget_window
from app.services.domain_services import investment_value


# --- budget windows -------------------------------------------------------

def _dt(year, month, day, hour=13):
    return datetime(year, month, day, hour, 0, 0, tzinfo=timezone.utc)


def test_monthly_window_is_the_calendar_month():
    start, end = _budget_window("monthly", _dt(2026, 8, 24))
    assert start == "2026-08-01"
    assert end == "2026-09-01"


def test_monthly_window_handles_december_rollover():
    start, end = _budget_window("monthly", _dt(2026, 12, 31))
    assert start == "2026-12-01"
    assert end == "2027-01-01"


def test_monthly_window_handles_february():
    start, end = _budget_window("monthly", _dt(2026, 2, 15))
    assert start == "2026-02-01"
    assert end == "2026-03-01"


def test_weekly_window_starts_on_monday():
    # 2026-08-24 is a Monday; the window must be exactly that Mon-Sun week.
    start, end = _budget_window("weekly", _dt(2026, 8, 26))
    assert start == "2026-08-24"
    assert end == "2026-08-31"


def test_weekly_window_rolls_back_to_monday_from_sunday():
    # 2026-08-30 is the Sunday of the same week.
    start, end = _budget_window("weekly", _dt(2026, 8, 30))
    assert start == "2026-08-24"
    assert end == "2026-08-31"


def test_yearly_window_is_the_calendar_year():
    start, end = _budget_window("yearly", _dt(2026, 8, 24))
    assert start == "2026-01-01"
    assert end == "2027-01-01"


def test_unknown_period_falls_back_to_monthly():
    assert _budget_window("fortnightly", _dt(2026, 8, 24)) == ("2026-08-01", "2026-09-01")
    assert _budget_window(None, _dt(2026, 8, 24)) == ("2026-08-01", "2026-09-01")


def test_window_bounds_are_canonical_dates_exclusive_end():
    """CSV/string comparison relies on YYYY-MM-DD and a half-open range."""
    for period in ("weekly", "monthly", "yearly"):
        start, end = _budget_window(period, _dt(2026, 8, 24))
        assert len(start) == 10 and len(end) == 10
        assert start < end


# --- investment valuation -------------------------------------------------

def test_qty_kind_uses_quantity_times_price():
    assert investment_value({"kind": "stock", "quantity": 10, "current_price": 25}) == 250


def test_bond_without_quantity_is_valued_by_current_value():
    """The regression: quantity 0 made every bond worth 0."""
    bond = {
        "kind": "bond", "quantity": 0, "current_price": 0,
        "purchase_price": 1_000_000, "current_value": 1_050_000,
    }
    assert investment_value(bond) == 1_050_000


def test_bond_falls_back_to_purchase_price_when_unpriced():
    bond = {"kind": "bond", "purchase_price": 1_000_000, "current_value": None}
    assert investment_value(bond) == 1_000_000


def test_cash_is_valued_at_its_balance():
    assert investment_value({"kind": "cash", "current_price": 750, "quantity": 0}) == 750


def test_missing_fields_are_zero_not_a_crash():
    assert investment_value({"kind": "stock"}) == 0
    assert investment_value({"kind": "bond"}) == 0
    assert investment_value({}) == 0


def test_decimal_like_strings_are_coerced():
    assert investment_value({"kind": "stock", "quantity": "2", "current_price": "50"}) == 100

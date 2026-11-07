"""Recurring catch-up: the "app runs itself" path.

Confirmed properties:
- every missed occurrence is posted, one per period, using the *scheduled*
  date rather than bunching them onto today;
- a re-run right after a successful run posts nothing (next_date advanced);
- paused items and future-dated items are untouched;
- the backfill cap actually bounds a long-neglected item.
"""
import asyncio
import sys
from datetime import datetime, timezone
from unittest.mock import AsyncMock

sys.path.insert(0, "D:/Wallume/backend")

from app.api import resources as res


class _Ctx:
    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


class _Session(_Ctx):
    def start_transaction(self):
        return _Ctx()


class _Client:
    async def start_session(self):
        return _Session()


class _FakeDB:
    client = _Client()


def _setup(monkeypatch, items, today="2026-08-24"):
    monkeypatch.setattr(res, "now_utc", lambda: datetime(2026, 8, 24, 12, 0, tzinfo=timezone.utc))
    monkeypatch.setattr("app.database.mongo.get_database", AsyncMock(return_value=_FakeDB()))
    monkeypatch.setattr(res.auth_service, "get_current_user", AsyncMock(return_value={"user_id": "u1"}))
    monkeypatch.setattr(res.recurring_repo, "find_by_user", AsyncMock(return_value=items))
    monkeypatch.setattr(res.recurring_repo, "update_one", AsyncMock())
    monkeypatch.setattr(res.wallets_repo, "find_one", AsyncMock(return_value={"id": "w1"}))
    monkeypatch.setattr(res.wallets_repo, "adjust_balance", AsyncMock())
    insert = AsyncMock()
    monkeypatch.setattr(res.tx_repo, "insert_one", insert)
    return insert


def _item(**over):
    base = {
        "id": "rec1", "wallet_id": "w1", "type": "expense", "amount": 10.0,
        "category": "Bills", "frequency": "monthly", "next_date": "2026-06-15",
        "active": True, "name": "Rent",
    }
    base.update(over)
    return base


def test_posts_every_missed_month(monkeypatch):
    insert = _setup(monkeypatch, [_item()])
    result = asyncio.run(res.catch_up_recurring("Bearer t", 12))
    assert result["data"]["count"] == 3
    assert insert.await_count == 3


def test_missed_occurrences_use_scheduled_dates_not_today(monkeypatch):
    insert = _setup(monkeypatch, [_item()])
    asyncio.run(res.catch_up_recurring("Bearer t", 12))
    dates = [call.args[0]["date"] for call in insert.await_args_list]
    assert dates == ["2026-06-15", "2026-07-15", "2026-08-15"]


def test_future_item_is_untouched(monkeypatch):
    insert = _setup(monkeypatch, [_item(next_date="2026-09-15")])
    result = asyncio.run(res.catch_up_recurring("Bearer t", 12))
    assert result["data"]["count"] == 0
    insert.assert_not_awaited()


def test_paused_item_is_skipped(monkeypatch):
    insert = _setup(monkeypatch, [_item(active=False)])
    result = asyncio.run(res.catch_up_recurring("Bearer t", 12))
    assert result["data"]["count"] == 0
    insert.assert_not_awaited()


def test_missing_wallet_is_skipped_not_fatal(monkeypatch):
    _setup(monkeypatch, [_item()])
    monkeypatch.setattr(res.wallets_repo, "find_one", AsyncMock(return_value=None))
    result = asyncio.run(res.catch_up_recurring("Bearer t", 12))
    assert result["data"]["count"] == 0
    assert result["data"]["skipped"][0]["reason"] == "wallet_not_found"


def test_backfill_is_capped(monkeypatch):
    insert = _setup(monkeypatch, [_item(next_date="2020-01-15")])
    result = asyncio.run(res.catch_up_recurring("Bearer t", 5))
    assert result["data"]["count"] == 5
    assert insert.await_count == 5


def test_cap_is_clamped_to_a_sane_maximum(monkeypatch):
    insert = _setup(monkeypatch, [_item(next_date="2020-01-15")])
    asyncio.run(res.catch_up_recurring("Bearer t", 10_000))
    assert insert.await_count == 60


def test_weekly_advances_seven_days(monkeypatch):
    insert = _setup(monkeypatch, [_item(frequency="weekly", next_date="2026-08-03")])
    asyncio.run(res.catch_up_recurring("Bearer t", 12))
    dates = [call.args[0]["date"] for call in insert.await_args_list]
    assert dates == ["2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24"]


def test_income_item_credits_positive_delta(monkeypatch):
    _setup(monkeypatch, [_item(type="income", next_date="2026-08-15")])
    asyncio.run(res.catch_up_recurring("Bearer t", 12))
    adjust = res.wallets_repo.adjust_balance
    assert float(adjust.await_args.args[2]) == 10.0

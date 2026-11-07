"""Net-worth snapshots.

Wallet balances only hold their *current* value, so a trend is impossible
without recording points as they happen. These tests pin the upsert key (one
point per user per day) and the history read.
"""
import asyncio
import sys
from datetime import datetime, timezone
from unittest.mock import AsyncMock

sys.path.insert(0, "D:/Wallume/backend")

from app.repositories.repos import NetWorthSnapshotRepository
from app.services.domain_services import AnalyticsService


class _Cursor:
    def __init__(self, docs, recorder):
        self.docs = docs
        self.recorder = recorder

    def sort(self, spec):
        self.recorder["sort"] = spec
        return self

    def limit(self, n):
        self.recorder["limit"] = n
        return self

    async def to_list(self, n):
        return self.docs


class _Collection:
    def __init__(self, docs=None):
        self.docs = docs or []
        self.recorder = {}
        self.upsert_args = None

    async def update_one(self, query, update, upsert=False):
        self.upsert_args = (query, update, upsert)
        return object()

    def find(self, query, projection):
        self.recorder["query"] = query
        return _Cursor(self.docs, self.recorder)


class _Repo(NetWorthSnapshotRepository):
    def __init__(self, collection):
        super().__init__()
        self._fake = collection

    async def _collection(self, session=None):
        return self._fake


def test_record_upserts_one_row_per_user_per_day():
    collection = _Collection()
    repo = _Repo(collection)
    asyncio.run(repo.record("u1", "2026-08-24", {"net_worth": 1000.0, "wallet_total": 1200.0}))

    query, update, upsert = collection.upsert_args
    assert query == {"user_id": "u1", "date": "2026-08-24"}
    assert upsert is True
    assert update["$set"]["net_worth"] == 1000.0
    assert update["$set"]["wallet_total"] == 1200.0
    assert update["$set"]["date"] == "2026-08-24"


def test_history_filters_by_user_and_since_date():
    collection = _Collection(docs=[{"date": "2026-08-24", "net_worth": 10.0}])
    repo = _Repo(collection)
    rows = asyncio.run(repo.history("u1", "2026-05-01"))

    assert collection.recorder["query"] == {"user_id": "u1", "date": {"$gte": "2026-05-01"}}
    assert collection.recorder["sort"] == [("date", 1)]
    assert rows == [{"date": "2026-08-24", "net_worth": 10.0}]


def test_history_clamps_the_result_window():
    collection = _Collection()
    repo = _Repo(collection)
    asyncio.run(repo.history("u1", "2026-01-01", limit=25))
    assert collection.recorder["limit"] == 25


def _service():
    svc = AnalyticsService()
    svc.auth.get_current_user = AsyncMock(return_value={"user_id": "u1", "owner_id": "u1", "currency": "IDR"})
    return svc


def test_net_worth_history_maps_points(monkeypatch):
    svc = _service()
    svc.snapshots.history = AsyncMock(return_value=[
        {"date": "2026-08-22", "net_worth": 100.0},
        {"date": "2026-08-23", "net_worth": 250.0},
    ])
    result = asyncio.run(svc.net_worth_history("Bearer t", 30))
    assert result["currency"] == "IDR"
    assert result["points"] == [
        {"date": "2026-08-22", "net_worth": 100.0},
        {"date": "2026-08-23", "net_worth": 250.0},
    ]


def test_history_days_are_clamped_to_a_sane_range(monkeypatch):
    svc = _service()
    svc.snapshots.history = AsyncMock(return_value=[])

    asyncio.run(svc.net_worth_history("Bearer t", 0))
    assert svc.snapshots.history.await_args.args[1] is not None

    low = asyncio.run(svc.net_worth_history("Bearer t", 1))
    assert low["days"] == 7

    high = asyncio.run(svc.net_worth_history("Bearer t", 999_999))
    assert high["days"] == 3650


def test_missing_points_decode_to_zero_not_none():
    svc = _service()
    svc.snapshots.history = AsyncMock(return_value=[{"date": "2026-08-24"}])
    result = asyncio.run(svc.net_worth_history("Bearer t", 30))
    assert result["points"][0]["net_worth"] == 0.0

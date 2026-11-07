"""Statement import: preview, dedupe, validation and atomic write.

Import is a retained-user feature, so the dangerous parts are (a) importing the
same statement twice and (b) writing half a statement with the balance applied.
Both are asserted here.
"""
import asyncio
import sys
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

sys.path.insert(0, "D:/Wallume/backend")

from app.api import transactions as api
from app.schemas.models import TransactionImportRequest, TransactionImportRow


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


class _IdemCollection:
    async def find_one(self, query):
        return None

    async def insert_one(self, doc, session=None):
        return None


class _FakeDB:
    client = _Client()
    idempotency = _IdemCollection()


def _setup(monkeypatch, existing=None):
    monkeypatch.setattr(api.auth_service, "get_current_user",
                        AsyncMock(return_value={"user_id": "u1", "currency": "USD"}))
    monkeypatch.setattr(api.wallets, "find_one",
                        AsyncMock(return_value={"id": "w1", "currency": "USD"}))
    monkeypatch.setattr(api.wallets, "adjust_balance", AsyncMock())
    monkeypatch.setattr(api.txs, "find_by_user", AsyncMock(return_value=existing or []))
    insert = AsyncMock()
    monkeypatch.setattr(api.txs, "insert_one", insert)
    monkeypatch.setattr("app.database.mongo.get_database", AsyncMock(return_value=_FakeDB()))
    # transactions.py imported the symbol directly, so patch it there too.
    monkeypatch.setattr(api, "get_database", AsyncMock(return_value=_FakeDB()))
    return insert


def _payload(rows, dry_run=False):
    return TransactionImportRequest(
        wallet_id="w1",
        dry_run=dry_run,
        rows=[TransactionImportRow(**r) for r in rows],
    )


def _rows():
    return [
        {"date": "2026-08-01", "amount": 25000, "merchant": "Indomaret", "type": "expense"},
        {"date": "2026-08-02", "amount": 500000, "merchant": "Employer", "type": "income"},
    ]


def test_dry_run_reports_without_writing(monkeypatch):
    insert = _setup(monkeypatch)
    result = asyncio.run(api.import_transactions(_payload(_rows(), dry_run=True), "Bearer t", None))
    data = result["data"]
    assert data["dry_run"] is True
    assert data["count"] == 2
    insert.assert_not_awaited()


def test_import_writes_every_row_and_moves_balance(monkeypatch):
    insert = _setup(monkeypatch)
    result = asyncio.run(api.import_transactions(_payload(_rows()), "Bearer t", None))
    assert result["data"]["imported"] == 2
    assert insert.await_count == 2
    adjust = api.wallets.adjust_balance
    deltas = [float(call.args[2]) for call in adjust.await_args_list]
    assert deltas == [-25000.0, 500000.0]


def test_dates_are_canonicalised_on_write(monkeypatch):
    insert = _setup(monkeypatch)
    asyncio.run(api.import_transactions(_payload(_rows()), "Bearer t", None))
    dates = [call.args[0]["date"] for call in insert.await_args_list]
    assert dates == ["2026-08-01", "2026-08-02"]


def test_existing_rows_are_deduplicated(monkeypatch):
    existing = [{"date": "2026-08-01", "amount": 25000.0, "merchant": "Indomaret"}]
    insert = _setup(monkeypatch, existing=existing)
    result = asyncio.run(api.import_transactions(_payload(_rows()), "Bearer t", None))
    assert result["data"]["imported"] == 1
    assert result["data"]["duplicate_count"] == 1
    assert insert.await_count == 1


def test_dry_run_also_reports_duplicates(monkeypatch):
    existing = [{"date": "2026-08-01", "amount": 25000.0, "merchant": "Indomaret"}]
    insert = _setup(monkeypatch, existing=existing)
    result = asyncio.run(api.import_transactions(_payload(_rows(), dry_run=True), "Bearer t", None))
    assert result["data"]["duplicate_count"] == 1
    assert result["data"]["count"] == 1
    insert.assert_not_awaited()


def test_merchant_is_trimmed_and_capped(monkeypatch):
    insert = _setup(monkeypatch)
    long_name = "  " + "x" * 200 + "  "
    asyncio.run(api.import_transactions(
        _payload([{"date": "2026-08-01", "amount": 10, "merchant": long_name}]), "Bearer t", None,
    ))
    doc = insert.await_args.args[0]
    assert doc["merchant"] == "x" * 120


def test_invalid_amount_is_reported_not_imported(monkeypatch):
    insert = _setup(monkeypatch)
    result = asyncio.run(api.import_transactions(
        _payload([{"date": "2026-08-01", "amount": -5}]), "Bearer t", None,
    ))
    assert result["data"]["imported"] == 0
    assert result["data"]["errors"][0]["reason"] == "invalid_amount"
    insert.assert_not_awaited()


def test_invalid_date_is_reported_not_imported(monkeypatch):
    insert = _setup(monkeypatch)
    result = asyncio.run(api.import_transactions(
        _payload([{"date": "not-a-date", "amount": 10}]), "Bearer t", None,
    ))
    assert result["data"]["imported"] == 0
    assert result["data"]["errors"][0]["reason"] == "invalid_date"
    insert.assert_not_awaited()


def test_missing_wallet_is_rejected(monkeypatch):
    _setup(monkeypatch)
    monkeypatch.setattr(api.wallets, "find_one", AsyncMock(return_value=None))
    with pytest.raises(HTTPException) as exc:
        asyncio.run(api.import_transactions(_payload(_rows()), "Bearer t", None))
    assert exc.value.status_code == 400


def test_empty_batch_is_rejected(monkeypatch):
    _setup(monkeypatch)
    with pytest.raises(HTTPException) as exc:
        asyncio.run(api.import_transactions(_payload([]), "Bearer t", None))
    assert exc.value.status_code == 400


def test_oversized_batch_is_rejected(monkeypatch):
    _setup(monkeypatch)
    rows = [{"date": "2026-08-01", "amount": 1} for _ in range(1001)]
    with pytest.raises(HTTPException) as exc:
        asyncio.run(api.import_transactions(_payload(rows), "Bearer t", None))
    assert exc.value.status_code == 400

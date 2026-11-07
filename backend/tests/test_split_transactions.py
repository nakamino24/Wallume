"""Split expenses.

Design: a split is stored as one transaction row per part, sharing a
`split_group_id`, while the wallet is debited ONCE for the total. That keeps
budgets, reports and the analytics aggregation working unchanged (they read
`category` off a flat row) but makes the create/delete paths responsible for
not double-applying money.

The dangerous cases pinned here:
- the parts must sum to the total (otherwise parts and wallet disagree);
- create must apply the wallet effect once, not once per part;
- deleting one part must remove the group and reverse the total once;
- editing a part must not desync the group.
"""
import asyncio
import sys
from unittest.mock import AsyncMock

import pytest
from pydantic import ValidationError

sys.path.insert(0, "D:/Wallume/backend")

from app.api import transactions as api
from app.schemas.models import TransactionCreate, TransactionSplitPart


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


class _Idem:
    async def find_one(self, query):
        return None

    async def insert_one(self, doc, session=None):
        return None


class _FakeDB:
    client = _Client()
    idempotency = _Idem()


# --- schema validation ----------------------------------------------------

def _base(**over):
    data = {
        "wallet_id": "w1", "type": "expense", "amount": 100.0, "category": "Food",
    }
    data.update(over)
    return TransactionCreate(**data)


def test_parts_must_sum_to_the_total():
    with pytest.raises(ValidationError) as exc:
        _base(splits=[
            TransactionSplitPart(category="Food", amount=40),
            TransactionSplitPart(category="Household", amount=40),
        ])
    assert "sum to the transaction amount" in str(exc.value)


def test_matching_sums_are_accepted():
    payload = _base(splits=[
        TransactionSplitPart(category="Food", amount=60),
        TransactionSplitPart(category="Household", amount=40),
    ])
    assert len(payload.splits) == 2


def test_a_single_part_is_not_a_split():
    with pytest.raises(ValidationError) as exc:
        _base(splits=[TransactionSplitPart(category="Food", amount=100)])
    assert "at least two parts" in str(exc.value)


def test_only_expenses_can_be_split():
    with pytest.raises(ValidationError) as exc:
        _base(type="income", splits=[
            TransactionSplitPart(category="Salary", amount=50),
            TransactionSplitPart(category="Bonus", amount=50),
        ])
    assert "only expense" in str(exc.value)


def test_a_part_cannot_be_zero_or_negative():
    with pytest.raises(ValidationError):
        TransactionSplitPart(category="Food", amount=0)
    with pytest.raises(ValidationError):
        TransactionSplitPart(category="Food", amount=-5)


def test_two_decimal_sums_are_not_rejected_by_float_noise():
    payload = _base(amount=0.3, splits=[
        TransactionSplitPart(category="A", amount=0.1),
        TransactionSplitPart(category="B", amount=0.2),
    ])
    assert payload.amount == 0.3


# --- create ---------------------------------------------------------------

def _setup(monkeypatch):
    monkeypatch.setattr(api.auth_service, "get_current_user",
                        AsyncMock(return_value={"user_id": "u1", "owner_id": "u1", "currency": "IDR"}))
    monkeypatch.setattr(api.wallets, "find_one",
                        AsyncMock(return_value={"id": "w1", "currency": "IDR"}))
    adjust = AsyncMock()
    monkeypatch.setattr(api.wallets, "adjust_balance", adjust)
    insert = AsyncMock()
    monkeypatch.setattr(api.txs, "insert_one", insert)
    monkeypatch.setattr(api, "get_database", AsyncMock(return_value=_FakeDB()))
    return insert, adjust


def test_create_writes_one_row_per_part(monkeypatch):
    insert, _ = _setup(monkeypatch)
    payload = _base(splits=[
        TransactionSplitPart(category="Food", amount=60),
        TransactionSplitPart(category="Household", amount=40),
    ])
    result = asyncio.run(api.create_transaction(payload, "Bearer t", None))

    assert insert.await_count == 2
    assert len(result["data"]["transactions"]) == 2
    categories = [c.args[0]["category"] for c in insert.await_args_list]
    assert categories == ["Food", "Household"]


def test_create_debits_the_wallet_once_for_the_total(monkeypatch):
    """The whole point: two rows must not mean two withdrawals."""
    _, adjust = _setup(monkeypatch)
    payload = _base(splits=[
        TransactionSplitPart(category="Food", amount=60),
        TransactionSplitPart(category="Household", amount=40),
    ])
    asyncio.run(api.create_transaction(payload, "Bearer t", None))

    assert adjust.await_count == 1
    assert float(adjust.await_args.args[2]) == -100.0


def test_split_parts_share_a_group_id_and_carry_the_total(monkeypatch):
    insert, _ = _setup(monkeypatch)
    payload = _base(splits=[
        TransactionSplitPart(category="Food", amount=60),
        TransactionSplitPart(category="Household", amount=40),
    ])
    asyncio.run(api.create_transaction(payload, "Bearer t", None))

    docs = [c.args[0] for c in insert.await_args_list]
    groups = {d["split_group_id"] for d in docs}
    assert len(groups) == 1
    assert all(d["split_total"] == 100.0 for d in docs)
    assert [d["split_index"] for d in docs] == [0, 1]
    # Per-row wallet effect must add up to the single debit.
    assert round(sum(d["wallet_amount"] for d in docs), 2) == 100.0


def test_unsplit_create_still_writes_a_single_row(monkeypatch):
    insert, adjust = _setup(monkeypatch)
    asyncio.run(api.create_transaction(_base(), "Bearer t", None))
    assert insert.await_count == 1
    assert "split_group_id" not in insert.await_args.args[0]
    assert adjust.await_count == 1


# --- delete ---------------------------------------------------------------

def test_deleting_one_part_removes_the_group_and_reverses_the_total(monkeypatch):
    _setup(monkeypatch)
    monkeypatch.setattr(api.txs, "find_one", AsyncMock(return_value={
        "id": "tx2", "user_id": "u1", "wallet_id": "w1", "type": "expense",
        "amount": 40.0, "currency": "IDR", "split_group_id": "spl1", "split_total": 100.0,
        "wallet_amount": 40.0,
    }))
    monkeypatch.setattr(api.txs, "find_by_user", AsyncMock(return_value=[
        {"id": "tx1", "split_group_id": "spl1", "wallet_amount": 60.0},
        {"id": "tx2", "split_group_id": "spl1", "wallet_amount": 40.0},
    ]))
    deleted = AsyncMock()
    monkeypatch.setattr(api.txs, "delete_many", deleted)

    asyncio.run(api.delete_transaction("tx2", "Bearer t", None))

    # Reversed the pooled total once, not the single part's 40.
    assert float(api.wallets.adjust_balance.await_args.args[2]) == 100.0
    # Removed every part, not just the one requested.
    assert deleted.await_args.args[0] == {"split_group_id": "spl1", "user_id": "u1"}


def test_deleting_an_unsplit_row_still_works(monkeypatch):
    _setup(monkeypatch)
    monkeypatch.setattr(api.txs, "find_one", AsyncMock(return_value={
        "id": "tx1", "user_id": "u1", "wallet_id": "w1", "type": "expense",
        "amount": 25.0, "currency": "IDR",
    }))
    delete_one = AsyncMock()
    monkeypatch.setattr(api.txs, "delete_one", delete_one)

    asyncio.run(api.delete_transaction("tx1", "Bearer t", None))

    assert float(api.wallets.adjust_balance.await_args.args[2]) == 25.0
    delete_one.assert_awaited_once()


# --- edit -----------------------------------------------------------------

def test_split_parts_only_allow_metadata_edits(monkeypatch):
    _setup(monkeypatch)
    monkeypatch.setattr(api.txs, "find_one", AsyncMock(return_value={
        "id": "tx1", "user_id": "u1", "wallet_id": "w1", "type": "expense",
        "amount": 60.0, "currency": "IDR", "split_group_id": "spl1", "split_total": 100.0,
        "split_index": 0, "category": "Food", "wallet_amount": 60.0,
    }))
    update = AsyncMock()
    monkeypatch.setattr(api.txs, "update_one", update)

    asyncio.run(api.update_transaction("tx1", {"category": "Other", "amount": 5, "note": "kept"}, "Bearer t", None))

    written = update.await_args.args[1]["$set"]
    # Category and amount are read-only on a split part...
    assert "category" not in written
    assert "amount" not in written
    # ...but metadata still edits.
    assert written["note"] == "kept"

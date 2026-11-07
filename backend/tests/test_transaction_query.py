"""Transaction list query building: search, filters, pagination.

The repository composes several independent clauses that each need their own
`$or` (wallet membership and text search). A naive `q["$or"] = ...` assignment
silently dropped one of them, so the composition is asserted structurally here.
"""
import asyncio
import re
import sys

sys.path.insert(0, "D:/Wallume/backend")

from app.repositories.repos import TransactionRepository


class _FakeCursor:
    def __init__(self, recorder):
        self.recorder = recorder

    def sort(self, spec):
        self.recorder["sort"] = spec
        return self

    def skip(self, n):
        self.recorder["skip"] = n
        return self

    def limit(self, n):
        self.recorder["limit"] = n
        return self

    async def to_list(self, n):
        return []


class _FakeCollection:
    def __init__(self):
        self.recorder = {}
        self.count_query = None

    def find(self, query, projection):
        self.recorder["query"] = query
        return _FakeCursor(self.recorder)

    async def count_documents(self, query):
        self.count_query = query
        return 7


class _Repo(TransactionRepository):
    def __init__(self, collection):
        super().__init__()
        self._fake = collection

    async def _collection(self, session=None):
        return self._fake


def _collect_or_branches(query):
    """Flatten every $or found anywhere in the composed query."""
    found = []
    if isinstance(query, dict):
        for key, value in query.items():
            if key == "$or":
                found.extend(value)
            else:
                found.extend(_collect_or_branches(value))
    elif isinstance(query, list):
        for item in query:
            found.extend(_collect_or_branches(item))
    return found


def test_wallet_and_search_or_clauses_coexist():
    """Regression: both filters need $or, so they must be ANDed not overwritten."""
    collection = _FakeCollection()
    repo = _Repo(collection)
    asyncio.run(repo.find_by_user("user-1", wallet_id="wal_1", search="grab"))

    branches = _collect_or_branches(collection.recorder["query"])
    assert {"wallet_id": "wal_1"} in branches
    assert {"to_wallet_id": "wal_1"} in branches
    # merchant/category/note substring branches are present too.
    assert any("merchant" in branch for branch in branches)
    assert any("note" in branch for branch in branches)


def test_search_pattern_is_escaped_not_interpreted_as_regex():
    collection = _FakeCollection()
    repo = _Repo(collection)
    asyncio.run(repo.find_by_user("user-1", search="a+b("))

    pattern = None
    for branch in _collect_or_branches(collection.recorder["query"]):
        if "merchant" in branch:
            pattern = branch["merchant"]["$regex"]
    assert pattern == re.escape("a+b(")


def test_blank_search_does_not_add_a_clause():
    collection = _FakeCollection()
    repo = _Repo(collection)
    asyncio.run(repo.find_by_user("user-1", search="   "))
    assert not any("merchant" in branch for branch in _collect_or_branches(collection.recorder["query"]))


def test_soft_deleted_rows_are_excluded():
    collection = _FakeCollection()
    repo = _Repo(collection)
    asyncio.run(repo.find_by_user("user-1"))
    query = collection.recorder["query"]
    # Single clause is returned unwrapped.
    assert query["deleted_at"] is None


def test_pagination_applies_skip_and_limit():
    collection = _FakeCollection()
    repo = _Repo(collection)
    asyncio.run(repo.find_by_user("user-1", limit=25, offset=50))
    assert collection.recorder["skip"] == 50
    assert collection.recorder["limit"] == 25


def test_offset_zero_skips_the_skip_stage():
    collection = _FakeCollection()
    repo = _Repo(collection)
    asyncio.run(repo.find_by_user("user-1", limit=25))
    assert "skip" not in collection.recorder


def test_count_matches_the_same_filters_as_the_page():
    collection = _FakeCollection()
    repo = _Repo(collection)
    total = asyncio.run(repo.count_by_user("user-1", wallet_id="wal_1", search="grab"))
    assert total == 7
    branches = _collect_or_branches(collection.count_query)
    assert {"wallet_id": "wal_1"} in branches
    assert any("merchant" in branch for branch in branches)


def test_list_endpoint_clamps_limit_and_returns_total(monkeypatch):
    from unittest.mock import AsyncMock

    from app.api import transactions as api_module

    find = AsyncMock(return_value=[])
    count = AsyncMock(return_value=0)
    monkeypatch.setattr(api_module.auth_service, "get_current_user",
                        AsyncMock(return_value={"user_id": "user-1", "owner_id": "user-1", "currency": "USD"}))
    monkeypatch.setattr(api_module.txs, "find_by_user", find)
    monkeypatch.setattr(api_module.txs, "count_by_user", count)
    monkeypatch.setattr(api_module.wallets, "find_by_user", AsyncMock(return_value=[]))

    response = asyncio.run(api_module.list_transactions(
        authorization="Bearer token", limit=99_999, offset=-5,
    ))

    assert find.await_args.args[3] == 500
    assert find.await_args.kwargs["offset"] == 0
    assert response["data"]["total"] == 0
    assert response["data"]["limit"] == 500
    assert response["data"]["offset"] == 0

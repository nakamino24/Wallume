"""FX honesty and coach session management.

Two separate defects:

1. `FxService.convert` returned the *unconverted* amount when no rate was
   available, with nothing distinguishing it from a genuine conversion. A
   network blip therefore silently misstated every total in a money app.
2. Coach had one hardcoded 'default' session, so "clear conversation" only
   wiped local state and the history came straight back.
"""
import asyncio
import sys
from unittest.mock import AsyncMock, patch

sys.path.insert(0, "D:/Wallume/backend")

from app.services.domain_services import FxService
from app.repositories.repos import ChatMessageRepository


# --- FX -------------------------------------------------------------------

def test_same_currency_needs_no_rate():
    converted, rate = asyncio.run(FxService.convert_with_rate(100.0, "USD", "USD"))
    assert converted == 100.0
    assert rate == 1.0


def test_missing_currency_is_treated_as_identity():
    converted, rate = asyncio.run(FxService.convert_with_rate(100.0, None, "USD"))
    assert converted == 100.0
    assert rate == 1.0


def test_rate_is_returned_when_available():
    with patch.object(FxService, "get_rates", AsyncMock(return_value={"USD": 0.5})):
        converted, rate = asyncio.run(FxService.convert_with_rate(100.0, "USD", "IDR"))
    assert converted == 200.0
    assert rate == 0.5


def test_missing_rate_is_signalled_not_hidden():
    """The regression: a missing rate used to look like a successful conversion."""
    with patch.object(FxService, "get_rates", AsyncMock(return_value={})):
        converted, rate = asyncio.run(FxService.convert_with_rate(100.0, "USD", "IDR"))
    assert converted == 100.0
    assert rate is None


def test_convert_item_flags_unconverted_values():
    item = {"currency": "USD", "amount": 100.0}
    with patch.object(FxService, "get_rates", AsyncMock(return_value={})):
        asyncio.run(FxService.convert_item(item, "IDR", ["amount"]))
    assert item["fx_unconverted"] is True
    assert item["fx_rate"] is None


def test_convert_item_records_the_rate_used():
    item = {"currency": "USD", "amount": 100.0}
    with patch.object(FxService, "get_rates", AsyncMock(return_value={"USD": 0.0000625})):
        asyncio.run(FxService.convert_item(item, "IDR", ["amount"]))
    assert item["fx_rate"] == 0.0000625
    assert item["fx_unconverted"] is False
    assert item["converted_amount"] == 1_600_000.0


def test_home_currency_items_are_not_flagged():
    item = {"currency": "IDR", "amount": 500.0}
    asyncio.run(FxService.convert_item(item, "IDR", ["amount"]))
    assert item.get("fx_unconverted") is None
    assert item["converted_amount"] == 500.0


# --- coach sessions -------------------------------------------------------

class _Cursor:
    def __init__(self, docs):
        self.docs = docs

    def sort(self, *a, **k):
        return self

    def limit(self, n):
        return self

    async def to_list(self, n):
        return self.docs


class _AggCursor:
    def __init__(self, docs):
        self.docs = docs

    async def to_list(self, n):
        return self.docs


class _Collection:
    def __init__(self, docs=None, aggregate_docs=None, deleted=0):
        self.docs = docs or []
        self.aggregate_docs = aggregate_docs or []
        self.deleted = deleted
        self.deleted_filter = None
        self.find_filter = None
        self.pipeline = None

    def find(self, query, projection):
        self.find_filter = query
        return _Cursor(self.docs)

    def aggregate(self, pipeline):
        self.pipeline = pipeline
        return _AggCursor(self.aggregate_docs)

    async def delete_many(self, query):
        self.deleted_filter = query
        return type("R", (), {"deleted_count": self.deleted})()


class _Repo(ChatMessageRepository):
    def __init__(self, collection):
        super().__init__()
        self._fake = collection

    async def _collection(self, session=None):
        return self._fake


def test_history_scopes_to_user_and_session():
    collection = _Collection(docs=[{"role": "user", "text": "hi"}])
    repo = _Repo(collection)
    rows = asyncio.run(repo.history("u1", "s1"))
    assert collection.find_filter == {"user_id": "u1", "session_id": "s1"}
    assert rows == [{"role": "user", "text": "hi"}]


def test_sessions_groups_by_session_id():
    collection = _Collection(aggregate_docs=[{"session_id": "s1", "message_count": 4}])
    repo = _Repo(collection)
    rows = asyncio.run(repo.sessions("u1"))
    assert rows[0]["session_id"] == "s1"
    match = collection.pipeline[0]
    assert match == {"$match": {"user_id": "u1"}}


def test_delete_session_is_scoped_to_the_owner():
    collection = _Collection(deleted=3)
    repo = _Repo(collection)
    deleted = asyncio.run(repo.delete_session("u1", "s1"))
    assert deleted == 3
    # Must never be able to delete another user's conversation.
    assert collection.deleted_filter == {"user_id": "u1", "session_id": "s1"}


def test_history_does_not_use_private_collection_accessor():
    import inspect
    from app.api import coach as coach_api
    assert "_collection()" not in inspect.getsource(coach_api.coach_history)

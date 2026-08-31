import unittest
from unittest.mock import AsyncMock

from bson import Decimal128

from app.repositories.repos import TransactionRepository


class FakeCursor:
    def __init__(self, docs):
        self.docs = docs

    def sort(self, *args, **kwargs):
        return self

    def limit(self, *args, **kwargs):
        return self

    async def to_list(self, *args, **kwargs):
        return self.docs


class FakeCollection:
    def __init__(self, docs):
        self.docs = docs

    def find(self, *args, **kwargs):
        return FakeCursor(self.docs)


class TransactionRepositoryCompatibilityTests(unittest.IsolatedAsyncioTestCase):
    async def test_repository_read_normalizes_proven_iso_date_and_money(self):
        raw = {
            "id": "tx_legacy",
            "user_id": "user_abc123",
            "date": "2026-08-28T14:00:00Z",
            "amount": Decimal128("150000.75"),
        }
        repo = TransactionRepository()
        repo._collection = AsyncMock(return_value=FakeCollection([raw]))

        result = await repo.find_by_user("user_abc123")

        self.assertEqual(result[0]["date"], "2026-08-28")
        self.assertEqual(result[0]["amount"], 150000.75)
        self.assertEqual(raw["date"], "2026-08-28T14:00:00Z")
        self.assertIsInstance(raw["amount"], Decimal128)

    async def test_repository_preserves_canonical_date(self):
        repo = TransactionRepository()
        repo._collection = AsyncMock(return_value=FakeCollection([{
            "id": "tx_current", "user_id": "user_abc123", "date": "2026-08-28", "amount": 1000,
        }]))
        result = await repo.find_by_user("user_abc123")
        self.assertEqual(result[0]["date"], "2026-08-28")

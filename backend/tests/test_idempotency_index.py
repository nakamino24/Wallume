import unittest
from unittest.mock import AsyncMock

from pymongo import ASCENDING

from app.database.mongo import _ensure_obsolete_transaction_mutation_index_removed


class _Indexes:
    def __init__(self, indexes):
        self.indexes = indexes

    async def to_list(self, _):
        return self.indexes


class _Transactions:
    def __init__(self, indexes):
        self.indexes = indexes
        self.drop_index = AsyncMock()

    def list_indexes(self):
        return _Indexes(self.indexes)


class _Database:
    def __init__(self, indexes):
        self.transactions = _Transactions(indexes)


class TransactionMutationIndexTests(unittest.IsolatedAsyncioTestCase):
    async def test_historical_missing_or_null_mutation_ids_need_no_transaction_index(self):
        db = _Database([])

        await _ensure_obsolete_transaction_mutation_index_removed(db)
        await _ensure_obsolete_transaction_mutation_index_removed(db)

        db.transactions.drop_index.assert_not_awaited()

    async def test_known_obsolete_unique_transaction_index_is_removed_idempotently(self):
        db = _Database([{
            "name": "user_id_1_client_mutation_id_1",
            "key": {"user_id": ASCENDING, "client_mutation_id": ASCENDING},
            "unique": True,
        }])

        await _ensure_obsolete_transaction_mutation_index_removed(db)

        db.transactions.drop_index.assert_awaited_once_with("user_id_1_client_mutation_id_1")

    async def test_unknown_index_with_mutation_index_name_stops_bootstrap(self):
        db = _Database([{
            "name": "user_id_1_client_mutation_id_1",
            "key": {"user_id": ASCENDING, "other": ASCENDING},
            "unique": True,
        }])

        with self.assertRaisesRegex(RuntimeError, "unexpected transactions index"):
            await _ensure_obsolete_transaction_mutation_index_removed(db)

        db.transactions.drop_index.assert_not_awaited()

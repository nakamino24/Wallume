"""Real MongoDB transaction checks against a disposable database.

Run explicitly: python -m unittest tests.test_mongo_runtime_transactions
Each test owns one IsolatedAsyncioTestCase event loop, including the Motor
client, session, and cleanup lifecycle. It never uses the configured database.
"""
import asyncio
import os
import unittest
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from bson import Decimal128
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING
from pymongo.errors import DuplicateKeyError

from app.core.config import settings
from app.database.mongo import _ensure_obsolete_transaction_mutation_index_removed
from app.repositories.repos import TransactionRepository


class MongoRuntimeTransactions(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.client = AsyncIOMotorClient(settings.mongo_url, serverSelectionTimeoutMS=10_000)
        hello = await self.client.admin.command("hello")
        self.assertTrue(hello.get("setName") or hello.get("msg") == "isdbgrid", "Mongo topology does not support transactions")
        # Atlas restricts database names to 38 bytes; this stays isolated while
        # leaving room for the generated suffix.
        self.db = self.client[f"wallume_a_{uuid.uuid4().hex[:20]}"]
        await self.db.idempotency.create_index([("user_id", ASCENDING), ("client_mutation_id", ASCENDING)], unique=True)

    async def asyncTearDown(self):
        await self.client.drop_database(self.db.name)
        self.client.close()

    async def test_obsolete_transaction_mutation_index_accepts_historical_missing_and_null_values(self):
        await self.db.transactions.insert_many([
            {"id": "missing-1", "user_id": "u"},
            {"id": "missing-2", "user_id": "u"},
            {"id": "null-1", "user_id": "u", "client_mutation_id": None},
            {"id": "null-2", "user_id": "u", "client_mutation_id": None},
        ])
        # The old unique index cannot be built on this historical shape. The
        # dedicated ledger remains the mutation-ID uniqueness authority.
        with patch("app.database.mongo.get_database", return_value=self.db):
            await _ensure_obsolete_transaction_mutation_index_removed(self.db)
            await _ensure_obsolete_transaction_mutation_index_removed(self.db)

        index_names = [index["name"] for index in await self.db.transactions.list_indexes().to_list(None)]
        self.assertNotIn("user_id_1_client_mutation_id_1", index_names)

    async def test_idempotency_ledger_rejects_same_user_mutation_id_but_allows_other_users(self):
        await self.db.idempotency.insert_one({"user_id": "u", "client_mutation_id": "mut-123"})
        with self.assertRaises(DuplicateKeyError):
            await self.db.idempotency.insert_one({"user_id": "u", "client_mutation_id": "mut-123"})
        await self.db.idempotency.insert_one({"user_id": "other-user", "client_mutation_id": "mut-123"})

    async def _seed_wallets(self):
        await self.db.wallets.insert_many([
            {"id": "a", "user_id": "u", "balance": 1_000_000, "deleted_at": None},
            {"id": "b", "user_id": "u", "balance": 500_000, "deleted_at": None},
        ])

    async def _counts(self):
        return (
            await self.db.transactions.count_documents({}),
            await self.db.idempotency.count_documents({}),
        )

    async def test_reports_range_cap_can_omit_an_old_in_range_expense(self):
        """The repository's production sort and cap can remove an old expense.

        This test uses a disposable database and patches only the repository's
        database lookup so its real filter, sort, and limit query are exercised.
        """
        user_id = "reports-cap-user"
        old_expense = {
            "id": "tx_old_expense", "user_id": user_id, "deleted_at": None,
            "date": "2026-07-01", "created_at": datetime(2026, 7, 1, tzinfo=timezone.utc),
            "type": "expense", "amount": 100000,
        }
        newer_income = [
            {
                "id": f"tx_income_{index:04d}", "user_id": user_id, "deleted_at": None,
                "date": "2026-08-24", "created_at": datetime(2026, 8, 24, tzinfo=timezone.utc),
                "type": "income", "amount": 1,
            }
            for index in range(2000)
        ]
        await self.db.transactions.insert_many([old_expense, *newer_income])

        range_filter = {
            "user_id": user_id, "deleted_at": None,
            "date": {"$gte": "2026-07-01", "$lt": "2026-08-25"},
        }
        self.assertEqual(await self.db.transactions.count_documents(range_filter), 2001)
        self.assertEqual(await self.db.transactions.count_documents({**range_filter, "type": "expense"}), 1)

        with patch("app.repositories.base.get_database", return_value=self.db):
            returned = await TransactionRepository().find_by_user(user_id, limit=2000, from_date="2026-07-01", to_date="2026-08-24")

        self.assertEqual(len(returned), 2000)
        self.assertNotIn("tx_old_expense", [transaction["id"] for transaction in returned])
        self.assertEqual([transaction for transaction in returned if transaction["type"] == "expense"], [])
        self.assertEqual(sum(transaction["amount"] for transaction in returned if transaction["type"] == "expense"), 0)

        uncapped = await self.db.transactions.find(range_filter, {"_id": 0}).sort([("date", -1), ("created_at", -1), ("id", -1)]).to_list(2001)
        self.assertEqual(len(uncapped), 2001)
        self.assertIn("tx_old_expense", [transaction["id"] for transaction in uncapped])
        self.assertEqual(sum(transaction["amount"] for transaction in uncapped if transaction["type"] == "expense"), 100000)

        await self.db.transactions.delete_many({})
        await self.db.transactions.insert_many([old_expense, *newer_income[:1999]])
        with patch("app.repositories.base.get_database", return_value=self.db):
            boundary = await TransactionRepository().find_by_user(user_id, limit=2000, from_date="2026-07-01", to_date="2026-08-24")
        self.assertEqual(len(boundary), 2000)
        self.assertIn("tx_old_expense", [transaction["id"] for transaction in boundary])

    async def _report_summary(self, user_id="report-user", from_date="2026-08-01", to_date="2026-08-24"):
        with patch("app.repositories.base.get_database", return_value=self.db):
            return await TransactionRepository().aggregate_report_summary(
                user_id,
                from_date,
                (datetime.strptime(to_date, "%Y-%m-%d") + timedelta(days=1)).strftime("%Y-%m-%d"),
            )

    async def test_report_summary_empty_range_returns_zeroes(self):
        summary = await self._report_summary()

        self.assertEqual(summary, {
            "transaction_count": 0,
            "income_total": 0.0,
            "expense_total": 0.0,
            "net_total": 0.0,
            "expense_by_category": [],
        })

    async def test_report_summary_single_expense_and_inclusive_to_date(self):
        await self.db.transactions.insert_one({
            "id": "expense-on-to-date", "user_id": "report-user", "deleted_at": None,
            "date": "2026-08-24", "type": "expense", "category": "Food",
            "amount": Decimal128("100000.00"),
        })

        summary = await self._report_summary()

        self.assertEqual(summary["transaction_count"], 1)
        self.assertEqual(summary["income_total"], 0.0)
        self.assertEqual(summary["expense_total"], 100000.0)
        self.assertEqual(summary["net_total"], -100000.0)
        self.assertEqual(summary["expense_by_category"], [{"category": "Food", "amount": 100000.0}])

    async def test_report_summary_income_expense_transfer_and_deleted_semantics(self):
        await self.db.transactions.insert_many([
            {"id": "income", "user_id": "report-user", "deleted_at": None,
             "date": "2026-08-10", "type": "income", "category": "Salary", "amount": Decimal128("300000.00")},
            {"id": "expense", "user_id": "report-user", "deleted_at": None,
             "date": "2026-08-10", "type": "expense", "category": "Food", "amount": Decimal128("100000.00")},
            {"id": "transfer", "user_id": "report-user", "deleted_at": None,
             "date": "2026-08-10", "type": "transfer", "category": "Transfer", "amount": Decimal128("999999.99")},
            {"id": "deleted", "user_id": "report-user", "deleted_at": datetime.now(timezone.utc),
             "date": "2026-08-10", "type": "expense", "category": "Deleted", "amount": Decimal128("500000.00")},
        ])

        summary = await self._report_summary()

        self.assertEqual(summary["transaction_count"], 3)
        self.assertEqual(summary["income_total"], 300000.0)
        self.assertEqual(summary["expense_total"], 100000.0)
        self.assertEqual(summary["net_total"], 200000.0)
        self.assertEqual(summary["expense_by_category"], [{"category": "Food", "amount": 100000.0}])

    async def test_report_summary_cross_month_and_user_isolation(self):
        await self.db.transactions.insert_many([
            {"id": "july", "user_id": "report-user", "deleted_at": None,
             "date": "2026-07-30", "type": "income", "category": "Salary", "amount": Decimal128("100.00")},
            {"id": "august", "user_id": "report-user", "deleted_at": None,
             "date": "2026-08-24", "type": "expense", "category": "Food", "amount": Decimal128("40.00")},
            {"id": "other-user", "user_id": "other-user", "deleted_at": None,
             "date": "2026-08-24", "type": "expense", "category": "Leak", "amount": Decimal128("9999.00")},
        ])

        summary = await self._report_summary(from_date="2026-07-30")

        self.assertEqual(summary["transaction_count"], 2)
        self.assertEqual(summary["income_total"], 100.0)
        self.assertEqual(summary["expense_total"], 40.0)
        self.assertEqual(summary["net_total"], 60.0)
        self.assertEqual(summary["expense_by_category"], [{"category": "Food", "amount": 40.0}])

    async def test_report_summary_category_keys_match_former_javascript_grouping(self):
        await self.db.transactions.insert_many([
            {"id": "named", "user_id": "report-user", "deleted_at": None,
             "date": "2026-08-10", "type": "expense", "category": "Food", "amount": Decimal128("4.00")},
            {"id": "empty", "user_id": "report-user", "deleted_at": None,
             "date": "2026-08-10", "type": "expense", "category": "", "amount": Decimal128("3.00")},
            {"id": "null", "user_id": "report-user", "deleted_at": None,
             "date": "2026-08-10", "type": "expense", "category": None, "amount": Decimal128("2.00")},
            {"id": "missing", "user_id": "report-user", "deleted_at": None,
             "date": "2026-08-10", "type": "expense", "amount": Decimal128("1.00")},
        ])

        summary = await self._report_summary()

        self.assertEqual(summary["expense_by_category"], [
            {"category": "Food", "amount": 4.0},
            {"category": "", "amount": 3.0},
            {"category": "null", "amount": 2.0},
            {"category": "undefined", "amount": 1.0},
        ])

    async def test_report_summary_sees_all_2001_rows_and_preserves_decimal128_expense(self):
        user_id = "reports-summary-cap-user"
        old_expense = {
            "id": "tx_old_expense", "user_id": user_id, "deleted_at": None,
            "date": "2026-07-01", "created_at": datetime(2026, 7, 1, tzinfo=timezone.utc),
            "type": "expense", "category": "Food", "amount": Decimal128("100000.00"),
        }
        newer_income = [
            {
                "id": f"tx_income_{index:04d}", "user_id": user_id, "deleted_at": None,
                "date": "2026-08-24", "created_at": datetime(2026, 8, 24, tzinfo=timezone.utc),
                "type": "income", "category": "Salary", "amount": Decimal128("1.00"),
            }
            for index in range(2000)
        ]
        await self.db.transactions.insert_many([old_expense, *newer_income])

        summary = await self._report_summary(user_id, "2026-07-01", "2026-08-24")

        self.assertEqual(summary["transaction_count"], 2001)
        self.assertEqual(summary["income_total"], 2000.0)
        self.assertEqual(summary["expense_total"], 100000.0)
        self.assertEqual(summary["net_total"], -98000.0)
        self.assertEqual(summary["expense_by_category"], [{"category": "Food", "amount": 100000.0}])

    async def test_report_summary_mixed_rows_over_2000_are_complete(self):
        user_id = "reports-summary-mixed-user"
        docs = [
            {
                "id": f"income-{index}", "user_id": user_id, "deleted_at": None,
                "date": "2026-08-01", "type": "income", "category": "Salary", "amount": Decimal128("3.33"),
            }
            for index in range(1200)
        ]
        docs.extend(
            {
                "id": f"expense-{index}", "user_id": user_id, "deleted_at": None,
                "date": "2026-08-24", "type": "expense", "category": "Food", "amount": Decimal128("1.11"),
            }
            for index in range(1001)
        )
        await self.db.transactions.insert_many(docs)

        summary = await self._report_summary(user_id)

        self.assertEqual(summary["transaction_count"], 2201)
        self.assertEqual(summary["income_total"], 3996.0)
        self.assertEqual(summary["expense_total"], 1111.11)
        self.assertEqual(summary["net_total"], 2884.89)
        self.assertEqual(summary["expense_by_category"], [{"category": "Food", "amount": 1111.11}])

    async def test_expense_failure_rolls_back_wallet_transaction_and_idempotency(self):
        await self._seed_wallets()
        with self.assertRaisesRegex(RuntimeError, "inject"):
            async with await self.client.start_session() as session:
                async with session.start_transaction():
                    await self.db.wallets.update_one({"id": "a"}, {"$inc": {"balance": -100_000}}, session=session)
                    await self.db.transactions.insert_one({"id": "expense", "user_id": "u", "amount": 100_000}, session=session)
                    await self.db.idempotency.insert_one({"user_id": "u", "client_mutation_id": "expense", "created_at": datetime.now(timezone.utc)}, session=session)
                    raise RuntimeError("inject before commit")
        self.assertEqual((await self.db.wallets.find_one({"id": "a"}))["balance"], 1_000_000)
        self.assertEqual(await self._counts(), (0, 0))

    async def test_transfer_failure_after_both_effects_rolls_back_everything(self):
        await self._seed_wallets()
        with self.assertRaisesRegex(RuntimeError, "inject"):
            async with await self.client.start_session() as session:
                async with session.start_transaction():
                    await self.db.wallets.update_one({"id": "a"}, {"$inc": {"balance": -200_000}}, session=session)
                    await self.db.wallets.update_one({"id": "b"}, {"$inc": {"balance": 200_000}}, session=session)
                    await self.db.transactions.insert_one({"id": "transfer", "user_id": "u", "amount": 200_000}, session=session)
                    await self.db.idempotency.insert_one({"user_id": "u", "client_mutation_id": "transfer", "created_at": datetime.now(timezone.utc)}, session=session)
                    raise RuntimeError("inject after both wallet writes")
        self.assertEqual((await self.db.wallets.find_one({"id": "a"}))["balance"], 1_000_000)
        self.assertEqual((await self.db.wallets.find_one({"id": "b"}))["balance"], 500_000)
        self.assertEqual(await self._counts(), (0, 0))

    async def test_patch_and_delete_failure_roll_back(self):
        await self._seed_wallets()
        await self.db.transactions.insert_one({"id": "tx", "user_id": "u", "amount": 100_000, "deleted_at": None})
        with self.assertRaises(RuntimeError):
            async with await self.client.start_session() as session:
                async with session.start_transaction():
                    await self.db.wallets.update_one({"id": "a"}, {"$inc": {"balance": 100_000}}, session=session)
                    await self.db.wallets.update_one({"id": "a"}, {"$inc": {"balance": -300_000}}, session=session)
                    await self.db.transactions.update_one({"id": "tx"}, {"$set": {"amount": 300_000}}, session=session)
                    raise RuntimeError("inject patch")
        self.assertEqual((await self.db.wallets.find_one({"id": "a"}))["balance"], 1_000_000)
        self.assertEqual((await self.db.transactions.find_one({"id": "tx"}))["amount"], 100_000)
        with self.assertRaises(RuntimeError):
            async with await self.client.start_session() as session:
                async with session.start_transaction():
                    await self.db.wallets.update_one({"id": "a"}, {"$inc": {"balance": 100_000}}, session=session)
                    await self.db.transactions.update_one({"id": "tx"}, {"$set": {"deleted_at": datetime.now(timezone.utc)}}, session=session)
                    await self.db.idempotency.insert_one({"user_id": "u", "client_mutation_id": "delete", "created_at": datetime.now(timezone.utc)}, session=session)
                    raise RuntimeError("inject delete")
        self.assertEqual((await self.db.wallets.find_one({"id": "a"}))["balance"], 1_000_000)
        self.assertIsNone((await self.db.transactions.find_one({"id": "tx"}))["deleted_at"])
        self.assertEqual(await self.db.idempotency.count_documents({"client_mutation_id": "delete"}), 0)

    async def test_concurrent_duplicate_transaction_commits_one_effect_and_one_result(self):
        await self._seed_wallets()

        async def create_once():
            try:
                async with await self.client.start_session() as session:
                    async with session.start_transaction():
                        await self.db.wallets.update_one({"id": "a"}, {"$inc": {"balance": -100_000}}, session=session)
                        await self.db.transactions.insert_one({"id": uuid.uuid4().hex, "user_id": "u", "client_mutation_id": "same", "amount": 100_000}, session=session)
                        result = {"transaction": "authoritative"}
                        await self.db.idempotency.insert_one({"user_id": "u", "client_mutation_id": "same", "fingerprint": "same", "result": result, "created_at": datetime.now(timezone.utc)}, session=session)
                        return result
            except DuplicateKeyError:
                record = await self.db.idempotency.find_one({"user_id": "u", "client_mutation_id": "same"})
                return record["result"]

        first, second = await asyncio.gather(create_once(), create_once())
        self.assertEqual(first, second)
        self.assertEqual((await self.db.wallets.find_one({"id": "a"}))["balance"], 900_000)
        self.assertEqual(await self._counts(), (1, 1))

    async def test_concurrent_duplicate_wallet_commits_one_wallet_and_result(self):
        async def create_once():
            try:
                async with await self.client.start_session() as session:
                    async with session.start_transaction():
                        await self.db.wallets.insert_one({"id": uuid.uuid4().hex, "user_id": "u", "name": "Wallet"}, session=session)
                        result = {"wallet": "authoritative"}
                        await self.db.idempotency.insert_one({"user_id": "u", "client_mutation_id": "wallet", "fingerprint": "same", "result": result, "created_at": datetime.now(timezone.utc)}, session=session)
                        return result
            except DuplicateKeyError:
                return (await self.db.idempotency.find_one({"user_id": "u", "client_mutation_id": "wallet"}))["result"]

        first, second = await asyncio.gather(create_once(), create_once())
        self.assertEqual(first, second)
        self.assertEqual(await self.db.wallets.count_documents({"user_id": "u"}), 1)
        self.assertEqual(await self.db.idempotency.count_documents({"client_mutation_id": "wallet"}), 1)

    async def test_concurrent_duplicate_transfer_commits_each_effect_once(self):
        await self._seed_wallets()

        async def transfer_once():
            try:
                async with await self.client.start_session() as session:
                    async with session.start_transaction():
                        await self.db.wallets.update_one({"id": "a"}, {"$inc": {"balance": -200_000}}, session=session)
                        await self.db.wallets.update_one({"id": "b"}, {"$inc": {"balance": 200_000}}, session=session)
                        await self.db.transactions.insert_one({"id": uuid.uuid4().hex, "user_id": "u", "client_mutation_id": "transfer-same", "amount": 200_000}, session=session)
                        result = {"transaction": "transfer-authoritative"}
                        await self.db.idempotency.insert_one({"user_id": "u", "client_mutation_id": "transfer-same", "fingerprint": "same", "result": result, "created_at": datetime.now(timezone.utc)}, session=session)
                        return result
            except DuplicateKeyError:
                return (await self.db.idempotency.find_one({"user_id": "u", "client_mutation_id": "transfer-same"}))["result"]

        first, second = await asyncio.gather(transfer_once(), transfer_once())
        self.assertEqual(first, second)
        self.assertEqual((await self.db.wallets.find_one({"id": "a"}))["balance"], 800_000)
        self.assertEqual((await self.db.wallets.find_one({"id": "b"}))["balance"], 700_000)
        self.assertEqual(await self._counts(), (1, 1))

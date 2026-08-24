"""R4 real-Mongo explain diagnostic for the production Reports aggregation.

Run explicitly: python -m unittest tests.test_reports_explain
It creates matching transaction indexes and fixture data only in a disposable
database, then drops that database in asyncTearDown.
"""
import json
import unittest
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import patch

from bson import Decimal128
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING

from app.core.config import settings
from app.repositories.repos import TransactionRepository
from app.utils.money import to_decimal


REPORT_USER = "reports-explain-user"
FROM_DATE = "2026-08-01"
TO_DATE_EXCLUSIVE = "2026-08-25"


def report_pipeline(user_id: str, from_date: str, to_date_exclusive: str) -> list[dict]:
    """Exact pipeline from TransactionRepository.aggregate_report_summary()."""
    zero = Decimal128("0")
    return [
        {"$match": {
            "user_id": user_id,
            "date": {"$gte": from_date, "$lt": to_date_exclusive},
            "deleted_at": None,
        }},
        {"$facet": {
            "totals": [
                {"$group": {
                    "_id": None,
                    "transaction_count": {"$sum": 1},
                    "income_total": {"$sum": {"$cond": [
                        {"$eq": ["$type", "income"]}, "$amount", zero,
                    ]}},
                    "expense_total": {"$sum": {"$cond": [
                        {"$eq": ["$type", "expense"]}, "$amount", zero,
                    ]}},
                }},
                {"$project": {
                    "_id": 0,
                    "transaction_count": 1,
                    "income_total": 1,
                    "expense_total": 1,
                    "net_total": {"$subtract": ["$income_total", "$expense_total"]},
                }},
            ],
            "expense_by_category": [
                {"$match": {"type": "expense"}},
                {"$project": {
                    "category": {"$switch": {
                        "branches": [
                            {"case": {"$eq": [{"$type": "$category"}, "missing"]}, "then": "undefined"},
                            {"case": {"$eq": [{"$type": "$category"}, "null"]}, "then": "null"},
                        ],
                        "default": {"$toString": "$category"},
                    }},
                    "amount": 1,
                }},
                {"$group": {"_id": "$category", "amount": {"$sum": "$amount"}}},
                {"$project": {"_id": 0, "category": "$_id", "amount": 1}},
                {"$sort": {"amount": -1}},
            ],
        }},
    ]


def find_stage(value, stage_name: str):
    if isinstance(value, dict):
        if value.get("stage") == stage_name:
            return value
        for nested in value.values():
            found = find_stage(nested, stage_name)
            if found:
                return found
    if isinstance(value, list):
        for nested in value:
            found = find_stage(nested, stage_name)
            if found:
                return found
    return None


def sort_stage_summary(stages: list[dict]) -> list[dict]:
    summaries = []
    for stage in stages:
        if "$sort" in stage:
            summaries.append({
                "sortKey": stage["$sort"].get("sortKey"),
                "usedDisk": stage["$sort"].get("usedDisk", "NOT EXPOSED"),
                "spills": stage["$sort"].get("spills", "NOT EXPOSED"),
            })
        if "$facet" in stage:
            for facet_stages in stage["$facet"].values():
                summaries.extend(sort_stage_summary(facet_stages))
    return summaries


class ReportAggregationExplain(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.client = AsyncIOMotorClient(settings.mongo_url, serverSelectionTimeoutMS=10_000)
        await self.client.admin.command("ping")
        self.db = self.client[f"wallume_r4_{uuid.uuid4().hex[:20]}"]
        self.transactions = self.db.transactions

        # Recreate the source-defined transaction indexes, never production indexes.
        await self.transactions.create_index([("user_id", ASCENDING)])
        await self.transactions.create_index([("user_id", ASCENDING), ("date", DESCENDING)])
        await self.transactions.create_index([("user_id", ASCENDING), ("id", ASCENDING)])
        await self.transactions.create_index([("user_id", ASCENDING), ("wallet_id", ASCENDING)])
        await self.transactions.create_index([("user_id", ASCENDING), ("to_wallet_id", ASCENDING)])
        await self.transactions.create_index(
            [("user_id", ASCENDING), ("client_mutation_id", ASCENDING)],
            unique=True,
            sparse=True,
        )
        await self._seed_fixture()

    async def asyncTearDown(self):
        await self.client.drop_database(self.db.name)
        self.assertNotIn(self.db.name, await self.client.list_database_names())
        self.client.close()

    async def _seed_fixture(self):
        docs = [
            {
                "id": f"income-{index}", "user_id": REPORT_USER, "deleted_at": None,
                "date": "2026-08-01", "type": "income", "category": "Salary",
                "amount": Decimal128("3.33"),
            }
            for index in range(1000)
        ]
        docs.extend(
            {
                "id": f"expense-{index}", "user_id": REPORT_USER, "deleted_at": None,
                "date": "2026-08-24", "type": "expense", "category": "Food",
                "amount": Decimal128("1.11"),
            }
            for index in range(1000)
        )
        docs.extend(
            {
                "id": f"transfer-{index}", "user_id": REPORT_USER, "deleted_at": None,
                "date": "2026-08-12", "type": "transfer", "category": "Transfer",
                "amount": Decimal128("9.99"),
            }
            for index in range(250)
        )
        docs.extend(
            {
                "id": f"deleted-{index}", "user_id": REPORT_USER,
                "deleted_at": datetime(2026, 8, 12, tzinfo=timezone.utc),
                "date": "2026-08-12", "type": "expense", "category": "Deleted",
                "amount": Decimal128("100.00"),
            }
            for index in range(40)
        )
        docs.extend(
            {
                "id": f"other-{index}", "user_id": "reports-explain-other", "deleted_at": None,
                "date": "2026-08-24", "type": "expense", "category": "Other",
                "amount": Decimal128("777.00"),
            }
            for index in range(250)
        )
        docs.extend(
            {
                "id": f"outside-before-{index}", "user_id": REPORT_USER, "deleted_at": None,
                "date": "2026-07-31", "type": "income", "category": "Salary",
                "amount": Decimal128("10.00"),
            }
            for index in range(250)
        )
        docs.extend(
            {
                "id": f"outside-after-{index}", "user_id": REPORT_USER, "deleted_at": None,
                "date": "2026-08-25", "type": "expense", "category": "Food",
                "amount": Decimal128("10.00"),
            }
            for index in range(250)
        )
        for index, doc in enumerate(docs):
            doc["client_mutation_id"] = f"explain-{index}"
        await self.transactions.insert_many(docs)

    async def _explain(self, from_date: str, to_date_exclusive: str) -> dict:
        return await self.db.command({
            "explain": {
                "aggregate": "transactions",
                "pipeline": report_pipeline(REPORT_USER, from_date, to_date_exclusive),
                "cursor": {},
            },
            "verbosity": "executionStats",
        })

    @staticmethod
    def _index_inventory(indexes: list[dict]) -> list[dict]:
        return [
            {
                "name": index["name"],
                "keys": list(index["key"].items()),
                "unique": index.get("unique", False),
                "sparse": index.get("sparse", False),
                "partialFilterExpression": index.get("partialFilterExpression"),
            }
            for index in indexes
        ]

    async def test_current_report_index_plan(self):
        pipeline = report_pipeline(REPORT_USER, FROM_DATE, TO_DATE_EXCLUSIVE)
        result = await self.transactions.aggregate(pipeline).to_list(1)
        totals = result[0]["totals"][0]
        self.assertEqual(totals["transaction_count"], 2250)
        self.assertEqual(to_decimal(totals["income_total"]), Decimal("3330.00"))
        self.assertEqual(to_decimal(totals["expense_total"]), Decimal("1110.00"))
        self.assertEqual(to_decimal(totals["net_total"]), Decimal("2220.00"))
        # Independently confirm the unmodified production repository returns
        # the same aggregates against this real disposable collection.
        with patch("app.repositories.base.get_database", return_value=self.db):
            summary = await TransactionRepository().aggregate_report_summary(
                REPORT_USER, FROM_DATE, TO_DATE_EXCLUSIVE,
            )
        self.assertEqual(summary["transaction_count"], 2250)
        self.assertEqual(summary["income_total"], 3330.0)
        self.assertEqual(summary["expense_total"], 1110.0)
        self.assertEqual(summary["net_total"], 2220.0)

        indexes = await self.transactions.list_indexes().to_list(None)
        broad = await self._explain(FROM_DATE, TO_DATE_EXCLUSIVE)
        narrow = await self._explain("2026-08-01", "2026-08-02")
        broad_cursor = next(stage["$cursor"] for stage in broad["stages"] if "$cursor" in stage)
        narrow_cursor = next(stage["$cursor"] for stage in narrow["stages"] if "$cursor" in stage)
        broad_plan = broad_cursor["queryPlanner"]["winningPlan"]
        broad_stats = broad_cursor["executionStats"]
        narrow_stats = narrow_cursor["executionStats"]
        ixscan = find_stage(broad_plan, "IXSCAN")

        self.assertIsNotNone(ixscan)
        self.assertEqual(ixscan["indexName"], "user_id_1_date_-1")
        self.assertEqual(broad_stats["nReturned"], 2250)
        self.assertEqual(broad_stats["totalKeysExamined"], 2290)
        self.assertEqual(broad_stats["totalDocsExamined"], 2290)
        self.assertEqual(narrow_stats["nReturned"], 1000)
        self.assertEqual(narrow_stats["totalKeysExamined"], 1000)
        self.assertEqual(narrow_stats["totalDocsExamined"], 1000)

        report = {
            "database": self.db.name,
            "indexes": self._index_inventory(indexes),
            "dataset": {
                "totalCollectionRows": await self.transactions.count_documents({}),
                "matchingActiveUserRangeRows": 2250,
                "softDeletedMatchingRangeRows": 40,
                "otherUserRows": 250,
                "outOfRangeRows": 500,
            },
            "correctness": {
                "transaction_count": totals["transaction_count"],
                "income_total": str(to_decimal(totals["income_total"])),
                "expense_total": str(to_decimal(totals["expense_total"])),
                "net_total": str(to_decimal(totals["net_total"])),
            },
            "broad": {
                "winningPlan": broad_plan,
                "primaryScan": ixscan["stage"],
                "indexUsed": ixscan["indexName"],
                "indexBounds": ixscan["indexBounds"],
                "fetchPresent": find_stage(broad_plan, "FETCH") is not None,
                "executionStats": {
                    key: broad_stats[key]
                    for key in ("nReturned", "totalKeysExamined", "totalDocsExamined", "executionTimeMillis")
                },
                "facetSortStages": sort_stage_summary(broad["stages"]),
            },
            "narrow": {
                "executionStats": {
                    key: narrow_stats[key]
                    for key in ("nReturned", "totalKeysExamined", "totalDocsExamined", "executionTimeMillis")
                },
            },
        }
        print("R4_EXPLAIN=" + json.dumps(report, default=str, sort_keys=True))

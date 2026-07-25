from __future__ import annotations

from typing import Any, Optional
from motor.motor_asyncio import AsyncIOMotorCollection, AsyncIOMotorDatabase
from app.database.mongo import get_database
from app.utils.money import to_decimal128, from_decimal128, convert_doc_decimals, convert_docs_decimals


MONEY_FIELDS = {"balance", "amount", "converted_balance", "target_amount", "saved_amount",
                "total_budget", "principal", "remaining", "interest_rate", "monthly_payment",
                "avg_cost", "current_price", "face_value", "coupon_rate", "purchase_price",
                "current_value", "value"}


class BaseRepository:
    def __init__(self, collection_name: str) -> None:
        self._collection_name = collection_name

    async def _collection(self) -> AsyncIOMotorCollection:
        db: AsyncIOMotorDatabase = await get_database()
        return db[self._collection_name]

    def _money_out(self, doc: dict[str, Any]) -> dict[str, Any]:
        return convert_doc_decimals(doc, list(MONEY_FIELDS))

    def _money_out_list(self, docs: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return convert_docs_decimals(docs, list(MONEY_FIELDS))

    def _money_in(self, doc: dict[str, Any]) -> dict[str, Any]:
        """Convert float fields to Decimal128 before writing to MongoDB."""
        result = dict(doc)
        for field in MONEY_FIELDS:
            if field in result and isinstance(result[field], (float, int)):
                result[field] = to_decimal128(result[field])
        return result

    def _money_in_update(self, update: dict[str, Any]) -> dict[str, Any]:
        """Convert money fields inside $set/$inc operators."""
        result = {}
        for operator, fields in update.items():
            if isinstance(fields, dict):
                result[operator] = self._money_in(fields)
            else:
                result[operator] = fields
        return result

    def _active_filter(self, base_filter: dict[str, Any]) -> dict[str, Any]:
        """Add soft-delete filter — exclude deleted records."""
        f = dict(base_filter)
        if "deleted_at" not in f:
            f["deleted_at"] = None
        return f

    async def find_by_user(self, user_id: str, limit: int = 500) -> list[dict]:
        cursor = (await self._collection()).find(
            self._active_filter({"user_id": user_id}), {"_id": 0}
        ).limit(limit)
        return self._money_out_list(await cursor.to_list(limit))

    async def find_one(self, filter: dict) -> dict[str, Any] | None:
        doc = await (await self._collection()).find_one(
            self._active_filter(filter), {"_id": 0}
        )
        return self._money_out(doc) if doc else None

    async def insert_one(self, doc: dict) -> None:
        await (await self._collection()).insert_one(self._money_in(doc))

    async def update_one(self, filter: dict, update: dict, upsert: bool = False) -> None:
        await (await self._collection()).update_one(filter, self._money_in_update(update), upsert=upsert)

    async def delete_one(self, filter: dict, hard: bool = False) -> None:
        coll = await self._collection()
        if hard:
            await coll.delete_one(filter)
        else:
            from app.utils.helpers import now_utc
            await coll.update_one(filter, {"$set": {"deleted_at": now_utc()}})

    async def delete_many(self, filter: dict, hard: bool = False) -> None:
        coll = await self._collection()
        if hard:
            await coll.delete_many(filter)
        else:
            from app.utils.helpers import now_utc
            await coll.update_many(filter, {"$set": {"deleted_at": now_utc()}})

    async def aggregate(self, pipeline: list[dict]) -> list[dict]:
        docs = await (await self._collection()).aggregate(pipeline).to_list(5000)
        return self._money_out_list(docs)
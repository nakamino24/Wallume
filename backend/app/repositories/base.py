from __future__ import annotations

from typing import Any
from motor.motor_asyncio import AsyncIOMotorCollection, AsyncIOMotorDatabase
from app.database.mongo import get_database


class BaseRepository:
    def __init__(self, collection_name: str) -> None:
        self._collection_name = collection_name

    async def _collection(self) -> AsyncIOMotorCollection:
        db: AsyncIOMotorDatabase = await get_database()
        return db[self._collection_name]

    async def find_by_user(self, user_id: str, limit: int = 500, projection: dict[str, int] | None = None) -> list[dict]:
        if projection is None:
            projection = {"_id": 0}
        return await (await self._collection()).find(
            {"user_id": user_id}, projection
        ).to_list(limit)

    async def find_one(self, filter: dict, projection: dict[str, int] | None = None) -> dict[str, Any] | None:
        if projection is None:
            projection = {"_id": 0}
        return await (await self._collection()).find_one(filter, projection)

    async def insert_one(self, doc: dict) -> None:
        await (await self._collection()).insert_one(doc)

    async def update_one(self, filter: dict, update: dict, upsert: bool = False) -> None:
        await (await self._collection()).update_one(filter, update, upsert=upsert)

    async def delete_one(self, filter: dict) -> None:
        await (await self._collection()).delete_one(filter)

    async def delete_many(self, filter: dict) -> None:
        await (await self._collection()).delete_many(filter)

    async def aggregate(self, pipeline: list[dict]) -> list[dict]:
        return await (await self._collection()).aggregate(pipeline).to_list(5000)
from __future__ import annotations

import certifi
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.core.config import settings

_client: AsyncIOMotorClient | None = None


async def get_database() -> AsyncIOMotorDatabase:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(
            settings.mongo_url,
            serverSelectionTimeoutMS=5000,
            tlsCAFile=certifi.where(),
        )
    return _client[settings.db_name]


async def close_database() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None


async def create_indexes() -> None:
    db = await get_database()
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.token_blacklist.create_index("jti", unique=True)
    await db.token_blacklist.create_index("expires_at", expireAfterSeconds=0)
    for coll in ("wallets", "transactions", "budgets", "goals", "plans",
                 "debts", "investments", "assets", "chat_messages", "recurring"):
        await db[coll].create_index("user_id")
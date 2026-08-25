from __future__ import annotations

import certifi
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ASCENDING
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
                 "debts", "investments", "assets", "chat_messages", "recurring", "categories"):
        await db[coll].create_index("user_id")
    # Compound indexes for hot paths: wallet lookup by id+user, transaction
    # filtering by user+date (Reports, Home recent) and direct id lookup.
    await db.wallets.create_index([("user_id", 1), ("id", 1)])
    await db.transactions.create_index([("user_id", 1), ("date", -1)])
    await db.transactions.create_index([("user_id", 1), ("id", 1)])
    await db.transactions.create_index([("user_id", 1), ("wallet_id", 1)])
    await db.transactions.create_index([("user_id", 1), ("to_wallet_id", 1)])
    await _ensure_obsolete_transaction_mutation_index_removed(db)
    # Dedicated idempotency collection for PATCH/DELETE which need to store
    # multiple sequential mutation IDs per resource (a single client_mutation_id
    # field on the resource would be overwritten by each mutation).
    await db.idempotency.create_index([("user_id", 1), ("client_mutation_id", 1)], unique=True)
    # Completed records remain replayable for 30 days. TTL expiry begins only
    # after the atomic completion write; no in-progress record is TTL-eligible.
    await db.idempotency.create_index("created_at", expireAfterSeconds=30*24*3600)


async def _ensure_obsolete_transaction_mutation_index_removed(db: AsyncIOMotorDatabase) -> None:
    """Retire the obsolete resource-level mutation index without touching unknown indexes.

    The idempotency ledger is the authoritative uniqueness record for every
    transaction mutation. Historical transactions lack a mutation ID, so the
    old compound unique index cannot be created safely on existing data.
    """
    name = "user_id_1_client_mutation_id_1"
    expected_keys = [("user_id", ASCENDING), ("client_mutation_id", ASCENDING)]
    indexes = await db.transactions.list_indexes().to_list(None)
    existing = next((index for index in indexes if index["name"] == name), None)
    if existing is None:
        return
    if list(existing["key"].items()) != expected_keys:
        raise RuntimeError(f"unexpected transactions index named {name}")
    if not existing.get("unique"):
        raise RuntimeError(f"unexpected non-unique transactions index named {name}")
    await db.transactions.drop_index(name)

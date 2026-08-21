"""Inspect the iso_with_tz date records before migration (read-only)."""
import asyncio
import sys

sys.path.insert(0, ".")


async def main():
    from app.database.mongo import get_database
    db = await get_database()
    coll = db.transactions
    cursor = coll.find(
        {"date": {"$regex": "T"}},
        {"id": 1, "type": 1, "category": 1, "date": 1, "created_at": 1, "deleted_at": 1},
    )
    async for doc in cursor:
        print({k: str(v) for k, v in doc.items() if k != "_id"})


asyncio.run(main())

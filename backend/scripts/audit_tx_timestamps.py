"""Read-only audit: quantify created_at coverage + date format distribution.

Run: python scripts/audit_tx_timestamps.py [--limit N]
Never writes to the database.
"""
import asyncio
import re
import sys
from collections import Counter

sys.path.insert(0, ".")


DATE_ONLY = re.compile(r"^\d{4}-\d{2}-\d{2}$")
ISO_TZ = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})$")
ISO_NAIVE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?$")


def classify_date(v):
    if v is None:
        return "missing"
    if isinstance(v, str):
        if DATE_ONLY.match(v):
            return "date_only (YYYY-MM-DD)"
        if ISO_TZ.match(v):
            return "iso_with_tz"
        if ISO_NAIVE.match(v):
            return "iso_naive_no_tz"
        return f"other_string:{v[:30]!r}"
    return f"bson_{type(v).__name__}"


def classify_created_at(v):
    if v is None:
        return "missing"
    from datetime import datetime
    if isinstance(v, datetime):
        return "bson_datetime"
    if isinstance(v, str):
        return "string"
    return type(v).__name__


async def main(limit: int):
    from app.database.mongo import get_database

    db = await get_database()
    coll = db.transactions

    total = await coll.count_documents({})
    no_created = await coll.count_documents({"created_at": {"$in": [None, ""]}})
    missing_created_field = await coll.count_documents({"created_at": {"$exists": False}})
    deleted = await coll.count_documents({"deleted_at": {"$ne": None}})

    print(f"=== TRANSACTION TIMESTAMP AUDIT (read-only) ===")
    print(f"total_transactions:            {total}")
    print(f"  active:                      {total - deleted}")
    print(f"  soft-deleted:                {deleted}")
    print(f"missing created_at field:      {missing_created_field}")
    print(f"created_at null/empty:         {no_created}")
    print()

    # Sample across creation periods for format distribution
    cursor = coll.find({}, {"date": 1, "created_at": 1, "deleted_at": 1}).sort("$natural", -1).limit(limit)
    date_formats = Counter()
    created_formats = Counter()
    per_type_no_time = Counter()
    n = 0
    async for doc in cursor:
        n += 1
        df = classify_date(doc.get("date"))
        cf = classify_created_at(doc.get("created_at"))
        date_formats[df] += 1
        created_formats[cf] += 1
        if cf == "missing":
            key = ("soft-deleted" if doc.get("deleted_at") else "active")
            per_type_no_time[key] += 1

    print(f"--- sampled last {n} docs ---")
    print("date field formats:")
    for fmt, cnt in date_formats.most_common():
        print(f"  {cnt:6d}  {fmt}")
    print("created_at formats:")
    for fmt, cnt in created_formats.most_common():
        print(f"  {cnt:6d}  {fmt}")
    print("records with NO created_at:")
    for k, v in per_type_no_time.items():
        print(f"  {k}: {v}")

    # Oldest/newest sample dates for context
    oldest = await coll.find_one({}, sort=[("created_at", 1)], projection={"created_at": 1, "date": 1})
    newest = await coll.find_one({}, sort=[("created_at", -1)], projection={"created_at": 1, "date": 1})
    print(f"\noldest record: {oldest}")
    print(f"newest record: {newest}")


if __name__ == "__main__":
    limit = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else 2000
    asyncio.run(main(limit))

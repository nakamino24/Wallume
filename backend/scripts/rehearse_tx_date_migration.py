"""Staging rehearsal: copy target docs into a test collection, migrate there,
verify, report. Never touches the real transactions collection."""
import asyncio
import re
import sys

sys.path.insert(0, ".")

sys.path.insert(0, "scripts")
from migrate_tx_dates import ISO_WITH_TZ, DATE_ONLY, canonical_date


async def main():
    from app.database.mongo import get_database
    db = await get_database()
    real = db.transactions
    test = db["transactions_mig_staging"]

    # 1. Copy all string-date docs (full dataset snapshot of date field)
    copied = 0
    async for doc in real.find({"date": {"$type": "string"}}):
        doc["_id"] = doc["_id"]  # keep same shape
        await test.insert_one(dict(doc))
        copied += 1
    print(f"staging copy: {copied} documents -> transactions_mig_staging")

    # 2. Before-counts per format
    def classify(v):
        if DATE_ONLY.match(v):
            return "date_only"
        if ISO_WITH_TZ.match(v):
            return "iso_with_tz"
        return "other"

    before = {"date_only": 0, "iso_with_tz": 0, "other": 0}
    total_before = await test.count_documents({})
    async for doc in test.find({}, {"date": 1}):
        before[classify(doc["date"])] += 1
    print(f"BEFORE: total={total_before} formats={before}")

    # 3. Migrate inside staging only
    migrated = 0
    order_before = []
    async for doc in test.find({}, {"id": 1, "date": 1}).sort([("created_at", -1)]):
        order_before.append(doc["id"])
        if ISO_WITH_TZ.match(doc["date"]):
            await test.update_one({"_id": doc["_id"]}, {"$set": {"date": canonical_date(doc["date"])}})
            migrated += 1
    print(f"migrated in staging: {migrated}")

    # 4. After-counts + integrity checks
    after = {"date_only": 0, "iso_with_tz": 0, "other": 0}
    total_after = await test.count_documents({})
    async for doc in test.find({}, {"date": 1}):
        after[classify(doc["date"])] += 1
    print(f"AFTER:  total={total_after} formats={after}")

    order_after = []
    async for doc in test.find({}, {"id": 1}).sort([("created_at", -1)]):
        order_after.append(doc["id"])

    checks = {
        "no_records_lost": total_after == total_before,
        "no_iso_left": after["iso_with_tz"] == 0,
        "no_other_formats": after["other"] == 0,
        "order_unchanged": order_before == order_after,
    }
    print("integrity:", checks)

    # 5. Cleanup staging
    await test.drop()
    print("staging collection dropped.")

    if not all(checks.values()):
        sys.exit(1)


asyncio.run(main())

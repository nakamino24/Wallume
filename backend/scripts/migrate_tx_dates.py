"""One-time migration: normalize transaction `date` strings to canonical YYYY-MM-DD.

Canonical format: "YYYY-MM-DD" (what the form produces for every new record).
For legacy full-ISO dates (backend default when no date was supplied), the UTC
calendar date is used — deterministic and, for existing records, identical to
the WIB-local calendar date (verified during audit).

Usage:
    python scripts/migrate_tx_dates.py            # DRY RUN (default): shows plan, no writes
    python scripts/migrate_tx_dates.py --apply     # performs the migration
    python scripts/migrate_tx_dates.py --rollback  # restores originals from the last backup file

Safety:
- Every modified document is snapshotted into scripts/backups/tx_dates_<ts>.json
  before any write; --rollback restores exactly those values.
- Only string dates matching a full-ISO pattern are touched; anything else is
  left alone and reported.
"""
import asyncio
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, ".")

BACKUP_DIR = Path(__file__).parent / "backups"
# Full ISO with tz offset or Z suffix, e.g. 2026-08-21T14:07:03.897000+00:00
ISO_WITH_TZ = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})$")
DATE_ONLY = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def canonical_date(value: str) -> str:
    """Full ISO -> YYYY-MM-DD via the UTC calendar date."""
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc)
    return dt.strftime("%Y-%m-%d")


async def find_targets():
    from app.database.mongo import get_database
    db = await get_database()
    targets = []
    async for doc in db.transactions.find({"date": {"$type": "string"}}, {"id": 1, "date": 1}):
        v = doc["date"]
        if DATE_ONLY.match(v):
            continue  # already canonical
        if ISO_WITH_TZ.match(v):
            targets.append({"id": doc["id"], "old": v, "new": canonical_date(v)})
        else:
            print(f"  !! SKIP unrecognized format id={doc.get('id')} date={v!r}")
    return targets


def load_latest_backup() -> Path | None:
    files = sorted(BACKUP_DIR.glob("tx_dates_*.json"))
    return files[-1] if files else None


async def apply(dry_run: bool):
    targets = await find_targets()
    print(f"=== MIGRATE tx.date -> YYYY-MM-DD ({'DRY RUN' if dry_run else 'APPLY'}) ===")
    print(f"records to migrate: {len(targets)}")
    for t in targets:
        print(f"  {t['id']}: {t['old']!r} -> {t['new']!r}")
    if not targets:
        print("nothing to do.")
        return

    # Sanity check: no record may shift calendar day vs its own created_at UTC day
    from app.database.mongo import get_database
    db = await get_database()
    for t in targets:
        doc = await db.transactions.find_one({"id": t["id"]}, {"created_at": 1})
        ca = doc.get("created_at")
        # PyMongo returns naive datetimes whose values are already UTC — do NOT
        # astimezone() them (that would re-interpret as local time).
        ca_day = ca.strftime("%Y-%m-%d") if ca else None
        if ca_day and ca_day != t["new"]:
            print(f"  !! WARNING {t['id']}: new date {t['new']} != created_at UTC day {ca_day}")

    if dry_run:
        print("\ndry run complete — no writes performed.")
        return

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    backup_file = BACKUP_DIR / f"tx_dates_{ts}.json"
    backup_file.write_text(json.dumps(targets, indent=2))
    print(f"backup written: {backup_file}")

    from app.database.mongo import get_database
    coll = db.transactions
    modified = 0
    for t in targets:
        res = await coll.update_one({"id": t["id"], "date": t["old"]}, {"$set": {"date": t["new"]}})
        modified += res.modified_count
    print(f"migration complete: {modified}/{len(targets)} documents updated.")


async def rollback():
    backup_file = load_latest_backup()
    if not backup_file:
        print("no backup file found in", BACKUP_DIR)
        return
    targets = json.loads(backup_file.read_text())
    print(f"=== ROLLBACK from {backup_file.name} ({len(targets)} records) ===")
    from app.database.mongo import get_database
    coll = db = None
    db = await get_database()
    coll = db.transactions
    restored = 0
    for t in targets:
        res = await coll.update_one({"id": t["id"], "date": t["new"]}, {"$set": {"date": t["old"]}})
        restored += res.modified_count
    print(f"rollback complete: {restored}/{len(targets)} documents restored.")


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    if mode == "--apply":
        asyncio.run(apply(dry_run=False))
    elif mode == "--rollback":
        asyncio.run(rollback())
    else:
        asyncio.run(apply(dry_run=True))

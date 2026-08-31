"""
READ ONLY database compatibility audit.

Usage:
  python -m scripts.audits.audit_database_compatibility [--mongo-url ...] [--db-name ...]

Reports aggregate sanitized counts only. Never prints emails, names, balances,
password hashes, JWTs, or MONGO_URL.
"""
from __future__ import annotations

import argparse
import asyncio
import os
import re
from collections import Counter
from typing import Any

from bson import Decimal128

try:
    from app.core.config import settings
    from app.database.mongo import get_database
except Exception:  # allow import without full app env for --help
    settings = None  # type: ignore
    get_database = None  # type: ignore


def _is_production() -> bool:
    env = os.getenv("ENVIRONMENT", "") or (getattr(settings, "environment", "") if settings else "")
    rail = os.getenv("RAILWAY_ENVIRONMENT_NAME", "") or (getattr(settings, "railway_environment_name", "") if settings else "")
    return (env.lower() in ("production", "prod") or rail.lower() in ("production", "prod"))


async def _counts(db) -> dict[str, Any]:
    cols = ["users", "wallets", "transactions", "categories", "budgets", "goals", "plans", "debts", "investments", "assets", "recurring"]
    out: dict[str, Any] = {}
    for c in cols:
        try:
            out[c] = await db[c].count_documents({})
        except Exception as e:
            out[c] = f"error: {type(e).__name__}"
    return out


async def _auth_audit(db) -> dict[str, Any]:
    try:
        total = await db["users"].count_documents({})
        pipeline = [
            {"$group": {"_id": "$provider", "count": {"$sum": 1}}},
        ]
        provider_counts = {}
        async for doc in db["users"].aggregate(pipeline):
            provider_counts[doc["_id"] or "unknown"] = doc["count"]
        with_hash = await db["users"].count_documents({"password_hash": {"$exists": True, "$ne": None}})
        without_hash = total - with_hash
        # malformed bcrypt: not starting with $2a/$2b
        malformed = 0
        async for u in db["users"].find({"password_hash": {"$exists": True, "$ne": None}}, {"password_hash": 1}):
            h = u.get("password_hash") or ""
            if not isinstance(h, str) or not h.startswith("$2"):
                malformed += 1
        # duplicate normalized emails
        dup_normalized = 0
        try:
            emails = []
            async for u in db["users"].find({}, {"email": 1}):
                e = (u.get("email") or "").strip().lower()
                if e:
                    emails.append(e)
            dup_normalized = len(emails) - len(set(emails))
        except Exception:
            dup_normalized = -1  # unknown
        return {
            "total_users": total,
            "provider_distribution": provider_counts,
            "password_hash_present": with_hash,
            "password_hash_absent": without_hash,
            "malformed_bcrypt": malformed,
            "duplicate_normalized_emails": dup_normalized,
        }
    except Exception as e:
        return {"error": f"{type(e).__name__}: {e}"}


async def _orphan_audit(db) -> dict[str, Any]:
    try:
        user_ids = set()
        async for u in db["users"].find({}, {"user_id": 1}):
            uid = u.get("user_id")
            if uid:
                user_ids.add(uid)
        orphans: dict[str, int] = {}
        for coll in ["wallets", "transactions", "budgets", "goals", "plans", "debts", "investments", "assets", "recurring", "categories"]:
            try:
                total = await db[coll].count_documents({})
                if total == 0 or not user_ids:
                    orphans[coll] = 0
                    continue
                # count where user_id not in users
                pipeline = [
                    {"$match": {"user_id": {"$nin": list(user_ids)}}} if user_ids else {"$match": {}},
                    {"$count": "n"},
                ]
                # For large sets, use $nin may be heavy; we do simple count via find
                # Fallback to 0 if too many
                if len(user_ids) > 10000:
                    orphans[coll] = -1
                else:
                    cur = await db[coll].count_documents({"user_id": {"$nin": list(user_ids)}}) if user_ids else 0
                    orphans[coll] = cur
            except Exception:
                orphans[coll] = -1
        return orphans
    except Exception as e:
        return {"error": f"{type(e).__name__}"}


async def _money_audit(db) -> dict[str, Any]:
    try:
        # Sample transactions amount types
        types = Counter()
        async for doc in db["transactions"].find({}, {"amount": 1}).limit(1000):
            v = doc.get("amount")
            t = type(v).__name__
            if isinstance(v, Decimal128):
                t = "Decimal128"
            types[t] += 1
        return dict(types)
    except Exception:
        return {}


async def _date_audit(db) -> dict[str, Any]:
    try:
        fmt = Counter()
        async for doc in db["transactions"].find({}, {"date": 1}).limit(1000):
            d = doc.get("date") or ""
            if re.match(r"^\d{4}-\d{2}-\d{2}$", str(d)):
                fmt["YYYY-MM-DD"] += 1
            elif "T" in str(d):
                fmt["ISO_DATETIME"] += 1
            else:
                fmt["other"] += 1
        return dict(fmt)
    except Exception:
        return {}


async def main_async(args) -> int:
    print("=== Wallume Database Compatibility Audit (READ ONLY) ===")
    # Do not print MONGO_URL
    try:
        db = await get_database()
        # quick ping
        await db.command("ping")
        print("DB: reachable")
    except Exception as e:
        print(f"DB: not reachable ({type(e).__name__})")
        print("PRODUCTION DB AUDIT: NOT PERFORMED (no connection)")
        return 0

    counts = await _counts(db)
    print("Collections:", counts)
    auth = await _auth_audit(db)
    print("Auth:", auth)
    orphans = await _orphan_audit(db)
    print("Orphans (user_id not in users):", orphans)
    money = await _money_audit(db)
    print("Money BSON types (sample 1000 tx):", money)
    dates = await _date_audit(db)
    print("Transaction date formats (sample 1000):", dates)
    print("PRODUCTION DB AUDIT: PERFORMED (sanitized counts only)")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Read-only DB compatibility audit")
    parser.add_argument("--mongo-url", help="override MONGO_URL (not printed)")
    parser.add_argument("--db-name", help="override DB_NAME")
    args = parser.parse_args()
    if args.mongo_url:
        os.environ["MONGO_URL"] = args.mongo_url
    if args.db_name:
        os.environ["DB_NAME"] = args.db_name
    return asyncio.run(main_async(args))


if __name__ == "__main__":
    raise SystemExit(main())

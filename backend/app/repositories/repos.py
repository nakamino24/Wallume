from __future__ import annotations

from typing import Any, Optional
from bson import Decimal128
from pymongo import ReturnDocument
from app.repositories.base import BaseRepository
from app.utils.compat import normalize_transaction_document, normalize_user_document
from app.utils.email import normalize_email
from app.utils.money import from_decimal128


class UserRepository(BaseRepository):
    def __init__(self) -> None:
        super().__init__("users")

    async def find_by_email(self, email: str) -> dict[str, Any] | None:
        doc = await self.find_one({"email": normalize_email(email)})
        return normalize_user_document(doc) if doc else None

    async def find_by_user_id(self, user_id: str) -> dict[str, Any] | None:
        doc = await self.find_one({"user_id": user_id})
        return normalize_user_document(doc) if doc else None

    async def update_profile(self, user_id: str, data: dict) -> None:
        await self.update_one({"user_id": user_id}, {"$set": data})

    async def update_password_and_auth_version(self, user_id: str, password_hash: str) -> bool:
        doc = await (await self._collection()).find_one_and_update(
            {
                "user_id": user_id,
                "deleted_at": None,
                "password_hash": {"$type": "string"},
                # Historical password accounts may predate the provider field.
                # Explicit external-provider users remain ineligible.
                "$or": [{"provider": "email"}, {"provider": {"$exists": False}}],
            },
            {
                "$set": {"password_hash": password_hash, "provider": "email"},
                "$inc": {"auth_version": 1},
            },
            projection={"_id": 0, "user_id": 1},
            return_document=ReturnDocument.AFTER,
        )
        return doc is not None

    async def hard_delete(self, user_id: str) -> None:
        await self.delete_one({"user_id": user_id}, hard=True)


class UserSessionRepository(BaseRepository):
    def __init__(self) -> None:
        super().__init__("user_sessions")

    async def delete_by_user(self, user_id: str) -> None:
        await (await self._collection()).delete_many({"user_id": user_id})


class TokenBlacklistRepository(BaseRepository):
    def __init__(self) -> None:
        super().__init__("token_blacklist")

    async def is_blacklisted(self, jti: str) -> bool:
        return await (await self._collection()).find_one({"jti": jti}) is not None

    async def blacklist(self, jti: str, expires_at: Any) -> None:
        await (await self._collection()).update_one(
            {"jti": jti},
            {"$set": {"jti": jti, "expires_at": expires_at}},
            upsert=True,
        )


class PasswordResetRepository(BaseRepository):
    def __init__(self) -> None:
        super().__init__("password_reset_challenges")

    async def create_challenge(self, doc: dict[str, Any]) -> None:
        await (await self._collection()).insert_one(doc)

    async def find_latest_for_user(self, user_id: str) -> dict[str, Any] | None:
        return await (await self._collection()).find_one(
            {"user_id": user_id, "used_at": None},
            {"_id": 0},
            sort=[("created_at", -1)],
        )

    async def find_by_id(self, request_id: str) -> dict[str, Any] | None:
        return await (await self._collection()).find_one({"id": request_id}, {"_id": 0})

    async def invalidate_for_user(self, user_id: str, now: Any) -> None:
        await (await self._collection()).update_many(
            {"user_id": user_id, "used_at": None},
            {"$set": {"used_at": now}},
        )

    async def invalidate(self, request_id: str, now: Any) -> None:
        await (await self._collection()).update_one(
            {"id": request_id, "used_at": None},
            {"$set": {"used_at": now}},
        )

    async def replace_code(
        self, request_id: str, code_hash: str, created_at: Any, expires_at: Any
    ) -> dict[str, Any] | None:
        return await (await self._collection()).find_one_and_update(
            {"id": request_id, "used_at": None},
            {"$set": {
                "code_hash": code_hash,
                "created_at": created_at,
                "expires_at": expires_at,
                "attempt_count": 0,
                "verified_at": None,
                "reset_token_hash": None,
                "reset_token_expires_at": None,
            }},
            projection={"_id": 0},
            return_document=ReturnDocument.AFTER,
        )

    async def verify_code(
        self,
        request_id: str,
        code_hash: str,
        now: Any,
        max_attempts: int,
        reset_token_hash: str,
        reset_token_expires_at: Any,
    ) -> dict[str, Any] | None:
        return await (await self._collection()).find_one_and_update(
            {
                "id": request_id,
                "code_hash": code_hash,
                "expires_at": {"$gt": now},
                "attempt_count": {"$lt": max_attempts},
                "verified_at": None,
                "used_at": None,
            },
            {"$set": {
                "verified_at": now,
                "reset_token_hash": reset_token_hash,
                "reset_token_expires_at": reset_token_expires_at,
                # Keep the document alive for the reset-token lifetime.
                "expires_at": reset_token_expires_at,
            }},
            projection={"_id": 0},
            return_document=ReturnDocument.AFTER,
        )

    async def record_failed_attempt(
        self, request_id: str, now: Any, max_attempts: int
    ) -> dict[str, Any] | None:
        return await (await self._collection()).find_one_and_update(
            {
                "id": request_id,
                "expires_at": {"$gt": now},
                "attempt_count": {"$lt": max_attempts},
                "verified_at": None,
                "used_at": None,
            },
            {"$inc": {"attempt_count": 1}},
            projection={"_id": 0},
            return_document=ReturnDocument.AFTER,
        )

    async def claim_reset_token(self, reset_token_hash: str, now: Any) -> dict[str, Any] | None:
        return await (await self._collection()).find_one_and_update(
            {
                "reset_token_hash": reset_token_hash,
                "reset_token_expires_at": {"$gt": now},
                "verified_at": {"$ne": None},
                "used_at": None,
            },
            {"$set": {"used_at": now}},
            projection={"_id": 0},
            return_document=ReturnDocument.AFTER,
        )


class WalletRepository(BaseRepository):
    def __init__(self) -> None:
        super().__init__("wallets")

    async def find_by_user(self, user_id: str) -> list[dict]:
        cursor = (await self._collection()).find(
            self._active_filter({"user_id": user_id}), {"_id": 0}
        ).sort("created_at", 1)
        docs = await cursor.to_list(100)
        return self._money_out_list(docs)

    async def adjust_balance(self, wallet_id: str, user_id: str, delta, session=None) -> None:
        # delta may be int/float/Decimal/Decimal128. Decimal128 can't be
        # negated/arith'd, so normalize via to_decimal before signing.
        from app.utils.money import to_decimal128, to_decimal
        signed = to_decimal(delta)
        await (await self._collection(session)).update_one(
            {"id": wallet_id, "user_id": user_id},
            {"$inc": {"balance": to_decimal128(signed)}},
            session=session,
        )


class TransactionRepository(BaseRepository):
    def __init__(self) -> None:
        super().__init__("transactions")

    def _compat_out(self, docs: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return [normalize_transaction_document(doc) for doc in self._money_out_list(docs)]

    async def find_one(self, filter: dict, session=None) -> dict[str, Any] | None:
        doc = await super().find_one(filter, session=session)
        return normalize_transaction_document(doc) if doc else None

    async def find_by_user(self, user_id: str, type_filter: Optional[str] = None,
                           wallet_id: Optional[str] = None, limit: int = 100,
                           from_date: Optional[str] = None, to_date: Optional[str] = None) -> list[dict]:
        q = self._active_filter({"user_id": user_id})
        if type_filter in {"income", "expense", "transfer"}:
            q["type"] = type_filter
        if wallet_id:
            q["$or"] = [{"wallet_id": wallet_id}, {"to_wallet_id": wallet_id}]
        if from_date or to_date:
            date_q: dict[str, str] = {}
            if from_date:
                date_q["$gte"] = from_date
            if to_date:
                # Exclusive upper bound: date < start_of_day_after_to_date
                # e.g., to_date 2026-08-24 → date < "2026-08-25"
                # This correctly includes all of Aug 24 regardless of whether
                # stored date is "2026-08-24" or "2026-08-24T14:00:00Z",
                # and avoids 23:59:59 edge cases. Stored dates are canonical
                # YYYY-MM-DD, so string comparison with next_day is correct.
                try:
                    from datetime import datetime, timedelta
                    next_day = (datetime.fromisoformat(to_date) + timedelta(days=1)).strftime("%Y-%m-%d")
                    date_q["$lt"] = next_day
                except ValueError:
                    date_q["$lte"] = to_date
            q["date"] = date_q
        cursor = (await self._collection()).find(q, {"_id": 0}).sort([
            ("date", -1), ("created_at", -1), ("id", -1)
        ]).limit(limit)
        docs = await cursor.to_list(limit)
        return self._compat_out(docs)

    async def aggregate_report_summary(self, user_id: str, from_date: str, to_date_exclusive: str) -> dict:
        """Return complete cash-flow aggregates for one user's date range.

        Category values mirror JavaScript object-key coercion in the former
        Reports screen: missing -> "undefined", null -> "null", and an empty
        string remains empty.
        """
        zero = Decimal128("0")
        pipeline = [
            {"$match": self._active_filter({
                "user_id": user_id,
                "date": {"$gte": from_date, "$lt": to_date_exclusive},
            })},
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
        result = await (await self._collection()).aggregate(pipeline).to_list(1)
        facet = result[0] if result else {"totals": [], "expense_by_category": []}
        totals = facet["totals"][0] if facet["totals"] else {
            "transaction_count": 0,
            "income_total": zero,
            "expense_total": zero,
            "net_total": zero,
        }
        return {
            "transaction_count": totals["transaction_count"],
            "income_total": from_decimal128(totals["income_total"]),
            "expense_total": from_decimal128(totals["expense_total"]),
            "net_total": from_decimal128(totals["net_total"]),
            "expense_by_category": [
                {"category": row["category"], "amount": from_decimal128(row["amount"])}
                for row in facet["expense_by_category"]
            ],
        }

    async def find_month_txs(self, user_id: str, start_date: str) -> list[dict]:
        q = self._active_filter({"user_id": user_id, "date": {"$gte": start_date}})
        cursor = (await self._collection()).find(q, {"_id": 0, "type": 1, "amount": 1, "category": 1, "date": 1})
        docs = await cursor.to_list(10000)
        return self._compat_out(docs)

    async def count_by_category(self, user_id: str, category_label: str) -> int:
        """Number of transactions currently tagged with a given category label."""
        return await (await self._collection()).count_documents(
            self._active_filter({"user_id": user_id, "category": category_label})
        )

    async def update_category_for_user(
        self, user_id: str, from_label: str, to_label: str
    ) -> None:
        """Reassign every transaction of a user tagged with `from_label` to
        `to_label` (bulk rename). Both labels are plain category-name strings."""
        await (await self._collection()).update_many(
            self._active_filter({"user_id": user_id, "category": from_label}),
            {"$set": {"category": to_label}},
        )


class BudgetRepository(BaseRepository):
    def __init__(self) -> None:
        super().__init__("budgets")


class GoalRepository(BaseRepository):
    def __init__(self) -> None:
        super().__init__("goals")


class PlanRepository(BaseRepository):
    def __init__(self) -> None:
        super().__init__("plans")


class DebtRepository(BaseRepository):
    def __init__(self) -> None:
        super().__init__("debts")


class InvestmentRepository(BaseRepository):
    def __init__(self) -> None:
        super().__init__("investments")


class AssetRepository(BaseRepository):
    def __init__(self) -> None:
        super().__init__("assets")


class RecurringRepository(BaseRepository):
    def __init__(self) -> None:
        super().__init__("recurring")


class ChatMessageRepository(BaseRepository):
    def __init__(self) -> None:
        super().__init__("chat_messages")


class CategoryRepository(BaseRepository):
    def __init__(self) -> None:
        super().__init__("categories")

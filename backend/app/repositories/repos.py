from __future__ import annotations

from typing import Any, Optional
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository):
    def __init__(self) -> None:
        super().__init__("users")

    async def find_by_email(self, email: str) -> dict[str, Any] | None:
        return await self.find_one({"email": email})

    async def find_by_user_id(self, user_id: str) -> dict[str, Any] | None:
        return await self.find_one({"user_id": user_id})

    async def update_profile(self, user_id: str, data: dict) -> None:
        await self.update_one({"user_id": user_id}, {"$set": data})

    async def hard_delete(self, user_id: str) -> None:
        await self.delete_one({"user_id": user_id}, hard=True)


class UserSessionRepository(BaseRepository):
    def __init__(self) -> None:
        super().__init__("user_sessions")


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
        )


class TransactionRepository(BaseRepository):
    def __init__(self) -> None:
        super().__init__("transactions")

    async def find_by_user(self, user_id: str, type_filter: Optional[str] = None,
                           wallet_id: Optional[str] = None, limit: int = 100) -> list[dict]:
        q = self._active_filter({"user_id": user_id})
        if type_filter in {"income", "expense", "transfer"}:
            q["type"] = type_filter
        if wallet_id:
            q["$or"] = [{"wallet_id": wallet_id}, {"to_wallet_id": wallet_id}]
        cursor = (await self._collection()).find(q, {"_id": 0}).sort([
            ("date", -1), ("created_at", -1), ("id", -1)
        ]).limit(limit)
        docs = await cursor.to_list(limit)
        return self._money_out_list(docs)

    async def find_month_txs(self, user_id: str, start_date: str) -> list[dict]:
        q = self._active_filter({"user_id": user_id, "date": {"$gte": start_date}})
        cursor = (await self._collection()).find(q, {"_id": 0, "type": 1, "amount": 1, "category": 1, "date": 1})
        docs = await cursor.to_list(10000)
        return self._money_out_list(docs)

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
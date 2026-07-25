from __future__ import annotations

from typing import Any
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

    async def delete_account(self, user_id: str) -> None:
        await self.delete_one({"user_id": user_id})


class UserSessionRepository(BaseRepository):
    def __init__(self) -> None:
        super().__init__("user_sessions")


class TokenBlacklistRepository(BaseRepository):
    def __init__(self) -> None:
        super().__init__("token_blacklist")

    async def is_blacklisted(self, jti: str) -> bool:
        return await self.find_one({"jti": jti}) is not None

    async def blacklist(self, jti: str, expires_at: Any) -> None:
        await self.update_one(
            {"jti": jti},
            {"$set": {"jti": jti, "expires_at": expires_at}},
            upsert=True,
        )


class WalletRepository(BaseRepository):
    def __init__(self) -> None:
        super().__init__("wallets")

    async def find_by_user(self, user_id: str) -> list[dict]:
        return await (await self._collection()).find(
            {"user_id": user_id}, {"_id": 0}
        ).sort("created_at", 1).to_list(100)

    async def adjust_balance(self, wallet_id: str, user_id: str, delta: float) -> None:
        await self.update_one({"id": wallet_id, "user_id": user_id}, {"$inc": {"balance": delta}})


class TransactionRepository(BaseRepository):
    def __init__(self) -> None:
        super().__init__("transactions")

    async def find_by_user(self, user_id: str, type_filter: str | None = None, limit: int = 100) -> list[dict]:
        q: dict = {"user_id": user_id}
        if type_filter in {"income", "expense", "transfer"}:
            q["type"] = type_filter
        return await (await self._collection()).find(q, {"_id": 0}).sort("date", -1).limit(limit).to_list(limit)


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
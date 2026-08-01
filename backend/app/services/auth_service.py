from __future__ import annotations

from typing import Any, Optional
from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.database.mongo import get_database
from app.repositories.repos import (
    UserRepository, UserSessionRepository, TokenBlacklistRepository,
    WalletRepository, TransactionRepository, BudgetRepository,
    GoalRepository, PlanRepository, DebtRepository,
    InvestmentRepository, AssetRepository, RecurringRepository,
    ChatMessageRepository,
)
from app.security.auth import hash_password, verify_password, create_access_token, decode_access_token
from app.utils.helpers import new_id, now_utc, clean_user
from app.utils.money import round_money


class AuthService:
    def __init__(self) -> None:
        self.users = UserRepository()
        self.sessions = UserSessionRepository()
        self.blacklist = TokenBlacklistRepository()

    async def signup(self, email: str, password: str, name: str, payday_day: Optional[int] = None, currency: Optional[str] = None) -> dict:
        pw = password
        if len(pw) < 8:
            raise HTTPException(400, "Password must be at least 8 characters")
        if not any(c.isdigit() for c in pw):
            raise HTTPException(400, "Password must contain at least one number")
        if not any(c.isupper() for c in pw):
            raise HTTPException(400, "Password must contain at least one uppercase letter")

        existing = await self.users.find_by_email(email.lower())
        if existing:
            raise HTTPException(400, "Email already registered")

        user_id = new_id("user")
        doc = {
            "user_id": user_id,
            "email": email.lower(),
            "name": name.strip() or email.split("@")[0],
            "password_hash": hash_password(password),
            "picture": None,
            "provider": "email",
            "currency": currency or "USD",
            "theme": "light",
            "payday_day": payday_day if payday_day and 1 <= payday_day <= 31 else None,
            "created_at": now_utc(),
        }
        await self.users.insert_one(doc)
        return {"token": create_access_token(user_id), "user": clean_user(doc)}

    async def login(self, email: str, password: str) -> dict:
        user = await self.users.find_by_email(email.lower())
        if not user or not user.get("password_hash") or not verify_password(password, user["password_hash"]):
            raise HTTPException(401, "Invalid credentials")
        return {"token": create_access_token(user["user_id"]), "user": clean_user(user)}

    async def get_current_user(self, authorization: Optional[str]) -> dict:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(401, "Missing bearer token")
        token = authorization.split(" ", 1)[1]
        try:
            payload = decode_access_token(token)
            jti = payload.get("jti", "")
            if jti and await self.blacklist.is_blacklisted(jti):
                raise HTTPException(401, "Token revoked")
            user = await self.users.find_by_user_id(payload["sub"])
            if user:
                return user
        except Exception:
            pass
        session = await self.sessions.find_one({"session_token": token})
        if not session:
            raise HTTPException(401, "Invalid or expired token")
        exp = session["expires_at"]
        if exp.tzinfo is None:
            from datetime import timezone
            exp = exp.replace(tzinfo=timezone.utc)
        if exp < now_utc():
            raise HTTPException(401, "Session expired")
        user = await self.users.find_by_user_id(session["user_id"])
        if not user:
            raise HTTPException(401, "User not found")
        return user

    async def logout(self, authorization: Optional[str]) -> None:
        if authorization and authorization.startswith("Bearer "):
            token = authorization.split(" ", 1)[1]
            await self.sessions.delete_many({"session_token": token})
            try:
                payload = decode_access_token(token)
                jti = payload.get("jti")
                exp = payload.get("exp")
                if jti:
                    from datetime import datetime, timezone
                    await self.blacklist.blacklist(
                        jti,
                        datetime.fromtimestamp(exp, tz=timezone.utc) if exp else now_utc(),
                    )
            except Exception:
                pass

    async def update_profile(self, authorization: Optional[str], body: dict) -> dict:
        user = await self.get_current_user(authorization)
        allowed = {k: v for k, v in body.items() if k in {"name", "currency", "theme", "picture", "payday_day"}}
        if allowed:
            await self.users.update_profile(user["user_id"], allowed)
        updated = await self.users.find_by_user_id(user["user_id"])
        if not updated:
            raise HTTPException(404, "User not found")
        return clean_user(updated)

    async def delete_account(self, authorization: Optional[str]) -> None:
        u = await self.get_current_user(authorization)
        uid = u["user_id"]
        collections = [
            "wallets", "transactions", "budgets", "goals", "plans",
            "debts", "investments", "assets", "chat_messages",
            "recurring", "user_sessions", "categories",
        ]
        db: AsyncIOMotorDatabase = await get_database()
        for coll in collections:
            await db[coll].delete_many({"user_id": uid})
        await self.users.delete_account(uid)
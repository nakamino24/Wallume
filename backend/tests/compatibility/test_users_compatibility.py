import unittest
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException

from app.repositories.base import BaseRepository
from app.repositories.repos import UserRepository
from app.security.auth import hash_password
from app.services.auth_service import AuthService
from app.utils.email import normalize_email


PASSWORD = "Password123"


def email_user(**overrides):
    doc = {
        "user_id": "user_abc123",
        "email": "alex@wallume.app",
        "name": "Alex",
        "password_hash": hash_password(PASSWORD),
        "provider": "email",
        "currency": "IDR",
        "theme": "dark",
        "payday_day": 25,
        "work_week": 5,
        "created_at": "2026-08-28T00:00:00Z",
    }
    doc.update(overrides)
    return doc


class UserRepositoryCompatibilityTests(unittest.IsolatedAsyncioTestCase):
    async def test_repository_normalizes_legacy_missing_optionals_non_destructively(self):
        raw = email_user()
        raw["legacy_marker"] = "preserve-me"
        for field in ("picture", "currency", "theme", "payday_day", "work_week"):
            raw.pop(field, None)

        repo = UserRepository()
        with patch.object(BaseRepository, "find_one", AsyncMock(return_value=raw)) as find_one:
            user = await repo.find_by_user_id("user_abc123")

        find_one.assert_awaited_once_with({"user_id": "user_abc123"})
        self.assertEqual(user["user_id"], raw["user_id"])
        self.assertEqual(user["password_hash"], raw["password_hash"])
        self.assertEqual(user["provider"], "email")
        self.assertEqual(user["currency"], "USD")
        self.assertEqual(user["theme"], "light")
        self.assertIsNone(user["payday_day"])
        self.assertEqual(user["work_week"], 5)
        self.assertEqual(user["created_at"], raw["created_at"])
        self.assertEqual(user["legacy_marker"], "preserve-me")
        self.assertNotIn("currency", raw)

    async def test_email_lookup_normalizes_input_but_remains_exact(self):
        repo = UserRepository()
        with patch.object(BaseRepository, "find_one", AsyncMock(return_value=None)) as find_one:
            await repo.find_by_email("  Alex@Wallume.App ")
        find_one.assert_awaited_once_with({"email": "alex@wallume.app"})


class AuthServiceContractTests(unittest.IsolatedAsyncioTestCase):
    async def test_login_current_user_correct_password(self):
        service = AuthService()
        service.users.find_by_email = AsyncMock(return_value=email_user())
        result = await service.login(" ALEX@wallume.app ", PASSWORD)
        self.assertTrue(result["token"])
        self.assertEqual(result["user"]["user_id"], "user_abc123")
        service.users.find_by_email.assert_awaited_once_with("alex@wallume.app")

    async def test_login_wrong_password_is_401(self):
        service = AuthService()
        service.users.find_by_email = AsyncMock(return_value=email_user())
        with self.assertRaises(HTTPException) as raised:
            await service.login("alex@wallume.app", "WrongPass123")
        self.assertEqual(raised.exception.status_code, 401)

    async def test_external_provider_without_password_is_401(self):
        service = AuthService()
        service.users.find_by_email = AsyncMock(return_value=email_user(provider="google", password_hash=None))
        with self.assertRaises(HTTPException) as raised:
            await service.login("alex@wallume.app", PASSWORD)
        self.assertEqual(raised.exception.status_code, 401)

    async def test_legacy_user_flows_repository_to_login_with_same_identity(self):
        raw = email_user()
        for field in ("picture", "currency", "theme", "payday_day", "work_week"):
            raw.pop(field, None)
        service = AuthService()
        with patch.object(BaseRepository, "find_one", AsyncMock(return_value=raw)):
            result = await service.login("alex@wallume.app", PASSWORD)
        user = result["user"]
        self.assertEqual(user["user_id"], raw["user_id"])
        self.assertEqual(user["currency"], "USD")
        self.assertEqual(user["theme"], "light")
        self.assertEqual(user["work_week"], 5)

    async def test_signup_duplicate_normalized_email_does_not_insert(self):
        service = AuthService()
        service.users.find_by_email = AsyncMock(return_value=email_user())
        service.users.insert_one = AsyncMock()
        with self.assertRaises(HTTPException) as raised:
            await service.signup(" ALEX@WALLUME.APP ", PASSWORD, "Alex")
        self.assertEqual(raised.exception.status_code, 400)
        service.users.find_by_email.assert_awaited_once_with("alex@wallume.app")
        service.users.insert_one.assert_not_awaited()


def test_normalize_email_is_input_normalization():
    assert normalize_email(" User@Example.com ") == "user@example.com"

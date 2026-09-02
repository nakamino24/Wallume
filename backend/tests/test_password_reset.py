from __future__ import annotations

import copy
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import jwt
from fastapi import HTTPException

from app.core.config import Settings, settings
from app.database.mongo import _create_password_reset_indexes
from app.repositories.repos import UserRepository
from app.security.auth import create_access_token, hash_password, verify_password
from app.services.auth_service import AuthService
from app.services.email_sender import ResendPasswordResetMailer
from app.services.password_reset_service import PasswordResetService


OLD_PASSWORD = "Password123"
NEW_PASSWORD = "NewPassword456"


class FakeMailer:
    def __init__(self) -> None:
        self.deliveries: list[dict] = []

    async def send_password_reset_code(
        self, email: str, code: str, expires_minutes: int, locale: str
    ) -> None:
        self.deliveries.append({
            "email": email,
            "code": code,
            "expires_minutes": expires_minutes,
            "locale": locale,
        })


class FakeBackgroundTasks:
    def __init__(self) -> None:
        self.tasks: list[tuple] = []

    def add_task(self, func, *args, **kwargs) -> None:
        self.tasks.append((func, args, kwargs))

    async def run(self) -> None:
        for func, args, kwargs in self.tasks:
            await func(*args, **kwargs)


class FakeUsers:
    def __init__(self, user: dict | None) -> None:
        self.user = copy.deepcopy(user)
        self.update_calls = 0

    async def find_by_email(self, email: str) -> dict | None:
        if self.user and self.user["email"] == email:
            return copy.deepcopy(self.user)
        return None

    async def find_by_user_id(self, user_id: str) -> dict | None:
        if self.user and self.user["user_id"] == user_id:
            return copy.deepcopy(self.user)
        return None

    async def update_password_and_auth_version(
        self, user_id: str, password_hash: str
    ) -> bool:
        if (
            not self.user
            or self.user["user_id"] != user_id
            or self.user.get("provider") != "email"
        ):
            return False
        self.user["password_hash"] = password_hash
        self.user["auth_version"] = self.user.get("auth_version", 0) + 1
        self.update_calls += 1
        return True


class FakeUserDirectory:
    def __init__(self, users: list[dict]) -> None:
        self.users = {user["user_id"]: copy.deepcopy(user) for user in users}

    async def find_by_email(self, email: str) -> dict | None:
        for user in self.users.values():
            if user["email"].lower() == email:
                return copy.deepcopy(user)
        return None

    async def find_by_user_id(self, user_id: str) -> dict | None:
        user = self.users.get(user_id)
        return copy.deepcopy(user) if user else None


class FakeSessions:
    def __init__(self) -> None:
        self.deleted_user_ids: list[str] = []

    async def delete_by_user(self, user_id: str) -> None:
        self.deleted_user_ids.append(user_id)


class FakeChallenges:
    def __init__(self) -> None:
        self.docs: dict[str, dict] = {}

    async def create_challenge(self, doc: dict) -> None:
        self.docs[doc["id"]] = copy.deepcopy(doc)

    async def find_latest_for_user(self, user_id: str) -> dict | None:
        docs = [
            doc for doc in self.docs.values()
            if doc["user_id"] == user_id and doc.get("used_at") is None
        ]
        return copy.deepcopy(max(docs, key=lambda doc: doc["created_at"])) if docs else None

    async def find_by_id(self, request_id: str) -> dict | None:
        doc = self.docs.get(request_id)
        return copy.deepcopy(doc) if doc else None

    async def invalidate_for_user(self, user_id: str, now: datetime) -> None:
        for doc in self.docs.values():
            if doc["user_id"] == user_id and doc.get("used_at") is None:
                doc["used_at"] = now

    async def invalidate(self, request_id: str, now: datetime) -> None:
        doc = self.docs.get(request_id)
        if doc and doc.get("used_at") is None:
            doc["used_at"] = now

    async def replace_code(
        self,
        request_id: str,
        code_hash: str,
        created_at: datetime,
        expires_at: datetime,
    ) -> dict | None:
        doc = self.docs.get(request_id)
        if not doc or doc.get("used_at") is not None:
            return None
        doc.update({
            "code_hash": code_hash,
            "created_at": created_at,
            "expires_at": expires_at,
            "attempt_count": 0,
            "verified_at": None,
            "reset_token_hash": None,
            "reset_token_expires_at": None,
        })
        return copy.deepcopy(doc)

    async def verify_code(
        self,
        request_id: str,
        code_hash: str,
        now: datetime,
        max_attempts: int,
        reset_token_hash: str,
        reset_token_expires_at: datetime,
    ) -> dict | None:
        doc = self.docs.get(request_id)
        if not doc or not (
            doc["code_hash"] == code_hash
            and doc["expires_at"] > now
            and doc["attempt_count"] < max_attempts
            and doc.get("verified_at") is None
            and doc.get("used_at") is None
        ):
            return None
        doc.update({
            "verified_at": now,
            "reset_token_hash": reset_token_hash,
            "reset_token_expires_at": reset_token_expires_at,
            "expires_at": reset_token_expires_at,
        })
        return copy.deepcopy(doc)

    async def record_failed_attempt(
        self, request_id: str, now: datetime, max_attempts: int
    ) -> dict | None:
        doc = self.docs.get(request_id)
        if not doc or not (
            doc["expires_at"] > now
            and doc["attempt_count"] < max_attempts
            and doc.get("verified_at") is None
            and doc.get("used_at") is None
        ):
            return None
        doc["attempt_count"] += 1
        return copy.deepcopy(doc)

    async def claim_reset_token(
        self, reset_token_hash: str, now: datetime
    ) -> dict | None:
        for doc in self.docs.values():
            if (
                doc.get("reset_token_hash") == reset_token_hash
                and doc.get("reset_token_expires_at") > now
                and doc.get("verified_at") is not None
                and doc.get("used_at") is None
            ):
                doc["used_at"] = now
                return copy.deepcopy(doc)
        return None


def email_user(**overrides) -> dict:
    user = {
        "user_id": "user_password_reset",
        "email": "alex@wallume.app",
        "provider": "email",
        "password_hash": hash_password(OLD_PASSWORD),
        "auth_version": 0,
        # Representative user-owned financial state must remain untouched.
        "financial_fixture": {"wallet_ids": ["wallet_1"], "transaction_count": 7},
    }
    user.update(overrides)
    return user


def enabled_settings(**overrides) -> Settings:
    values = {
        "password_reset_enabled": True,
        "password_reset_secret": "password-reset-test-secret-that-is-at-least-32-chars",
        "password_reset_cooldown_seconds": 60,
        "password_reset_max_attempts": 5,
    }
    values.update(overrides)
    return Settings(**values)


class PasswordResetServiceTests(unittest.IsolatedAsyncioTestCase):
    def make_service(self, user: dict | None = None):
        mailer = FakeMailer()
        service = PasswordResetService(enabled_settings(), mailer)
        service.users = FakeUsers(email_user() if user is None else user)
        service.sessions = FakeSessions()
        service.challenges = FakeChallenges()
        return service, mailer

    async def request_and_code(self, service, mailer):
        response = await service.request(" ALEX@WALLUME.APP ", "id")
        return response["request_id"], mailer.deliveries[-1]["code"]

    async def test_request_is_generic_and_stores_only_hmac_code(self):
        service, mailer = self.make_service()
        response = await service.request(" ALEX@WALLUME.APP ", "id")
        request_id = response["request_id"]
        challenge = service.challenges.docs[request_id]

        self.assertEqual(
            response["message"],
            "If an eligible account exists, a verification code has been sent.",
        )
        self.assertEqual(mailer.deliveries[0]["email"], "alex@wallume.app")
        self.assertEqual(mailer.deliveries[0]["locale"], "id")
        self.assertNotIn(mailer.deliveries[0]["code"], repr(challenge))
        self.assertEqual(len(challenge["code_hash"]), 64)
        self.assertIsNone(challenge["reset_token_hash"])

    async def test_two_users_receive_only_their_own_challenge_code(self):
        owner = email_user(
            user_id="user_owner",
            email="owner@wallume.app",
        )
        member = email_user(
            user_id="user_member",
            email="member@wallume.app",
        )
        service, mailer = self.make_service(owner)
        service.users = FakeUserDirectory([owner, member])

        owner_response = await service.request(" OWNER@WALLUME.APP ", "en")
        member_response = await service.request(" MEMBER@WALLUME.APP ", "id")

        self.assertEqual(
            [delivery["email"] for delivery in mailer.deliveries],
            [owner["email"], member["email"]],
        )
        self.assertEqual(
            service.challenges.docs[owner_response["request_id"]]["user_id"],
            owner["user_id"],
        )
        self.assertEqual(
            service.challenges.docs[member_response["request_id"]]["user_id"],
            member["user_id"],
        )
        self.assertEqual(mailer.deliveries[0]["locale"], "en")
        self.assertEqual(mailer.deliveries[1]["locale"], "id")

    async def test_http_request_defers_account_work_until_after_public_response(self):
        service, mailer = self.make_service()
        background_tasks = FakeBackgroundTasks()

        response = await service.request(
            " ALEX@WALLUME.APP ", "id", background_tasks
        )

        self.assertEqual(set(response), {"request_id", "message"})
        self.assertEqual(service.challenges.docs, {})
        self.assertEqual(mailer.deliveries, [])
        self.assertEqual(len(background_tasks.tasks), 1)

        await background_tasks.run()
        self.assertIn(response["request_id"], service.challenges.docs)
        self.assertEqual(len(mailer.deliveries), 1)

    async def test_missing_and_external_accounts_have_same_public_shape(self):
        eligible, _ = self.make_service()
        missing, missing_mailer = self.make_service(user={})
        external, external_mailer = self.make_service(
            email_user(provider="google", password_hash=None)
        )

        responses = [
            await eligible.request("alex@wallume.app"),
            await missing.request("missing@wallume.app"),
            await external.request("alex@wallume.app"),
        ]
        for response in responses:
            self.assertEqual(set(response), {"request_id", "message"})
            self.assertEqual(response["message"], responses[0]["message"])
        self.assertEqual(missing_mailer.deliveries, [])
        self.assertEqual(external_mailer.deliveries, [])
        self.assertEqual(external.users.update_calls, 0)

    async def test_request_cooldown_does_not_send_second_code(self):
        service, mailer = self.make_service()
        first = await service.request("alex@wallume.app")
        second = await service.request("alex@wallume.app")

        self.assertNotEqual(first["request_id"], second["request_id"])
        self.assertEqual(len(mailer.deliveries), 1)
        self.assertEqual(len(service.challenges.docs), 1)

    async def test_wrong_code_counts_and_locks_at_five_attempts(self):
        service, mailer = self.make_service()
        request_id, correct_code = await self.request_and_code(service, mailer)

        for _ in range(5):
            with self.assertRaises(HTTPException) as raised:
                await service.verify(request_id, "000000")
            self.assertEqual(raised.exception.status_code, 400)
        self.assertEqual(service.challenges.docs[request_id]["attempt_count"], 5)
        with self.assertRaises(HTTPException):
            await service.verify(request_id, correct_code)

    async def test_expired_code_and_verified_code_replay_fail(self):
        service, mailer = self.make_service()
        request_id, code = await self.request_and_code(service, mailer)
        service.challenges.docs[request_id]["expires_at"] = datetime.now(timezone.utc) - timedelta(seconds=1)
        with self.assertRaises(HTTPException):
            await service.verify(request_id, code)

        service, mailer = self.make_service()
        request_id, code = await self.request_and_code(service, mailer)
        await service.verify(request_id, code)
        with self.assertRaises(HTTPException):
            await service.verify(request_id, code)

    async def test_resend_invalidates_old_code_and_accepts_new_code(self):
        service, mailer = self.make_service()
        request_id, old_code = await self.request_and_code(service, mailer)
        service.challenges.docs[request_id]["created_at"] -= timedelta(seconds=61)

        await service.resend(request_id)
        new_code = mailer.deliveries[-1]["code"]
        self.assertEqual(len(mailer.deliveries), 2)
        self.assertNotEqual(old_code, new_code)
        with self.assertRaises(HTTPException):
            await service.verify(request_id, old_code)
        result = await service.verify(request_id, new_code)
        self.assertTrue(result["reset_token"])

    async def test_resend_defers_eligible_challenge_until_after_response(self):
        service, mailer = self.make_service()
        request_id, _ = await self.request_and_code(service, mailer)
        service.challenges.docs[request_id]["created_at"] -= timedelta(seconds=61)
        mailer.deliveries.clear()
        background_tasks = FakeBackgroundTasks()

        response = await service.resend(request_id, background_tasks)

        self.assertEqual(response, service._response(request_id))
        self.assertEqual(mailer.deliveries, [])
        self.assertEqual(len(background_tasks.tasks), 1)

        await background_tasks.run()
        self.assertEqual(len(mailer.deliveries), 1)

    async def test_resend_public_response_is_identical_for_ineligible_cases(self):
        cases: list[tuple[str, PasswordResetService, FakeMailer]] = []

        missing, missing_mailer = self.make_service()
        cases.append(("missing-request-id", missing, missing_mailer))

        used, used_mailer = self.make_service()
        used_id, _ = await self.request_and_code(used, used_mailer)
        used.challenges.docs[used_id]["used_at"] = datetime.now(timezone.utc)
        used_mailer.deliveries.clear()
        cases.append((used_id, used, used_mailer))

        external, external_mailer = self.make_service(
            email_user(provider="google", password_hash=None)
        )
        external_id = "external-provider-request-id"
        now = datetime.now(timezone.utc)
        await external.challenges.create_challenge({
            "id": external_id,
            "user_id": "user_password_reset",
            "created_at": now - timedelta(seconds=61),
            "expires_at": now + timedelta(minutes=10),
            "used_at": None,
        })
        cases.append((external_id, external, external_mailer))

        cooling, cooling_mailer = self.make_service()
        cooling_id, _ = await self.request_and_code(cooling, cooling_mailer)
        cooling_mailer.deliveries.clear()
        cases.append((cooling_id, cooling, cooling_mailer))

        expired, expired_mailer = self.make_service()
        expired_id, _ = await self.request_and_code(expired, expired_mailer)
        expired.challenges.docs[expired_id]["created_at"] -= timedelta(seconds=61)
        expired.challenges.docs[expired_id]["expires_at"] = (
            datetime.now(timezone.utc) - timedelta(seconds=1)
        )
        expired_mailer.deliveries.clear()
        cases.append((expired_id, expired, expired_mailer))

        public_shapes = []
        for request_id, service, mailer in cases:
            background_tasks = FakeBackgroundTasks()
            response = await service.resend(request_id, background_tasks)
            public_shapes.append({"keys": set(response), "message": response["message"]})
            self.assertEqual(mailer.deliveries, [])
            self.assertEqual(len(background_tasks.tasks), 1)
            await background_tasks.run()
            self.assertEqual(mailer.deliveries, [])

        self.assertTrue(all(shape == public_shapes[0] for shape in public_shapes))

    async def test_reset_preserves_identity_and_financial_state_and_revokes_sessions(self):
        service, mailer = self.make_service()
        original_user_id = service.users.user["user_id"]
        financial_before = copy.deepcopy(service.users.user["financial_fixture"])
        request_id, code = await self.request_and_code(service, mailer)
        verified = await service.verify(request_id, code)

        self.assertNotIn(verified["reset_token"], repr(service.challenges.docs[request_id]))
        await service.confirm(verified["reset_token"], NEW_PASSWORD, NEW_PASSWORD)

        self.assertEqual(service.users.user["user_id"], original_user_id)
        self.assertEqual(service.users.user["financial_fixture"], financial_before)
        self.assertFalse(verify_password(OLD_PASSWORD, service.users.user["password_hash"]))
        self.assertTrue(verify_password(NEW_PASSWORD, service.users.user["password_hash"]))
        self.assertEqual(service.users.user["auth_version"], 1)
        self.assertEqual(service.sessions.deleted_user_ids, [original_user_id])

        auth = AuthService()
        auth.users = service.users
        with self.assertRaises(HTTPException):
            await auth.login("alex@wallume.app", OLD_PASSWORD)
        login = await auth.login("alex@wallume.app", NEW_PASSWORD)
        self.assertEqual(login["user"]["user_id"], original_user_id)
        self.assertTrue(login["token"])
        with self.assertRaises(HTTPException):
            await service.confirm(verified["reset_token"], NEW_PASSWORD, NEW_PASSWORD)

    async def test_random_and_expired_reset_tokens_fail(self):
        service, mailer = self.make_service()
        request_id, code = await self.request_and_code(service, mailer)
        verified = await service.verify(request_id, code)
        with self.assertRaises(HTTPException):
            await service.confirm("not-the-issued-token", NEW_PASSWORD, NEW_PASSWORD)

        service.challenges.docs[request_id]["reset_token_expires_at"] = (
            datetime.now(timezone.utc) - timedelta(seconds=1)
        )
        with self.assertRaises(HTTPException):
            await service.confirm(verified["reset_token"], NEW_PASSWORD, NEW_PASSWORD)

    async def test_password_confirmation_and_policy_are_shared_with_signup(self):
        service, _ = self.make_service()
        with self.assertRaisesRegex(HTTPException, "confirmation"):
            await service.confirm("token", NEW_PASSWORD, "Different123")
        with self.assertRaisesRegex(HTTPException, "uppercase"):
            await service.confirm("token", "password1", "password1")


class AuthVersionTests(unittest.IsolatedAsyncioTestCase):
    async def test_legacy_jwt_without_version_remains_valid_at_version_zero(self):
        service = AuthService()
        user = email_user()
        user.pop("auth_version")
        service.users.find_by_user_id = AsyncMock(return_value=user)
        service.blacklist.is_blacklisted = AsyncMock(return_value=False)
        now = datetime.now(timezone.utc)
        token = jwt.encode(
            {
                "sub": user["user_id"],
                "jti": "legacy-jti",
                "iat": int(now.timestamp()),
                "exp": int((now + timedelta(minutes=5)).timestamp()),
            },
            settings.jwt_secret,
            algorithm=settings.jwt_algorithm,
        )
        current = await service.get_current_user(f"Bearer {token}")
        self.assertEqual(current["user_id"], user["user_id"])

    async def test_old_jwt_is_rejected_after_auth_version_increment(self):
        service = AuthService()
        user = email_user(auth_version=0)
        old_token = create_access_token(user["user_id"], 0)
        service.blacklist.is_blacklisted = AsyncMock(return_value=False)
        service.users.find_by_user_id = AsyncMock(return_value=user)
        self.assertEqual(
            (await service.get_current_user(f"Bearer {old_token}"))["user_id"],
            user["user_id"],
        )

        user["auth_version"] = 1
        service.users.find_by_user_id = AsyncMock(return_value=user)
        with self.assertRaises(HTTPException) as raised:
            await service.get_current_user(f"Bearer {old_token}")
        self.assertEqual(raised.exception.status_code, 401)

        new_token = create_access_token(user["user_id"], 1)
        self.assertEqual(
            (await service.get_current_user(f"Bearer {new_token}"))["user_id"],
            user["user_id"],
        )


class PasswordResetIndexTests(unittest.IsolatedAsyncioTestCase):
    async def test_challenge_indexes_include_unique_id_and_ttl(self):
        collection = type("Collection", (), {"create_index": AsyncMock()})()
        database = type("Database", (), {"password_reset_challenges": collection})()

        await _create_password_reset_indexes(database)

        collection.create_index.assert_any_await("id", unique=True)
        collection.create_index.assert_any_await("expires_at", expireAfterSeconds=0)
        collection.create_index.assert_any_await("reset_token_hash", sparse=True)


class PasswordResetRepositoryTests(unittest.IsolatedAsyncioTestCase):
    async def test_password_update_accepts_legacy_email_user_but_excludes_external_provider(self):
        collection = type("Collection", (), {"find_one_and_update": AsyncMock(return_value={"user_id": "user_1"})})()
        repository = UserRepository()
        repository._collection = AsyncMock(return_value=collection)

        updated = await repository.update_password_and_auth_version("user_1", "new-hash")

        self.assertTrue(updated)
        query = collection.find_one_and_update.await_args.args[0]
        update = collection.find_one_and_update.await_args.args[1]
        self.assertEqual(query["$or"], [
            {"provider": "email"},
            {"provider": {"$exists": False}},
        ])
        self.assertEqual(update["$set"]["provider"], "email")
        self.assertEqual(update["$inc"]["auth_version"], 1)


class PasswordResetMailerTests(unittest.IsolatedAsyncioTestCase):
    async def test_resend_boundary_sends_only_minimal_localized_reset_content(self):
        response = type("Response", (), {"raise_for_status": lambda self: None})()

        class FakeHttpClient:
            def __init__(self) -> None:
                self.post = AsyncMock(return_value=response)

            async def __aenter__(self):
                return self

            async def __aexit__(self, *_args):
                return None

        client = FakeHttpClient()
        config = enabled_settings(
            password_reset_email_provider="resend",
            password_reset_from_email="Wallume <support@wallume.app>",
            resend_api_key="re_test_secret",
        )
        mailer = ResendPasswordResetMailer(config)

        with patch("app.services.email_sender.httpx.AsyncClient", return_value=client):
            await mailer.send_password_reset_code(
                "alex@wallume.app", "123456", 10, "id"
            )

        _, kwargs = client.post.await_args
        payload = kwargs["json"]
        self.assertEqual(payload["to"], ["alex@wallume.app"])
        self.assertIn("10 menit", payload["text"])
        self.assertIn("123456", payload["text"])
        self.assertNotIn("wallet", repr(payload).lower())
        self.assertNotIn("balance", repr(payload).lower())
        self.assertEqual(kwargs["headers"]["Authorization"], "Bearer re_test_secret")

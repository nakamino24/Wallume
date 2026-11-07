"""Tenancy caching.

Scope resolution runs for EVERY authenticated request, so it is cached with a
short TTL. The danger is the obvious one: a stale scope after membership
changes would show the wrong (or empty) ledger — and for a joiner it would look
like their data vanished.
"""
import sys
import time
from unittest.mock import AsyncMock

import pytest

sys.path.insert(0, "D:/Wallume/backend")

from app.services import tenancy_service as tenancy


@pytest.fixture(autouse=True)
def clear_cache():
    tenancy.invalidate_scope_cache()
    yield
    tenancy.invalidate_scope_cache()


def _run(coro):
    import asyncio
    return asyncio.run(coro)


def _user(uid="u1"):
    return {"user_id": uid}


def test_scope_is_cached_between_calls(monkeypatch):
    calls = []

    async def ensure(user):
        calls.append(user["user_id"])
        return "u1"

    monkeypatch.setattr(tenancy, "ensure_personal_household", ensure)

    assert _run(tenancy.resolve_scope(_user("u1"))) == "u1"
    assert _run(tenancy.resolve_scope(_user("u1"))) == "u1"
    # One DB round trip for two requests.
    assert calls == ["u1"]


def test_different_users_are_cached_independently(monkeypatch):
    async def ensure(user):
        return f"scope_{user['user_id']}"

    monkeypatch.setattr(tenancy, "ensure_personal_household", ensure)
    assert _run(tenancy.resolve_scope(_user("a"))) == "scope_a"
    assert _run(tenancy.resolve_scope(_user("b"))) == "scope_b"


def test_invalidate_forces_a_fresh_lookup(monkeypatch):
    values = ["u1", "shared"]

    async def ensure(_user):
        return values.pop(0)

    monkeypatch.setattr(tenancy, "ensure_personal_household", ensure)

    assert _run(tenancy.resolve_scope(_user("u1"))) == "u1"
    tenancy.invalidate_scope_cache("u1")
    assert _run(tenancy.resolve_scope(_user("u1"))) == "shared"


def test_invalidate_all_clears_every_user(monkeypatch):
    async def ensure(user):
        return f"scope_{user['user_id']}"

    monkeypatch.setattr(tenancy, "ensure_personal_household", ensure)
    _run(tenancy.resolve_scope(_user("a")))
    _run(tenancy.resolve_scope(_user("b")))
    tenancy.invalidate_scope_cache()
    assert tenancy._scope_cache == {}


def test_cache_expires_after_the_ttl(monkeypatch):
    calls = []

    async def ensure(_user):
        calls.append(1)
        return "u1"

    monkeypatch.setattr(tenancy, "ensure_personal_household", ensure)

    _run(tenancy.resolve_scope(_user("u1")))
    # Pretend the entry is old.
    scope, _ts = tenancy._scope_cache["u1"]
    tenancy._scope_cache["u1"] = (scope, time.time() - tenancy._SCOPE_TTL_SECONDS - 1)
    _run(tenancy.resolve_scope(_user("u1")))
    assert len(calls) == 2


def test_joining_invalidates_the_joiners_scope(monkeypatch):
    """The regression this cache could have introduced.

    Without invalidation, a joiner keeps serving their old personal scope and
    their shared household appears empty for up to the TTL.
    """
    async def for_user(_uid):
        return {"id": "m1", "household_id": "hh_solo", "role": tenancy.ROLE_MEMBER}

    async def noop(*args, **kwargs):
        return None

    async def detail(_uid):
        return {"id": "hh_shared"}

    monkeypatch.setattr(tenancy.members, "for_user", for_user)
    monkeypatch.setattr(tenancy.households, "by_invite_code", AsyncMock(return_value={"id": "hh_shared"}))
    monkeypatch.setattr(tenancy.members, "delete_one", noop)
    monkeypatch.setattr(tenancy.members, "insert_one", noop)
    monkeypatch.setattr(tenancy, "_rescore_owned_documents", noop)
    monkeypatch.setattr(tenancy, "household_detail", detail)

    # Prime the cache with the pre-join scope.
    tenancy._scope_cache["u1"] = ("hh_solo", time.time())
    _run(tenancy.join_household("u1", "CODE"))
    assert "u1" not in tenancy._scope_cache


def test_leaving_invalidates_the_scope(monkeypatch):
    async def for_user(_uid):
        return {"id": "m1", "household_id": "hh_shared", "role": tenancy.ROLE_MEMBER}

    async def noop(*args, **kwargs):
        return None

    async def ensure(_user):
        return "u1"

    async def detail(_uid):
        return {"id": "u1"}

    monkeypatch.setattr(tenancy.members, "for_user", for_user)
    monkeypatch.setattr(tenancy.members, "delete_one", noop)
    monkeypatch.setattr(tenancy, "ensure_personal_household", ensure)
    monkeypatch.setattr(tenancy, "household_detail", detail)

    tenancy._scope_cache["u1"] = ("hh_shared", time.time())
    _run(tenancy.leave_household("u1"))
    assert "u1" not in tenancy._scope_cache


def test_removing_a_member_invalidates_their_scope(monkeypatch):
    async def for_user(uid):
        if uid == "owner":
            return {"id": "m1", "household_id": "hh1", "role": tenancy.ROLE_OWNER}
        return {"id": "m2", "household_id": "hh1", "role": tenancy.ROLE_MEMBER}

    async def noop(*args, **kwargs):
        return None

    async def ensure(_user):
        return "member_personal"

    async def detail(_uid):
        return {"id": "hh1"}

    monkeypatch.setattr(tenancy.members, "for_user", for_user)
    monkeypatch.setattr(tenancy.members, "delete_one", noop)
    monkeypatch.setattr(tenancy, "ensure_personal_household", ensure)
    monkeypatch.setattr(tenancy, "household_detail", detail)

    tenancy._scope_cache["member"] = ("hh1", time.time())
    _run(tenancy.remove_member("owner", "member"))
    assert "member" not in tenancy._scope_cache

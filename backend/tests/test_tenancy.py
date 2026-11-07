"""Household tenancy.

The security-critical property: every financial document is scoped by a
tenancy id, and membership is always checked server-side. These tests pin the
invariants that would otherwise let one person read or destroy another's data.
"""
import asyncio
import sys

import pytest
from fastapi import HTTPException

sys.path.insert(0, "D:/Wallume/backend")

from app.services import tenancy_service as tenancy


def _user(uid="u1"):
    return {"user_id": uid}


def _run(coro):
    return asyncio.run(coro)


# --- scope resolution -----------------------------------------------------

def test_personal_scope_is_the_users_own_id(monkeypatch):
    """Behaviour-preserving: pre-household accounts keep their own id."""
    async def for_user(_uid):
        return None

    async def by_owner(_uid):
        return None

    inserted = {}

    async def insert_one(self, doc, session=None):
        inserted[doc["collection"]] = doc

    monkeypatch.setattr(tenancy.members, "for_user", for_user)
    monkeypatch.setattr(tenancy.households, "by_owner", by_owner)

    household_docs = []
    member_docs = []

    async def h_insert(doc, session=None):
        household_docs.append(doc)

    async def m_insert(doc, session=None):
        member_docs.append(doc)

    monkeypatch.setattr(tenancy.households, "insert_one", h_insert)
    monkeypatch.setattr(tenancy.members, "insert_one", m_insert)

    scope = _run(tenancy.resolve_scope(_user("u1")))
    assert scope == "u1"
    assert household_docs[0]["owner_id"] == "u1"
    assert member_docs[0]["role"] == tenancy.ROLE_OWNER


def test_personal_household_id_equals_the_user_id(monkeypatch):
    """Regression: a fresh hh_ id would hide every pre-existing user's data.

    Documents are scoped by user_id, so a personal household MUST resolve to
    that same id. This was a live near-miss — the first implementation minted a
    new id and every existing account would have gone blank on deploy.
    """
    async def for_user(_uid):
        return None

    async def by_owner(_uid):
        return None

    household_docs = []
    member_docs = []

    async def h_insert(doc, session=None):
        household_docs.append(doc)

    async def m_insert(doc, session=None):
        member_docs.append(doc)

    monkeypatch.setattr(tenancy.members, "for_user", for_user)
    monkeypatch.setattr(tenancy.households, "by_owner", by_owner)
    monkeypatch.setattr(tenancy.households, "insert_one", h_insert)
    monkeypatch.setattr(tenancy.members, "insert_one", m_insert)

    scope = _run(tenancy.resolve_scope(_user("user_abc")))
    assert scope == "user_abc"
    assert household_docs[0]["id"] == "user_abc"
    assert member_docs[0]["household_id"] == "user_abc"


def test_existing_membership_wins_over_creating_a_new_household(monkeypatch):
    async def for_user(_uid):
        return {"household_id": "hh_shared", "role": tenancy.ROLE_MEMBER}

    monkeypatch.setattr(tenancy.members, "for_user", for_user)

    async def boom(*a, **k):
        raise AssertionError("must not create a second household")

    monkeypatch.setattr(tenancy.households, "insert_one", boom)
    assert _run(tenancy.resolve_scope(_user("u1"))) == "hh_shared"


def test_owner_without_a_membership_row_is_repaired(monkeypatch):
    async def for_user(_uid):
        return None

    async def by_owner(_uid):
        return {"id": "hh_owned", "owner_id": "u1"}

    created = []
    async def insert(doc, session=None):
        created.append(doc)

    monkeypatch.setattr(tenancy.members, "for_user", for_user)
    monkeypatch.setattr(tenancy.households, "by_owner", by_owner)
    monkeypatch.setattr(tenancy.members, "insert_one", insert)

    assert _run(tenancy.resolve_scope(_user("u1"))) == "hh_owned"
    assert created[0]["role"] == tenancy.ROLE_OWNER


# --- joining ---------------------------------------------------------------

def test_unknown_invite_code_is_rejected(monkeypatch):
    monkeypatch.setattr(tenancy.members, "for_user", _async(None))
    monkeypatch.setattr(tenancy.households, "by_invite_code", _async(None))

    with pytest.raises(HTTPException) as exc:
        _run(tenancy.join_household("u1", "NOPE"))
    assert exc.value.status_code == 404


def test_cannot_join_the_household_you_are_already_in(monkeypatch):
    monkeypatch.setattr(tenancy.members, "for_user", _async({"household_id": "hh1"}))
    monkeypatch.setattr(tenancy.households, "by_invite_code", _async({"id": "hh1"}))

    with pytest.raises(HTTPException) as exc:
        _run(tenancy.join_household("u1", "CODE"))
    assert exc.value.status_code == 400


def test_joining_rescopes_the_members_own_documents(monkeypatch):
    """Otherwise the shared ledger would be missing everything they brought."""
    monkeypatch.setattr(tenancy.members, "for_user", _async({"id": "m1", "household_id": "hh_solo", "role": tenancy.ROLE_MEMBER}))
    monkeypatch.setattr(tenancy.households, "by_invite_code", _async({"id": "hh_shared"}))
    monkeypatch.setattr(tenancy.members, "delete_one", _async(None))
    inserted = []

    async def capture_insert(doc, session=None):
        inserted.append(doc)

    async def noop_rescore(uid, scope):
        return None

    monkeypatch.setattr(tenancy.members, "insert_one", capture_insert)
    monkeypatch.setattr(tenancy, "_rescore_owned_documents", noop_rescore)
    monkeypatch.setattr(tenancy, "household_detail", _async({"id": "hh_shared"}))

    _run(tenancy.join_household("u1", "code"))
    assert inserted[0]["household_id"] == "hh_shared"
    assert inserted[0]["role"] == tenancy.ROLE_MEMBER


def test_owner_with_other_members_cannot_abandon_them(monkeypatch):
    monkeypatch.setattr(tenancy.members, "for_user", _async({"id": "m1", "household_id": "hh1", "role": tenancy.ROLE_OWNER}))
    monkeypatch.setattr(tenancy.households, "by_invite_code", _async({"id": "hh2"}))
    monkeypatch.setattr(tenancy.members, "for_household", _async([{"member_id": "u1"}, {"member_id": "u2"}]))

    with pytest.raises(HTTPException) as exc:
        _run(tenancy.join_household("u1", "CODE"))
    assert exc.value.status_code == 400


# --- leaving / removing ----------------------------------------------------

def test_solo_owner_cannot_leave(monkeypatch):
    monkeypatch.setattr(tenancy.members, "for_user", _async({"id": "m1", "household_id": "hh1", "role": tenancy.ROLE_OWNER}))
    monkeypatch.setattr(tenancy.members, "for_household", _async([{"member_id": "u1"}]))

    with pytest.raises(HTTPException) as exc:
        _run(tenancy.leave_household("u1"))
    assert exc.value.status_code == 400


def test_member_leave_creates_a_fresh_personal_household(monkeypatch):
    monkeypatch.setattr(tenancy.members, "for_user", _async({"id": "m1", "household_id": "hh_shared", "role": tenancy.ROLE_MEMBER}))
    monkeypatch.setattr(tenancy.members, "delete_one", _async(None))

    calls = []

    async def fake_ensure(user):
        calls.append(user)
        return "u1"

    monkeypatch.setattr(tenancy, "ensure_personal_household", fake_ensure)
    monkeypatch.setattr(tenancy, "household_detail", _async({"id": "u1"}))

    _run(tenancy.leave_household("u1"))
    assert calls[0]["user_id"] == "u1"


def test_only_the_owner_can_remove_members(monkeypatch):
    monkeypatch.setattr(tenancy.members, "for_user", _async({"household_id": "hh1", "role": tenancy.ROLE_MEMBER}))

    with pytest.raises(HTTPException) as exc:
        _run(tenancy.remove_member("u2", "u1"))
    assert exc.value.status_code == 403


# --- ownership transfer ----------------------------------------------------

def _transfer_fixture(monkeypatch):
    """owner + member in hh1 (scope stays user_owner)."""
    async def for_user(uid):
        if uid == "owner":
            return {"id": "m1", "household_id": "user_owner", "role": tenancy.ROLE_OWNER}
        if uid == "member":
            return {"id": "m2", "household_id": "user_owner", "role": tenancy.ROLE_MEMBER}
        return None

    updated = []

    async def capture_update(filter, update):
        updated.append((filter, update))

    monkeypatch.setattr(tenancy.members, "for_user", for_user)
    monkeypatch.setattr(tenancy.members, "update_one", capture_update)
    monkeypatch.setattr(tenancy.households, "update_one", capture_update)
    monkeypatch.setattr(tenancy, "invalidate_scope_cache", lambda uid: None)
    monkeypatch.setattr(tenancy, "household_detail", _async({"id": "user_owner"}))
    return updated


def test_transfer_hands_ownership_to_the_member(monkeypatch):
    updated = _transfer_fixture(monkeypatch)
    result = _run(tenancy.transfer_ownership("owner", "member"))

    role_swaps = {f["id"]: u for f, u in updated if "role" in u.get("$set", {})}
    assert role_swaps["m1"]["$set"]["role"] == tenancy.ROLE_MEMBER
    assert role_swaps["m2"]["$set"]["role"] == tenancy.ROLE_OWNER
    assert result["id"] == "user_owner"


def test_transfer_does_not_change_the_tenancy_scope(monkeypatch):
    """Every existing document is keyed by the original owner's id.

    If the household id moved to the new owner, all shared data would become
    invisible to everyone — the same class of bug as the personal-household
    regression caught earlier.
    """
    updated = _transfer_fixture(monkeypatch)
    _run(tenancy.transfer_ownership("owner", "member"))

    household_update = next(u for f, u in updated if "owner_id" in u.get("$set", {}))
    assert household_update["$set"]["owner_id"] == "member"
    # And critically, nothing renames the household id itself.
    assert all("$set" not in u or "id" not in u["$set"] for _, u in updated)


def test_only_the_owner_can_transfer(monkeypatch):
    monkeypatch.setattr(tenancy.members, "for_user", _async({"household_id": "hh1", "role": tenancy.ROLE_MEMBER}))
    with pytest.raises(HTTPException) as exc:
        _run(tenancy.transfer_ownership("member", "owner"))
    assert exc.value.status_code == 403


def test_cannot_transfer_to_someone_outside_the_household(monkeypatch):
    async def for_user(uid):
        if uid == "owner":
            return {"id": "m1", "household_id": "user_owner", "role": tenancy.ROLE_OWNER}
        return None

    monkeypatch.setattr(tenancy.members, "for_user", for_user)
    with pytest.raises(HTTPException) as exc:
        _run(tenancy.transfer_ownership("owner", "stranger"))
    assert exc.value.status_code == 404


def test_cannot_transfer_to_yourself(monkeypatch):
    monkeypatch.setattr(tenancy.members, "for_user", _async({"id": "m1", "household_id": "hh1", "role": tenancy.ROLE_OWNER}))
    with pytest.raises(HTTPException) as exc:
        _run(tenancy.transfer_ownership("u1", "u1"))
    assert exc.value.status_code == 400


def test_transfer_invalidates_both_scopes(monkeypatch):
    """A cached scope pointing at the old owner would break the new owner."""
    invalidated = []
    _transfer_fixture(monkeypatch)
    monkeypatch.setattr(tenancy, "invalidate_scope_cache", lambda uid: invalidated.append(uid))

    _run(tenancy.transfer_ownership("owner", "member"))
    assert "owner" in invalidated and "member" in invalidated


# --- member names ----------------------------------------------------------

def test_member_names_resolves_display_names(monkeypatch):
    """Rendering raw user ids in the UI made sharing unusable."""
    class _Cursor:
        async def to_list(self, n):
            return [
                {"user_id": "u1", "name": "Alex", "email": "alex@wallume.app"},
                {"user_id": "u2", "name": "", "email": "sam@wallume.app"},
            ]

    class _Coll:
        def __init__(self):
            self.query = None
            self.projection = None

        def find(self, query, projection):
            self.query, self.projection = query, projection
            return _Cursor()

    coll = _Coll()

    async def fake_db():
        class _DB:
            users = coll
        return _DB()

    import app.database.mongo as mongo_module
    import app.services.tenancy_service as ts
    monkeypatch.setattr(mongo_module, "get_database", fake_db)

    names = _run(ts._member_names(["u1", "u2"]))
    assert coll.query == {"user_id": {"$in": ["u1", "u2"]}}
    assert names["u1"] == "Alex"
    # Falls back to the email local part when name is empty.
    assert names["u2"] == "sam"


def test_member_names_handles_an_empty_roster():
    import app.services.tenancy_service as ts
    assert _run(ts._member_names([])) == {}


def test_household_detail_includes_member_names(monkeypatch):
    async def for_user(_uid):
        return {"id": "m1", "household_id": "hh1", "role": tenancy.ROLE_OWNER}

    async def roster(_hid):
        return [{"member_id": "u1", "role": tenancy.ROLE_OWNER}]

    async def household(_f):
        return {"id": "hh1", "name": "Family", "invite_code": "ABC123"}

    monkeypatch.setattr(tenancy.members, "for_user", for_user)
    monkeypatch.setattr(tenancy.members, "for_household", roster)
    monkeypatch.setattr(tenancy.households, "find_one", household)
    monkeypatch.setattr(tenancy, "_member_names", _async({"u1": "Alex"}))

    detail = _run(tenancy.household_detail("u1"))
    assert detail["members"][0]["name"] == "Alex"


def test_owner_cannot_remove_themselves(monkeypatch):
    monkeypatch.setattr(tenancy.members, "for_user", _async({"household_id": "hh1", "role": tenancy.ROLE_OWNER}))
    with pytest.raises(HTTPException) as exc:
        _run(tenancy.remove_member("u1", "u1"))
    assert exc.value.status_code == 400


def test_cannot_remove_someone_from_another_household(monkeypatch):
    async def for_user(uid):
        return {"household_id": "hh1", "role": tenancy.ROLE_OWNER} if uid == "owner" else {"household_id": "hh_other"}

    monkeypatch.setattr(tenancy.members, "for_user", for_user)
    with pytest.raises(HTTPException) as exc:
        _run(tenancy.remove_member("owner", "stranger"))
    assert exc.value.status_code == 404


def test_invite_code_rotation_is_owner_only(monkeypatch):
    monkeypatch.setattr(tenancy.members, "for_user", _async({"household_id": "hh1", "role": tenancy.ROLE_MEMBER}))
    with pytest.raises(HTTPException) as exc:
        _run(tenancy.rotate_invite_code("u1"))
    assert exc.value.status_code == 403


def test_rename_is_owner_only(monkeypatch):
    monkeypatch.setattr(tenancy.members, "for_user", _async({"household_id": "hh1", "role": tenancy.ROLE_MEMBER}))
    with pytest.raises(HTTPException) as exc:
        _run(tenancy.rename_household("u1", "Family"))
    assert exc.value.status_code == 403


# --- helpers ---------------------------------------------------------------

def _async(value):
    async def inner(*args, **kwargs):
        return value
    return inner

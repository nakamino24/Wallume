"""Tenancy against a real MongoDB.

Unit tests exercise the branches; this exercises the thing that actually
matters and cannot be faked: that `_rescore_owned_documents` really moves a
joiner's documents across every scoped collection, and that a personal
household resolves to a scope where a pre-existing account still finds its own
data.

Skipped by default. Run with:

    MONGO_URL=mongodb://localhost:27017 pytest --run-integration tests/test_tenancy_integration.py

Requires a MongoDB that accepts writes (a standalone mongod is enough; no
multi-document transactions are used here).
"""
import os
import uuid

import pytest

pytestmark = pytest.mark.skipif(
    not os.environ.get("MONGO_URL"),
    reason="set MONGO_URL to run tenancy integration tests",
)

# motor binds its executor to the event loop it is created in. pytest-asyncio
# gives each test a fresh loop, so the client MUST be created inside the test's
# loop — a module-level client fails with "Event loop is closed" on Windows.
import pytest_asyncio


@pytest_asyncio.fixture
async def db(monkeypatch):
    """A throwaway database so nothing touches real data."""
    from motor.motor_asyncio import AsyncIOMotorClient

    from app.database import mongo

    client = AsyncIOMotorClient(os.environ["MONGO_URL"], serverSelectionTimeoutMS=5000)
    name = f"wallume_test_{uuid.uuid4().hex[:8]}"

    async def fake_get_database():
        return client[name]

    # Repositories bind `get_database` at import time in each module's
    # namespace, so patching only app.database.mongo would not reach them.
    monkeypatch.setattr(mongo, "get_database", fake_get_database)
    for module in (
        "app.database.mongo",
        "app.repositories.base",
        "app.services.tenancy_service",
        "app.services.auth_service",
    ):
        monkeypatch.setattr(f"{module}.get_database", fake_get_database, raising=False)
    try:
        yield client[name]
    finally:
        await client.drop_database(name)
        client.close()


@pytest.mark.asyncio
async def test_personal_household_keeps_existing_data_visible(db):
    """The deploy-safety property, verified against a real database.

    An account created BEFORE households has its wallet keyed by its own user
    id. Resolving a personal household must return that same id, so the wallet
    is still found. A fresh hh_... id would make it disappear.
    """
    from app.services import tenancy_service as tenancy

    user_id = "user_legacy"
    await db.wallets.insert_one({"id": "wal_1", "user_id": user_id, "balance": 500})

    scope = await tenancy.resolve_scope({"user_id": user_id})
    assert scope == user_id

    found = await db.wallets.find_one({"id": "wal_1", "user_id": scope})
    assert found is not None, "pre-existing wallet became invisible after tenancy"


@pytest.mark.asyncio
async def test_joining_moves_every_scoped_collection(db):
    from app.services import tenancy_service as tenancy

    owner = "user_owner"
    joiner = "user_joiner"

    owner_scope = await tenancy.resolve_scope({"user_id": owner})
    await tenancy.resolve_scope({"user_id": joiner})

    # Seed one document per scoped collection for the joiner.
    for coll in tenancy.SCOPED_COLLECTIONS:
        await db[coll].insert_one({"id": f"{coll}_1", "user_id": joiner})

    household = await db.households.find_one({"owner_id": owner})
    code = household["invite_code"]

    await tenancy.join_household(joiner, code)

    # Every document now belongs to the owner's scope, so the shared ledger is
    # complete rather than half-empty.
    for coll in tenancy.SCOPED_COLLECTIONS:
        moved = await db[coll].find_one({"id": f"{coll}_1"})
        assert moved["user_id"] == owner_scope, f"{coll} was not re-scoped"


@pytest.mark.asyncio
async def test_leave_does_not_delete_household_data(db):
    from app.services import tenancy_service as tenancy

    owner = "user_owner"
    joiner = "user_joiner"
    await tenancy.resolve_scope({"user_id": owner})
    await tenancy.resolve_scope({"user_id": joiner})

    household = await db.households.find_one({"owner_id": owner})
    await tenancy.join_household(joiner, household["invite_code"])
    await db.wallets.insert_one({"id": "wal_shared", "user_id": owner, "balance": 10})

    await tenancy.leave_household(joiner)

    # The joiner gets a personal household but the shared wallet survives.
    still_there = await db.wallets.find_one({"id": "wal_shared"})
    assert still_there is not None

    membership = await db.household_members.find_one({"member_id": joiner})
    assert membership["household_id"] == joiner


@pytest.mark.asyncio
async def test_owner_with_members_cannot_leave(db):
    from fastapi import HTTPException

    from app.services import tenancy_service as tenancy

    owner = "user_owner"
    await tenancy.resolve_scope({"user_id": owner})
    await tenancy.resolve_scope({"user_id": "user_member"})
    household = await db.households.find_one({"owner_id": owner})

    tenant_join = await tenancy.join_household("user_member", household["invite_code"])
    assert tenant_join["id"] == household["id"]

    with pytest.raises(HTTPException) as exc:
        await tenancy.leave_household(owner)
    assert exc.value.status_code == 400

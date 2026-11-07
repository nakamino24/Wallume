"""Household tenancy.

Every financial document is scoped by a single id. Historically that id was
always the user's own id. Household sharing generalises it into a *tenancy
scope* while keeping the same field name (`user_id`), so no existing query,
index or aggregation pipeline had to change.

The contract:
- every user belongs to exactly one household (a personal one is created on
  signup, so `household_id` is never missing);
- the household owner's id *is* the scope id;
- `owner_id` on the authenticated user resolves to that scope id and defaults
  to the user's own id, which is why this is behaviour-preserving for every
  account that existed before households.

Invariants enforced here, because getting them wrong leaks another person's
money:
- a user can only be in one household at a time;
- only the owner can invite, remove members or delete the household;
- the owner cannot leave while others are still members (that would orphan the
  shared data);
- every lookup is scoped by membership, never by a client-supplied id alone.
"""
from __future__ import annotations

import secrets
from typing import Any, Optional

from fastapi import HTTPException

from app.repositories.base import BaseRepository
from app.utils.helpers import new_id, now_utc

ROLE_OWNER = "owner"
ROLE_MEMBER = "member"


class HouseholdRepository(BaseRepository):
    def __init__(self) -> None:
        super().__init__("households")

    async def by_owner(self, owner_id: str) -> Optional[dict[str, Any]]:
        return await self.find_one({"owner_id": owner_id})

    async def by_invite_code(self, code: str) -> Optional[dict[str, Any]]:
        return await self.find_one({"invite_code": code.upper()})


class HouseholdMemberRepository(BaseRepository):
    def __init__(self) -> None:
        super().__init__("household_members")

    async def for_user(self, user_id: str) -> Optional[dict[str, Any]]:
        return await self.find_one({"member_id": user_id})

    async def for_household(self, household_id: str) -> list[dict[str, Any]]:
        cursor = (await self._collection()).find(
            self._active_filter({"household_id": household_id}), {"_id": 0},
        ).sort("joined_at", 1)
        return await cursor.to_list(200)


households = HouseholdRepository()
members = HouseholdMemberRepository()


def _invite_code() -> str:
    # Short, unambiguous, uppercase: readable over a message.
    return secrets.token_hex(4).upper()


async def ensure_personal_household(user: dict[str, Any]) -> str:
    """Return the user's scope id, creating a personal household if needed.

    Idempotent: signup, login and any later read can all call it safely.
    """
    user_id = user["user_id"]

    existing = await members.for_user(user_id)
    if existing:
        return existing["household_id"]

    # A user who owns a household but has no membership row (created before
    # memberships existed, or a partial failure) is repaired here.
    owned = await households.by_owner(user_id)
    if owned:
        await members.insert_one({
            "id": new_id("hhm"),
            "household_id": owned["id"],
            "member_id": user_id,
            "role": ROLE_OWNER,
            "joined_at": now_utc(),
        })
        return owned["id"]

    # CRITICAL: a personal household's id IS the owner's user id.
    #
    # Documents are scoped by `user_id`, and every account that existed before
    # households has its data keyed by its own user id. If a personal household
    # got a fresh `hh_...` id, every existing user's wallet/transaction/budget
    # would instantly become invisible. Using the owner's id keeps the scope
    # identical for personal households, so this migration is a no-op for them.
    await households.insert_one({
        "id": user_id,
        "owner_id": user_id,
        "name": "Personal",
        "invite_code": _invite_code(),
        "created_at": now_utc(),
    })
    await members.insert_one({
        "id": new_id("hhm"),
        "household_id": user_id,
        "member_id": user_id,
        "role": ROLE_OWNER,
        "joined_at": now_utc(),
    })
    return user_id


async def resolve_scope(user: dict[str, Any]) -> str:
    """The id every financial document for this user is scoped by."""
    return await ensure_personal_household(user)


async def household_detail(user_id: str) -> dict[str, Any]:
    membership = await members.for_user(user_id)
    if not membership:
        raise HTTPException(404, "No household")
    household = await households.find_one({"id": membership["household_id"]})
    if not household:
        raise HTTPException(404, "No household")
    roster = await members.for_household(household["id"])
    return {
        "id": household["id"],
        "name": household.get("name", "Personal"),
        "role": membership["role"],
        # Only the owner needs the invite code surfaced.
        "invite_code": household.get("invite_code") if membership["role"] == ROLE_OWNER else None,
        "is_shared": len(roster) > 1,
        "members": [
            {
                "user_id": m["member_id"],
                "role": m["role"],
                "joined_at": m.get("joined_at"),
            }
            for m in roster
        ],
    }


async def rename_household(user_id: str, name: str) -> dict[str, Any]:
    membership = await members.for_user(user_id)
    if not membership:
        raise HTTPException(404, "No household")
    if membership["role"] != ROLE_OWNER:
        raise HTTPException(403, "Only the household owner can rename it")
    clean = (name or "").strip()[:60]
    if not clean:
        raise HTTPException(400, "Name is required")
    await households.update_one({"id": membership["household_id"]}, {"$set": {"name": clean}})
    return await household_detail(user_id)


async def rotate_invite_code(user_id: str) -> dict[str, Any]:
    membership = await members.for_user(user_id)
    if not membership or membership["role"] != ROLE_OWNER:
        raise HTTPException(403, "Only the household owner can change the invite code")
    code = _invite_code()
    await households.update_one({"id": membership["household_id"]}, {"$set": {"invite_code": code}})
    return await household_detail(user_id)


async def join_household(user_id: str, invite_code: str) -> dict[str, Any]:
    """Join a shared household by invite code.

    A member brings their own data with them: their documents are re-scoped to
    the household so the shared ledger is complete rather than half-empty.
    """
    code = (invite_code or "").strip().upper()
    if not code:
        raise HTTPException(400, "Invite code is required")

    existing = await members.for_user(user_id)
    target = await households.by_invite_code(code)
    if not target:
        raise HTTPException(404, "Invite code not recognised")
    if existing and existing["household_id"] == target["id"]:
        raise HTTPException(400, "You are already in this household")
    if existing and existing["role"] == ROLE_OWNER:
        siblings = await members.for_household(existing["household_id"])
        if len(siblings) > 1:
            raise HTTPException(400, "Leave or hand over your household before joining another")
        # A solo owner joining elsewhere: their personal household is redundant.
        await members.delete_one({"id": existing["id"]}, hard=True)
        await households.delete_one({"id": existing["household_id"]}, hard=True)
    elif existing:
        await members.delete_one({"id": existing["id"]}, hard=True)

    await members.insert_one({
        "id": new_id("hhm"),
        "household_id": target["id"],
        "member_id": user_id,
        "role": ROLE_MEMBER,
        "joined_at": now_utc(),
    })
    # Points the member's own documents — and every future write — at the
    # household scope.
    await _rescore_owned_documents(user_id, target["id"])
    return await household_detail(user_id)


async def leave_household(user_id: str) -> dict[str, Any]:
    membership = await members.for_user(user_id)
    if not membership:
        raise HTTPException(404, "No household")
    if membership["role"] == ROLE_OWNER:
        siblings = await members.for_household(membership["household_id"])
        if len(siblings) > 1:
            raise HTTPException(400, "Transfer ownership or remove members before leaving")
        raise HTTPException(400, "You cannot leave your own household")

    household_id = membership["household_id"]
    await members.delete_one({"id": membership["id"]}, hard=True)
    # Leaving gives the member a fresh personal household; their previously
    # shared data stays with the household rather than being silently deleted.
    await ensure_personal_household({"user_id": user_id})
    return await household_detail(user_id)


async def remove_member(owner_user_id: str, member_user_id: str) -> dict[str, Any]:
    owner_membership = await members.for_user(owner_user_id)
    if not owner_membership or owner_membership["role"] != ROLE_OWNER:
        raise HTTPException(403, "Only the household owner can remove members")
    if member_user_id == owner_user_id:
        raise HTTPException(400, "The owner cannot remove themselves")
    target = await members.for_user(member_user_id)
    if not target or target["household_id"] != owner_membership["household_id"]:
        raise HTTPException(404, "That user is not in your household")

    await members.delete_one({"id": target["id"]}, hard=True)
    await ensure_personal_household({"user_id": member_user_id})
    return await household_detail(owner_user_id)


# Documents that carry the tenancy scope. Kept explicit rather than derived so
# a new collection cannot silently miss re-scoping.
SCOPED_COLLECTIONS = (
    "wallets", "transactions", "budgets", "goals", "plans", "debts",
    "investments", "assets", "recurring", "categories", "receipts",
    "chat_messages", "net_worth_snapshots",
)


async def _rescore_owned_documents(user_id: str, scope_id: str) -> None:
    """Move a user's documents into a shared scope."""
    from app.database.mongo import get_database
    db = await get_database()
    for coll in SCOPED_COLLECTIONS:
        try:
            await db[coll].update_many({"user_id": user_id}, {"$set": {"user_id": scope_id}})
        except Exception:
            # A missing collection is fine; never fail the join over it.
            continue


async def purge_household_if_solo(user_id: str) -> bool:
    """Delete the household's shared data when its last member leaves.

    Returns True when the household was purged, so the caller knows the
    financial documents are already gone and it must not double-delete.
    """
    from app.database.mongo import get_database

    membership = await members.for_user(user_id)
    if not membership:
        return False
    household_id = membership["household_id"]
    roster = await members.for_household(household_id)
    if len(roster) > 1:
        return False

    db = await get_database()
    for coll in SCOPED_COLLECTIONS:
        try:
            await db[coll].delete_many({"user_id": household_id})
        except Exception:
            continue
    await members.delete_one({"household_id": household_id}, hard=True)
    await households.delete_one({"id": household_id}, hard=True)
    return True

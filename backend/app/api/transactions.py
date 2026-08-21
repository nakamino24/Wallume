from __future__ import annotations

from typing import Any, Optional
from fastapi import APIRouter, Header, HTTPException
from app.schemas.models import TransactionCreate
from app.repositories.repos import WalletRepository, TransactionRepository
from app.services.auth_service import AuthService
from app.utils.helpers import new_id, now_utc, to_canonical_date
from app.utils.money import to_decimal, to_decimal128
from app.database.mongo import get_database

router = APIRouter(prefix="/transactions")
auth_service = AuthService()
txs = TransactionRepository()
wallets = WalletRepository()


async def _apply_effect(user_id: str, wallet_id: str, to_wallet_id: Optional[str],
                        tx_type: str, amount, session, reverse: bool):
    """Apply (or reverse) a transaction's wallet effect inside a session.

    `Decimal128` cannot be negated (`-Decimal128(...)` raises TypeError), so we
    convert the amount to a Python Decimal first and negate that — the root-cause
    bug that left transfer balances half-reverted or un-reverted.
    """
    amt = to_decimal(amount)
    if reverse:
        amt = -amt
    if tx_type == "income":
        await wallets.adjust_balance(wallet_id, user_id, amt, session)
    elif tx_type == "expense":
        await wallets.adjust_balance(wallet_id, user_id, -amt, session)
    elif tx_type == "transfer":
        if not to_wallet_id:
            raise HTTPException(400, "to_wallet_id required for transfer")
        await wallets.adjust_balance(wallet_id, user_id, -amt, session)
        await wallets.adjust_balance(to_wallet_id, user_id, amt, session)


@router.get("")
async def list_transactions(
    authorization: Optional[str] = Header(None),
    limit: int = 100,
    type: Optional[str] = None,
    wallet_id: Optional[str] = None,
):
    u = await auth_service.get_current_user(authorization)
    items = await txs.find_by_user(u["user_id"], type, wallet_id, limit)
    return {"success": True, "data": {"transactions": items}}


@router.post("")
async def create_transaction(payload: TransactionCreate, authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    tx_date = to_canonical_date(payload.date) or now_utc().isoformat()
    doc = {"id": new_id("tx"), "user_id": u["user_id"], **payload.model_dump(),
           "date": tx_date, "created_at": now_utc()}

    w = await wallets.find_one({"id": payload.wallet_id, "user_id": u["user_id"]})
    if not w:
        raise HTTPException(400, "Wallet not found")
    if payload.type == "transfer":
        if not payload.to_wallet_id:
            raise HTTPException(400, "to_wallet_id required for transfer")
        if payload.to_wallet_id == payload.wallet_id:
            raise HTTPException(400, "Cannot transfer to the same wallet")

    db = await get_database()
    async with await db.client.start_session() as session:
        async with session.start_transaction():
            if payload.type == "transfer":
                dw = await wallets.find_one({"id": payload.to_wallet_id, "user_id": u["user_id"]}, session)
                if not dw:
                    raise HTTPException(400, "Destination wallet not found")
            await _apply_effect(u["user_id"], payload.wallet_id, payload.to_wallet_id, payload.type, payload.amount, session, reverse=False)
            await txs.insert_one(doc, session)

    return {"success": True, "data": {"transaction": {k: v for k, v in doc.items() if k != "_id"}}}


@router.patch("/{tx_id}")
async def update_transaction(tx_id: str, body: dict[str, Any], authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)

    db = await get_database()
    async with await db.client.start_session() as session:
        async with session.start_transaction():
            tx = await txs.find_one({"id": tx_id, "user_id": u["user_id"]}, session)
            if not tx:
                raise HTTPException(404, "Not found")

            allowed = {k: v for k, v in body.items()
                       if k in {"wallet_id", "to_wallet_id", "type", "amount", "category", "note", "date"}}
            if "date" in allowed:
                allowed["date"] = to_canonical_date(allowed["date"])
            merged = {**tx, **allowed}
            if merged["type"] == "transfer":
                if not merged.get("to_wallet_id"):
                    raise HTTPException(400, "to_wallet_id required for transfer")
                if merged["to_wallet_id"] == merged["wallet_id"]:
                    raise HTTPException(400, "Cannot transfer to the same wallet")

            # Atomic: fully reverse the OLD effect, then apply the NEW effect —
            # both in one transaction, or nothing persists.
            await _apply_effect(u["user_id"], tx["wallet_id"], tx.get("to_wallet_id"), tx["type"], tx["amount"], session, reverse=True)
            await _apply_effect(u["user_id"], merged["wallet_id"], merged.get("to_wallet_id"), merged["type"], merged["amount"], session, reverse=False)

            await txs.update_one({"id": tx_id, "user_id": u["user_id"]}, {"$set": allowed}, session=session)
            updated = await txs.find_one({"id": tx_id, "user_id": u["user_id"]}, session)

    return {"success": True, "data": {"transaction": updated}}


@router.delete("/{tx_id}")
async def delete_transaction(tx_id: str, authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)

    db = await get_database()
    async with await db.client.start_session() as session:
        async with session.start_transaction():
            tx = await txs.find_one({"id": tx_id, "user_id": u["user_id"]}, session)
            if not tx:
                raise HTTPException(404, "Not found")

            # Atomic + idempotent: both sides reverted together, then the record
            # is soft-deleted inside the same session. A second delete finds no
            # active record (404) and never double-reverses.
            await _apply_effect(u["user_id"], tx["wallet_id"], tx.get("to_wallet_id"), tx["type"], tx["amount"], session, reverse=True)
            await txs.delete_one({"id": tx_id, "user_id": u["user_id"]}, session=session)

    return {"success": True, "data": None}
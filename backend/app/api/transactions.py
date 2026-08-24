from __future__ import annotations

import math
import hashlib
import json
from typing import Any, Optional
from fastapi import APIRouter, Header, HTTPException
from app.schemas.models import TransactionCreate
from app.repositories.repos import WalletRepository, TransactionRepository
from app.services.auth_service import AuthService
from app.utils.helpers import new_id, now_utc, strict_canonical_date
from app.utils.money import to_decimal, to_decimal128
from app.database.mongo import get_database
from pymongo.errors import DuplicateKeyError

router = APIRouter(prefix="/transactions")
auth_service = AuthService()
txs = TransactionRepository()
wallets = WalletRepository()


def _idempotency_fingerprint(operation: str, resource_id: str, payload: dict[str, Any]) -> str:
    """Bind a mutation ID to one operation and payload, not just one user."""
    normalized = {key: value for key, value in payload.items() if key != "client_mutation_id"}
    encoded = json.dumps(
        {"operation": operation, "resource_id": resource_id, "payload": normalized},
        default=str, sort_keys=True, separators=(",", ":"),
    )
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


async def _find_idempotency_result(db, user_id: str, mutation_id: Optional[str], fingerprint: str):
    if not mutation_id:
        return False, None
    record = await db.idempotency.find_one({"user_id": user_id, "client_mutation_id": mutation_id})
    if not record:
        return False, None
    if record.get("fingerprint") != fingerprint:
        raise HTTPException(409, "client mutation id was reused for a different operation")
    return True, record["result"]


def _require_positive_amount(value: Any) -> None:
    """Reject zero/negative/non-numeric amounts at the API boundary.

    A negative expense would *increase* the wallet balance (double negation in
    _apply_effect), and a non-numeric one would surface as an opaque 500 from
    Decimal conversion mid-transaction. Both must fail fast with 400.
    """
    try:
        amt = float(value)
    except (TypeError, ValueError):
        raise HTTPException(400, "amount must be a number")
    if not math.isfinite(amt) or amt <= 0:
        raise HTTPException(400, "amount must be greater than 0")


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
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
):
    u = await auth_service.get_current_user(authorization)
    items = await txs.find_by_user(u["user_id"], type, wallet_id, limit, from_date, to_date)
    return {"success": True, "data": {"transactions": items}}


@router.post("")
async def create_transaction(payload: TransactionCreate, authorization: Optional[str] = Header(None), x_client_mutation_id: Optional[str] = Header(None, alias="X-Client-Mutation-Id")):
    u = await auth_service.get_current_user(authorization)
    client_mid = x_client_mutation_id or payload.client_mutation_id
    payload_data = payload.model_dump()
    fingerprint = _idempotency_fingerprint("POST /transactions", "", payload_data)
    db = await get_database()
    found, result = await _find_idempotency_result(db, u["user_id"], client_mid, fingerprint)
    if found:
        return {"success": True, "data": result}
    _require_positive_amount(payload.amount)
    # Canonical-or-today. The fallback MUST itself be canonical — an empty
    # string date used to fall through to now_utc().isoformat() (full ISO) and
    # reintroduce the mixed-format ordering bug this module exists to prevent.
    tx_date = strict_canonical_date(payload.date) or now_utc().strftime("%Y-%m-%d")
    doc = {"id": new_id("tx"), "user_id": u["user_id"], **payload_data,
           "date": tx_date, "created_at": now_utc()}
    # Ensure client_mutation_id from header is stored if provided there
    if client_mid and not doc.get("client_mutation_id"):
        doc["client_mutation_id"] = client_mid
    if client_mid:
        doc["idempotency_fingerprint"] = fingerprint

    w = await wallets.find_one({"id": payload.wallet_id, "user_id": u["user_id"]})
    if not w:
        raise HTTPException(400, "Wallet not found")
    if payload.type == "transfer":
        if not payload.to_wallet_id:
            raise HTTPException(400, "to_wallet_id required for transfer")
        if payload.to_wallet_id == payload.wallet_id:
            raise HTTPException(400, "Cannot transfer to the same wallet")

    try:
        async with await db.client.start_session() as session:
            async with session.start_transaction():
                if payload.type == "transfer":
                    dw = await wallets.find_one({"id": payload.to_wallet_id, "user_id": u["user_id"]}, session)
                    if not dw:
                        raise HTTPException(400, "Destination wallet not found")
                await _apply_effect(u["user_id"], payload.wallet_id, payload.to_wallet_id, payload.type, payload.amount, session, reverse=False)
                await txs.insert_one(doc, session)
                result = {"transaction": {k: v for k, v in doc.items() if k != "_id"}}
                if client_mid:
                    await db.idempotency.insert_one({
                        "user_id": u["user_id"], "client_mutation_id": client_mid,
                        "operation": "POST /transactions", "resource_type": "transaction", "resource_id": doc["id"],
                        "fingerprint": fingerprint, "status": "completed", "result": result, "created_at": now_utc(),
                    }, session=session)
    except DuplicateKeyError:
        found, result = await _find_idempotency_result(db, u["user_id"], client_mid, fingerprint)
        if found:
            return {"success": True, "data": result}
        raise HTTPException(409, "Duplicate transaction")

    return {"success": True, "data": result}


@router.patch("/{tx_id}")
async def update_transaction(tx_id: str, body: dict[str, Any], authorization: Optional[str] = Header(None), x_client_mutation_id: Optional[str] = Header(None, alias="X-Client-Mutation-Id")):
    client_mid = x_client_mutation_id or body.get("client_mutation_id")
    u = await auth_service.get_current_user(authorization)
    db = await get_database()
    fingerprint = _idempotency_fingerprint("PATCH /transactions", tx_id, body)
    found, result = await _find_idempotency_result(db, u["user_id"], client_mid, fingerprint)
    if found:
        return {"success": True, "data": result}
    try:
        async with await db.client.start_session() as session:
            async with session.start_transaction():
                tx = await txs.find_one({"id": tx_id, "user_id": u["user_id"]}, session)
                if not tx:
                    raise HTTPException(404, "Not found")

                allowed = {k: v for k, v in body.items()
                           if k in {"wallet_id", "to_wallet_id", "type", "amount", "category", "note", "date"}}
                # Validate only CHANGED fields: re-validating the stored amount
                # would make legacy bad-amount records impossible to edit at all.
                if "amount" in allowed:
                    _require_positive_amount(allowed["amount"])
                    allowed["amount"] = float(allowed["amount"])
                if "date" in allowed:
                    canonical = strict_canonical_date(allowed["date"])
                    if not canonical:
                        raise HTTPException(400, "Invalid date")
                    allowed["date"] = canonical
                merged = {**tx, **allowed}
                if merged["type"] == "transfer":
                    if not merged.get("to_wallet_id"):
                        raise HTTPException(400, "to_wallet_id required for transfer")
                    if merged["to_wallet_id"] == merged["wallet_id"]:
                        raise HTTPException(400, "Cannot transfer to the same wallet")
                    dw = await wallets.find_one({"id": merged["to_wallet_id"], "user_id": u["user_id"]}, session)
                    if not dw:
                        raise HTTPException(400, "Destination wallet not found")

                # Both wallets referenced by the EFFECTIVE state must exist and
                # belong to the user: adjust_balance() is a silent no-op on a
                # missing wallet, so an unvalidated edit would move the record but
                # never the money — permanent balance drift.
                sw = await wallets.find_one({"id": merged["wallet_id"], "user_id": u["user_id"]}, session)
                if not sw:
                    raise HTTPException(400, "Wallet not found")

                # The resource, balances, and replay record must commit together.
                await _apply_effect(u["user_id"], tx["wallet_id"], tx.get("to_wallet_id"), tx["type"], tx["amount"], session, reverse=True)
                await _apply_effect(u["user_id"], merged["wallet_id"], merged.get("to_wallet_id"), merged["type"], merged["amount"], session, reverse=False)

                await txs.update_one({"id": tx_id, "user_id": u["user_id"]}, {"$set": allowed}, session=session)
                updated = await txs.find_one({"id": tx_id, "user_id": u["user_id"]}, session)
                if client_mid:
                    await db.idempotency.insert_one({
                        "user_id": u["user_id"], "client_mutation_id": client_mid,
                        "operation": "PATCH /transactions", "resource_type": "transaction", "resource_id": tx_id,
                        "fingerprint": fingerprint, "status": "completed", "result": {"transaction": updated}, "created_at": now_utc(),
                    }, session=session)
    except DuplicateKeyError:
        found, result = await _find_idempotency_result(db, u["user_id"], client_mid, fingerprint)
        if found:
            return {"success": True, "data": result}
        raise

    return {"success": True, "data": {"transaction": updated}}


@router.delete("/{tx_id}")
async def delete_transaction(tx_id: str, authorization: Optional[str] = Header(None), x_client_mutation_id: Optional[str] = Header(None, alias="X-Client-Mutation-Id")):
    u = await auth_service.get_current_user(authorization)

    db = await get_database()
    fingerprint = _idempotency_fingerprint("DELETE /transactions", tx_id, {})
    found, result = await _find_idempotency_result(db, u["user_id"], x_client_mutation_id, fingerprint)
    if found:
        return {"success": True, "data": result}
    try:
        async with await db.client.start_session() as session:
            async with session.start_transaction():
                tx = await txs.find_one({"id": tx_id, "user_id": u["user_id"]}, session)
                if not tx:
                    raise HTTPException(404, "Not found")

                await _apply_effect(u["user_id"], tx["wallet_id"], tx.get("to_wallet_id"), tx["type"], tx["amount"], session, reverse=True)
                await txs.delete_one({"id": tx_id, "user_id": u["user_id"]}, session=session)
                if x_client_mutation_id:
                    await db.idempotency.insert_one({
                        "user_id": u["user_id"], "client_mutation_id": x_client_mutation_id,
                        "operation": "DELETE /transactions", "resource_type": "transaction", "resource_id": tx_id,
                        "fingerprint": fingerprint, "status": "completed", "result": None, "created_at": now_utc(),
                    }, session=session)
    except DuplicateKeyError:
        found, result = await _find_idempotency_result(db, u["user_id"], x_client_mutation_id, fingerprint)
        if found:
            return {"success": True, "data": result}
        raise

    return {"success": True, "data": None}

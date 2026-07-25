from __future__ import annotations

from typing import Any, Optional
from fastapi import APIRouter, Header, HTTPException
from app.schemas.models import TransactionCreate
from app.repositories.repos import WalletRepository, TransactionRepository
from app.services.auth_service import AuthService
from app.utils.helpers import new_id, now_utc

router = APIRouter(prefix="/transactions")
auth_service = AuthService()
txs = TransactionRepository()
wallets = WalletRepository()


@router.get("")
async def list_transactions(
    authorization: Optional[str] = Header(None),
    limit: int = 100,
    type: Optional[str] = None,
):
    u = await auth_service.get_current_user(authorization)
    items = await txs.find_by_user(u["user_id"], type, limit)
    return {"success": True, "data": {"transactions": items}}


@router.post("")
async def create_transaction(payload: TransactionCreate, authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    tx_date = payload.date or now_utc().isoformat()
    doc = {"id": new_id("tx"), "user_id": u["user_id"], **payload.model_dump(), "date": tx_date, "created_at": now_utc()}
    w = await wallets.find_one({"id": payload.wallet_id, "user_id": u["user_id"]})
    if not w:
        raise HTTPException(400, "Wallet not found")
    if payload.type == "income":
        await wallets.adjust_balance(payload.wallet_id, u["user_id"], payload.amount)
    elif payload.type == "expense":
        await wallets.adjust_balance(payload.wallet_id, u["user_id"], -payload.amount)
    elif payload.type == "transfer":
        if not payload.to_wallet_id:
            raise HTTPException(400, "to_wallet_id required for transfer")
        await wallets.adjust_balance(payload.wallet_id, u["user_id"], -payload.amount)
        await wallets.adjust_balance(payload.to_wallet_id, u["user_id"], payload.amount)
    await txs.insert_one(doc)
    return {"success": True, "data": {"transaction": {k: v for k, v in doc.items() if k != "_id"}}}


@router.patch("/{tx_id}")
async def update_transaction(tx_id: str, payload: dict[str, Any], authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    tx = await txs.find_one({"id": tx_id, "user_id": u["user_id"]})
    if not tx:
        raise HTTPException(404, "Not found")
    allowed = {k: v for k, v in payload.items()
               if k in {"wallet_id", "to_wallet_id", "type", "amount", "category", "note", "date"}}
    merged = {**tx, **allowed}
    if merged["type"] == "transfer" and not merged.get("to_wallet_id"):
        raise HTTPException(400, "to_wallet_id required for transfer")
    new_w = await wallets.find_one({"id": merged["wallet_id"], "user_id": u["user_id"]})
    if not new_w:
        raise HTTPException(400, "Wallet not found")

    def reverse(t: dict) -> None:
        if t["type"] == "income":
            wallets.adjust_balance(t["wallet_id"], u["user_id"], -t["amount"])
        elif t["type"] == "expense":
            wallets.adjust_balance(t["wallet_id"], u["user_id"], t["amount"])
        elif t["type"] == "transfer":
            wallets.adjust_balance(t["wallet_id"], u["user_id"], t["amount"])
            if t.get("to_wallet_id"):
                wallets.adjust_balance(t["to_wallet_id"], u["user_id"], -t["amount"])

    def apply(t: dict) -> None:
        if t["type"] == "income":
            wallets.adjust_balance(t["wallet_id"], u["user_id"], t["amount"])
        elif t["type"] == "expense":
            wallets.adjust_balance(t["wallet_id"], u["user_id"], -t["amount"])
        elif t["type"] == "transfer":
            wallets.adjust_balance(t["wallet_id"], u["user_id"], -t["amount"])
            wallets.adjust_balance(t["to_wallet_id"], u["user_id"], t["amount"])

    reverse(tx)
    apply(merged)
    await txs.update_one({"id": tx_id, "user_id": u["user_id"]}, {"$set": allowed})
    updated = await txs.find_one({"id": tx_id, "user_id": u["user_id"]})
    return {"success": True, "data": {"transaction": updated}}


@router.delete("/{tx_id}")
async def delete_transaction(tx_id: str, authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    tx = await txs.find_one({"id": tx_id, "user_id": u["user_id"]})
    if not tx:
        raise HTTPException(404, "Not found")
    if tx["type"] == "income":
        await wallets.adjust_balance(tx["wallet_id"], u["user_id"], -tx["amount"])
    elif tx["type"] == "expense":
        await wallets.adjust_balance(tx["wallet_id"], u["user_id"], tx["amount"])
    elif tx["type"] == "transfer":
        await wallets.adjust_balance(tx["wallet_id"], u["user_id"], tx["amount"])
        if tx.get("to_wallet_id"):
            await wallets.adjust_balance(tx["to_wallet_id"], u["user_id"], -tx["amount"])
    await txs.delete_one({"id": tx_id, "user_id": u["user_id"]})
    return {"success": True, "data": None}
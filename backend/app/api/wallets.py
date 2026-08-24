from __future__ import annotations

import asyncio
import hashlib
import json
from typing import Any, Optional
from fastapi import APIRouter, Header, HTTPException
from app.schemas.models import WalletCreate
from app.repositories.repos import WalletRepository
from app.services.auth_service import AuthService
from app.services.domain_services import FxService
from app.utils.helpers import new_id, now_utc
from app.database.mongo import get_database
from pymongo.errors import DuplicateKeyError

router = APIRouter(prefix="/wallets")
auth_service = AuthService()
wallets = WalletRepository()


def _create_fingerprint(payload: dict[str, Any]) -> str:
    normalized = {key: value for key, value in payload.items() if key != "client_mutation_id"}
    encoded = json.dumps({"operation": "POST /wallets", "payload": normalized}, default=str, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


@router.get("")
async def list_wallets(authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    items = await wallets.find_by_user(u["user_id"])
    home_ccy = u.get("currency", "USD")
    # Parallelize FX conversions — all wallets share the same home_ccy, so
    # the first call warms the 6h cache and the rest are dict lookups.
    # Sequential 14× await would hold the response up to 8s on cold cache.
    async def _convert_one(w: dict) -> None:
        w_ccy = w.get("currency", home_ccy)
        w["converted_balance"] = round(await FxService.convert(float(w.get("balance", 0.0)), w_ccy, home_ccy), 2)
        w["home_currency"] = home_ccy
    if items:
        await asyncio.gather(*(_convert_one(w) for w in items))
    return {"success": True, "data": {"wallets": items}}


@router.post("")
async def create_wallet(payload: WalletCreate, authorization: Optional[str] = Header(None), x_client_mutation_id: Optional[str] = Header(None, alias="X-Client-Mutation-Id")):
    u = await auth_service.get_current_user(authorization)
    client_mid = x_client_mutation_id or payload.client_mutation_id
    payload_data = payload.model_dump()
    fingerprint = _create_fingerprint(payload_data)
    db = await get_database()
    if client_mid:
        record = await db.idempotency.find_one({"user_id": u["user_id"], "client_mutation_id": client_mid})
        if record:
            if record.get("fingerprint") != fingerprint:
                raise HTTPException(409, "client mutation id was reused for a different operation")
            return {"success": True, "data": record["result"]}
    doc = {"id": new_id("wal"), "user_id": u["user_id"], **payload_data, "created_at": now_utc()}
    if client_mid and not doc.get("client_mutation_id"):
        doc["client_mutation_id"] = client_mid
    try:
        async with await db.client.start_session() as session:
            async with session.start_transaction():
                await wallets.insert_one(doc, session=session)
                result = {"wallet": {k: v for k, v in doc.items() if k != "_id"}}
                if client_mid:
                    await db.idempotency.insert_one({
                        "user_id": u["user_id"], "client_mutation_id": client_mid,
                        "operation": "POST /wallets", "resource_type": "wallet", "resource_id": doc["id"],
                        "fingerprint": fingerprint, "status": "completed", "result": result, "created_at": now_utc(),
                    }, session=session)
    except DuplicateKeyError:
        if client_mid:
            record = await db.idempotency.find_one({"user_id": u["user_id"], "client_mutation_id": client_mid})
            if record:
                if record.get("fingerprint") != fingerprint:
                    raise HTTPException(409, "client mutation id was reused for a different operation")
                return {"success": True, "data": record["result"]}
        raise HTTPException(409, "Duplicate wallet")
    return {"success": True, "data": result}


@router.patch("/{wallet_id}")
async def update_wallet(wallet_id: str, body: dict[str, Any], authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    allowed = {k: v for k, v in body.items() if k in {"name", "type", "balance", "currency", "color", "icon"}}
    await wallets.update_one({"id": wallet_id, "user_id": u["user_id"]}, {"$set": allowed})
    w = await wallets.find_one({"id": wallet_id, "user_id": u["user_id"]})
    return {"success": True, "data": {"wallet": w}}


@router.delete("/{wallet_id}")
async def delete_wallet(wallet_id: str, authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    await wallets.delete_one({"id": wallet_id, "user_id": u["user_id"]})
    from app.repositories.repos import TransactionRepository
    tx_repo = TransactionRepository()
    # Soft-delete all transactions where this wallet was source OR destination.
    # Previously only wallet_id was covered, leaving transfer counter-legs
    # (to_wallet_id) as orphaned records and destination balances inflated.
    await tx_repo.delete_many({"user_id": u["user_id"], "wallet_id": wallet_id})
    await tx_repo.delete_many({"user_id": u["user_id"], "to_wallet_id": wallet_id})
    return {"success": True, "data": None}

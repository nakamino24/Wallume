from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Header, HTTPException, UploadFile, File
from fastapi.responses import Response

from app.services.auth_service import AuthService
from app.services.receipt_service import (
    ReceiptError,
    ReceiptRepository,
    delete_receipt,
    load_receipt,
    save_receipt,
)
from app.repositories.repos import TransactionRepository

router = APIRouter(prefix="/receipts")
auth_service = AuthService()
txs = TransactionRepository()
receipts = ReceiptRepository()


@router.get("")
async def list_receipts(transaction_id: str, authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    items = await receipts.for_transaction(u["owner_id"], transaction_id)
    return {"success": True, "data": {"receipts": items}}


@router.post("")
async def upload_receipt(
    transaction_id: str,
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(None),
):
    u = await auth_service.get_current_user(authorization)
    # The transaction must belong to the caller, otherwise a receipt could be
    # attached to someone else's ledger row.
    tx = await txs.find_one({"id": transaction_id, "user_id": u["owner_id"]})
    if not tx:
        raise HTTPException(404, "Transaction not found")
    try:
        meta = await save_receipt(u["owner_id"], transaction_id, file)
    except ReceiptError as exc:
        raise HTTPException(exc.status_code, exc.message)
    return {"success": True, "data": {"receipt": meta}}


@router.get("/{receipt_id}/file")
async def receipt_file(receipt_id: str, authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    try:
        meta, data = await load_receipt(u["owner_id"], receipt_id)
    except ReceiptError as exc:
        raise HTTPException(exc.status_code, exc.message)

    # Never let a browser sniff an uploaded file into something executable.
    headers = {
        "Content-Disposition": f'inline; filename="{meta.get("filename", "receipt")}"',
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=300",
    }
    return Response(content=data, media_type=meta.get("content_type", "application/octet-stream"), headers=headers)


@router.delete("/{receipt_id}")
async def remove_receipt(receipt_id: str, authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    deleted = await delete_receipt(u["owner_id"], receipt_id)
    if not deleted:
        raise HTTPException(404, "Receipt not found")
    return {"success": True, "data": None}

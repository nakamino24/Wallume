"""Receipt attachment storage.

Bytes live in GridFS and metadata in a `receipts` collection, so no external
object store is required. The important properties are ownership (a receipt is
always fetched with its user_id in the filter) and validation at the boundary
(allow-listed content types, size cap) because this is untrusted upload input.
"""
from __future__ import annotations

import io
from typing import Any, Optional

from bson import ObjectId
from fastapi import UploadFile

from app.database.mongo import get_database
from app.repositories.base import BaseRepository
from app.utils.helpers import new_id, now_utc

# Anything not on this list is rejected rather than sniffed: a finance app has
# no reason to accept arbitrary binaries, and serving them back is an XSS and
# content-sniffing risk.
ALLOWED_CONTENT_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/heic": ".heic",
    "image/heif": ".heif",
    "application/pdf": ".pdf",
}

MAX_RECEIPT_BYTES = 5 * 1024 * 1024  # 5 MB

GRIDFS_BUCKET = "receipts"


class ReceiptError(Exception):
    """Raised for client-correctable receipt problems (mapped to 4xx)."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class ReceiptRepository(BaseRepository):
    def __init__(self) -> None:
        super().__init__("receipts")

    async def for_transaction(self, user_id: str, transaction_id: str) -> list[dict[str, Any]]:
        cursor = (await self._collection()).find(
            self._active_filter({"user_id": user_id, "transaction_id": transaction_id}),
            {"_id": 0},
        ).sort("created_at", 1)
        return await cursor.to_list(100)

    async def for_transactions(self, user_id: str, transaction_ids: list[str]) -> dict[str, list[dict]]:
        """Group receipts by transaction id, for list screens.

        One query rather than N so the transactions list stays a single round
        trip regardless of how many rows have receipts.
        """
        if not transaction_ids:
            return {}
        cursor = (await self._collection()).find(
            self._active_filter({"user_id": user_id, "transaction_id": {"$in": transaction_ids}}),
            {"_id": 0},
        )
        grouped: dict[str, list[dict]] = {}
        for doc in await cursor.to_list(2000):
            grouped.setdefault(doc["transaction_id"], []).append(doc)
        return grouped


async def save_receipt(user_id: str, transaction_id: str, upload: UploadFile) -> dict[str, Any]:
    content_type = (upload.content_type or "").lower().split(";")[0].strip()
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise ReceiptError(
            f"Unsupported file type. Allowed: {', '.join(sorted(ALLOWED_CONTENT_TYPES))}",
            415,
        )

    # Read with a hard cap instead of trusting Content-Length, which the client
    # controls and can lie about.
    data = await upload.read(MAX_RECEIPT_BYTES + 1)
    if not data:
        raise ReceiptError("The uploaded file is empty")
    if len(data) > MAX_RECEIPT_BYTES:
        raise ReceiptError(f"Receipt exceeds the {MAX_RECEIPT_BYTES // (1024 * 1024)} MB limit", 413)

    db = await get_database()
    receipt_id = new_id("rcp")
    from motor.motor_asyncio import AsyncIOMotorGridFSBucket

    bucket = AsyncIOMotorGridFSBucket(db, bucket_name=GRIDFS_BUCKET)
    file_id = await bucket.upload_from_stream(
        receipt_id,
        io.BytesIO(data),
        metadata={
            "user_id": user_id,
            "transaction_id": transaction_id,
            "content_type": content_type,
        },
    )

    doc = {
        "id": receipt_id,
        "user_id": user_id,
        "transaction_id": transaction_id,
        "content_type": content_type,
        "filename": (upload.filename or f"receipt{ALLOWED_CONTENT_TYPES[content_type]}")[:200],
        "size": len(data),
        "gridfs_id": file_id,
        "created_at": now_utc(),
    }
    await ReceiptRepository().insert_one(doc)
    return {k: v for k, v in doc.items() if k not in {"_id", "gridfs_id"}}


async def load_receipt(user_id: str, receipt_id: str) -> tuple[dict[str, Any], bytes]:
    repo = ReceiptRepository()
    meta = await repo.find_one({"id": receipt_id, "user_id": user_id})
    if not meta:
        raise ReceiptError("Receipt not found", 404)

    db = await get_database()
    from motor.motor_asyncio import AsyncIOMotorGridFSBucket

    bucket = AsyncIOMotorGridFSBucket(db, bucket_name=GRIDFS_BUCKET)
    gridfs_id = meta.get("gridfs_id")
    if gridfs_id is None:
        raise ReceiptError("Receipt data is missing", 404)

    try:
        stream = await bucket.open_download_stream(gridfs_id if isinstance(gridfs_id, ObjectId) else ObjectId(str(gridfs_id)))
        data = await stream.read()
    except Exception as exc:
        from app.core.telemetry import capture_exception
        capture_exception(exc, area="receipts", operation="load")
        raise ReceiptError("Receipt data is missing", 404)

    return meta, data


async def delete_receipt(user_id: str, receipt_id: str) -> bool:
    repo = ReceiptRepository()
    meta = await repo.find_one({"id": receipt_id, "user_id": user_id})
    if not meta:
        return False

    db = await get_database()
    from motor.motor_asyncio import AsyncIOMotorGridFSBucket

    bucket = AsyncIOMotorGridFSBucket(db, bucket_name=GRIDFS_BUCKET)
    gridfs_id = meta.get("gridfs_id")
    if gridfs_id is not None:
        try:
            await bucket.delete(ObjectId(str(gridfs_id)))
        except Exception:
            # The metadata row is still removed below; an orphaned blob is
            # preferable to a receipt the user cannot delete.
            pass

    await repo.delete_one({"id": receipt_id, "user_id": user_id}, hard=True)
    return True


async def delete_receipts_for_transaction(user_id: str, transaction_id: str) -> int:
    """Remove every receipt attached to a transaction (called on tx delete)."""
    repo = ReceiptRepository()
    docs = await repo.for_transaction(user_id, transaction_id)
    removed = 0
    for doc in docs:
        if await delete_receipt(user_id, doc["id"]):
            removed += 1
    return removed


async def delete_all_receipts(user_id: str) -> None:
    """Purge a user's receipts on account deletion."""
    repo = ReceiptRepository()
    docs = await repo.find_by_user(user_id)
    for doc in docs:
        await delete_receipt(user_id, doc["id"])

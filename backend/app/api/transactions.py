from __future__ import annotations

import asyncio
import hashlib
import json
import math
import random
from typing import Any, Awaitable, Callable, Optional
from fastapi import APIRouter, Header, HTTPException
from pymongo.errors import OperationFailure
from app.schemas.models import TransactionCreate, TransactionImportRequest
from app.repositories.repos import WalletRepository, TransactionRepository
from app.services.auth_service import AuthService
from app.services.domain_services import FxService
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


async def run_in_txn(fn: Callable[[Any], Awaitable[Any]], attempts: int = 8) -> Any:
    """Run fn(session) inside a multi-document transaction.

    RETRY POLICY â€” deliberately narrow:
    Only OperationFailure errors carrying MongoDB's
    ``TransientTransactionError`` label are retried (e.g. WriteConflict).
    That label is MongoDB's own explicit contract that aborting-and-retrying
    the whole transaction is safe: the txn aborted before any commit, so no
    partial state exists and fn(session) simply runs again from scratch.
    Everything else â€” validation failures, not-found, duplicate keys,
    network/auth faults â€” propagates immediately with no retry.

    BACKOFF: exponential with jitter â€” min(0.05 * 1.5^attempt, 0.3)s plus
    up to 30ms random jitter â€” for up to `attempts` (default 8) total tries
    (~1.3s worst-case wait) before giving up with 409 Conflict so clients
    can retry explicitly. Concurrent PATCHes touching the same wallet or
    transaction documents legitimately race; without retries those surface
    as opaque 500s.
    """
    for attempt in range(attempts):
        db = await get_database()
        try:
            async with await db.client.start_session() as session:
                async with session.start_transaction():
                    return await fn(session)
        except OperationFailure as e:
            if not e.has_error_label("TransientTransactionError") or attempt == attempts - 1:
                raise
            delay = min(0.05 * (1.5 ** attempt), 0.3) + random.random() * 0.03
            await asyncio.sleep(delay)
    # Retries exhausted under extreme write contention: signal the client to
    # retry explicitly instead of leaking an opaque 500.
    raise HTTPException(409, "Transaction busy, please retry")


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
                        tx_type: str, amount, session, reverse: bool,
                        tx_currency: Optional[str] = None,
                        wallet_amount: Any = None,
                        to_wallet_amount: Any = None):
    """Apply (or reverse) a transaction's wallet effect inside a session.

    `Decimal128` cannot be negated (`-Decimal128(...)` raises TypeError), so we
    convert the amount to a Python Decimal first and negate that â€” the root-cause
    bug that left transfer balances half-reverted or un-reverted.
    """
    source_wallet = await wallets.find_one({"id": wallet_id, "user_id": user_id}, session)
    if not source_wallet:
        raise HTTPException(400, "Wallet not found")
    source_currency = source_wallet.get("currency") or tx_currency or "USD"
    input_currency = tx_currency or source_currency
    source_amount = (
        to_decimal(wallet_amount)
        if wallet_amount is not None
        else to_decimal(await FxService.convert(float(amount), input_currency, source_currency))
    )
    source_delta = source_amount if tx_type == "income" else -source_amount
    if reverse:
        source_delta = -source_delta
    if tx_type == "income":
        await wallets.adjust_balance(wallet_id, user_id, source_delta, session)
    elif tx_type == "expense":
        await wallets.adjust_balance(wallet_id, user_id, source_delta, session)
    elif tx_type == "transfer":
        if not to_wallet_id:
            raise HTTPException(400, "to_wallet_id required for transfer")
        destination_wallet = await wallets.find_one({"id": to_wallet_id, "user_id": user_id}, session)
        if not destination_wallet:
            raise HTTPException(400, "Wallet not found")
        destination_currency = destination_wallet.get("currency") or input_currency
        destination_amount = (
            to_decimal(to_wallet_amount)
            if to_wallet_amount is not None
            else to_decimal(await FxService.convert(float(amount), input_currency, destination_currency))
        )
        destination_delta = -destination_amount if reverse else destination_amount
        await wallets.adjust_balance(wallet_id, user_id, source_delta, session)
        await wallets.adjust_balance(to_wallet_id, user_id, destination_delta, session)
        return source_amount, destination_amount
    return source_amount, None


@router.get("")
async def list_transactions(
    authorization: Optional[str] = Header(None),
    limit: int = 100,
    offset: int = 0,
    type: Optional[str] = None,
    wallet_id: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
):
    u = await auth_service.get_current_user(authorization)
    # Clamp rather than reject: a malformed limit should degrade to a sane
    # page size, not 500 the whole list screen.
    limit = max(1, min(limit, 500))
    offset = max(0, offset)
    items = await txs.find_by_user(
        u["owner_id"], type, wallet_id, limit, from_date, to_date,
        search=search, category=category, offset=offset,
    )
    total = await txs.count_by_user(
        u["owner_id"], type, wallet_id, from_date, to_date, search=search, category=category,
    )
    home_currency = u.get("currency", "USD")
    wallet_items = await wallets.find_by_user(u["owner_id"])
    wallet_currencies = {wallet["id"]: wallet.get("currency") or home_currency for wallet in wallet_items}

    async def _convert_one(item: dict) -> None:
        item_currency = item.get("currency") or wallet_currencies.get(item.get("wallet_id")) or home_currency
        item["currency"] = item_currency
        item["converted_amount"] = round(
            await FxService.convert(float(item.get("amount", 0.0)), item_currency, home_currency), 2
        )
        item["home_currency"] = home_currency

    if items:
        await asyncio.gather(*(_convert_one(item) for item in items))
    return {"success": True, "data": {"transactions": items, "total": total, "limit": limit, "offset": offset}}


@router.post("")
async def create_transaction(payload: TransactionCreate, authorization: Optional[str] = Header(None), x_client_mutation_id: Optional[str] = Header(None, alias="X-Client-Mutation-Id")):
    u = await auth_service.get_current_user(authorization)
    client_mid = x_client_mutation_id or payload.client_mutation_id
    payload_data = payload.model_dump()
    fingerprint = _idempotency_fingerprint("POST /transactions", "", payload_data)
    db = await get_database()
    found, result = await _find_idempotency_result(db, u["owner_id"], client_mid, fingerprint)
    if found:
        return {"success": True, "data": result}
    _require_positive_amount(payload.amount)
    # Canonical-or-today. The fallback MUST itself be canonical â€” an empty
    # string date used to fall through to now_utc().isoformat() (full ISO) and
    # reintroduce the mixed-format ordering bug this module exists to prevent.
    tx_date = strict_canonical_date(payload.date) or now_utc().strftime("%Y-%m-%d")
    payload_fields = payload.model_dump(exclude={"splits"})
    doc = {"id": new_id("tx"), "user_id": u["owner_id"], **payload_fields,
           "date": tx_date, "created_at": now_utc()}
    # Ensure client_mutation_id from header is stored if provided there
    if client_mid and not doc.get("client_mutation_id"):
        doc["client_mutation_id"] = client_mid
    if client_mid:
        doc["idempotency_fingerprint"] = fingerprint

    doc["currency"] = payload.currency or u.get("currency", "USD")

    # Split expenses become one row per part, all sharing a group id. The
    # wallet effect is still applied ONCE for the total: the parts are a
    # breakdown of a single debit, not separate withdrawals.
    split_group_id = new_id("spl") if payload.splits else None
    if split_group_id:
        doc["split_group_id"] = split_group_id
        doc["split_total"] = round(payload.amount, 2)

    async def txn(session):
        w = await wallets.find_one({"id": payload.wallet_id, "user_id": u["owner_id"]}, session)
        if not w:
            raise HTTPException(400, "Wallet not found")
        if payload.type == "transfer":
            if not payload.to_wallet_id:
                raise HTTPException(400, "to_wallet_id required for transfer")
            if payload.to_wallet_id == payload.wallet_id:
                raise HTTPException(400, "Cannot transfer to the same wallet")
            dw = await wallets.find_one({"id": payload.to_wallet_id, "user_id": u["owner_id"]}, session)
            if not dw:
                raise HTTPException(400, "Destination wallet not found")
        wallet_amount, to_wallet_amount = await _apply_effect(
            u["owner_id"], payload.wallet_id, payload.to_wallet_id, payload.type,
            payload.amount, session, reverse=False, tx_currency=doc["currency"],
        )

        if payload.splits:
            # Every part carries the wallet effect apportioned by its share so
            # `wallet_amount` stays meaningful per row, but the sum equals the
            # single debit applied above.
            parts_out = []
            for index, part in enumerate(payload.splits):
                part_doc = {
                    **doc,
                    "id": new_id("tx"),
                    "category": part.category,
                    "amount": float(part.amount),
                    "note": part.note or doc.get("note", ""),
                    "split_index": index,
                    "wallet_amount": float(wallet_amount) * (float(part.amount) / payload.amount),
                }
                await txs.insert_one(part_doc, session)
                parts_out.append({k: v for k, v in part_doc.items() if k != "_id"})
            result = {"transactions": parts_out, "transaction": parts_out[0], "split_group_id": split_group_id}
        else:
            doc["wallet_amount"] = float(wallet_amount)
            if to_wallet_amount is not None:
                doc["to_wallet_amount"] = float(to_wallet_amount)
            await txs.insert_one(doc, session)
            result = {"transaction": {k: v for k, v in doc.items() if k != "_id"}}

        if client_mid:
            await db.idempotency.insert_one({
                "user_id": u["owner_id"], "client_mutation_id": client_mid,
                "operation": "POST /transactions", "resource_type": "transaction", "resource_id": doc["id"],
                "fingerprint": fingerprint, "status": "completed", "result": result, "created_at": now_utc(),
            }, session=session)
        return result

    try:
        result = await run_in_txn(txn)
    except DuplicateKeyError:
        found, result = await _find_idempotency_result(db, u["owner_id"], client_mid, fingerprint)
        if found:
            return {"success": True, "data": result}
        raise HTTPException(409, "Duplicate transaction")

    return {"success": True, "data": result}


@router.post("/import")
async def import_transactions(
    payload: TransactionImportRequest,
    authorization: Optional[str] = Header(None),
    x_client_mutation_id: Optional[str] = Header(None, alias="X-Client-Mutation-Id"),
):
    """Bulk-create transactions from a parsed bank statement.

    Manual entry is the main reason people abandon a finance app, so import is
    a retention feature rather than a convenience. Safety properties:

    - `dry_run` returns exactly what would be imported without writing.
    - Re-importing the same statement is a no-op: rows are deduplicated against
      existing transactions on (date, amount, merchant).
    - The whole batch commits in one MongoDB transaction, so a partial import
      can never leave half a statement in the ledger with the balance applied.
    """
    u = await auth_service.get_current_user(authorization)
    if not payload.rows:
        raise HTTPException(400, "No rows to import")
    if len(payload.rows) > 1000:
        raise HTTPException(400, "Too many rows (max 1000 per import)")

    wallet = await wallets.find_one({"id": payload.wallet_id, "user_id": u["owner_id"]})
    if not wallet:
        raise HTTPException(400, "Wallet not found")

    client_mid = x_client_mutation_id or payload.client_mutation_id
    fingerprint = _idempotency_fingerprint(
        "POST /transactions/import", payload.wallet_id, payload.model_dump(),
    )
    db = await get_database()
    if not payload.dry_run:
        found, result = await _find_idempotency_result(db, u["owner_id"], client_mid, fingerprint)
        if found:
            return {"success": True, "data": result}

    today = now_utc().strftime("%Y-%m-%d")
    errors: list[dict] = []
    cleaned: list[dict] = []
    for index, row in enumerate(payload.rows):
        amount = float(row.amount)
        if not math.isfinite(amount) or amount <= 0:
            errors.append({"index": index, "reason": "invalid_amount"})
            continue
        date = strict_canonical_date(row.date) if row.date else today
        if not date:
            errors.append({"index": index, "reason": "invalid_date"})
            continue
        cleaned.append({
            "date": date,
            "amount": amount,
            "type": row.type,
            "category": (row.category or "").strip() or ("Salary" if row.type == "income" else "Other"),
            "merchant": (row.merchant or "").strip()[:120],
            "note": (row.note or "").strip()[:500],
        })

    # Dedupe against what is already in the ledger for the same wallet and the
    # imported date span. Fetched per-batch rather than per-row to keep the
    # import O(1) round trips.
    duplicates: list[dict] = []
    accepted: list[dict] = []
    if cleaned:
        dates = sorted({c["date"] for c in cleaned})
        existing = await txs.find_by_user(
            u["owner_id"], None, payload.wallet_id, 5000, dates[0], dates[-1],
        )
        def _key(date: str, amount: float, merchant: str) -> tuple:
            return (date, round(float(amount), 2), (merchant or "").strip().lower())
        seen = {_key(e.get("date", ""), e.get("amount", 0), e.get("merchant", "")) for e in existing}
        for c in cleaned:
            key = _key(c["date"], c["amount"], c["merchant"])
            if key in seen:
                duplicates.append(c)
                continue
            seen.add(key)
            accepted.append(c)

    if payload.dry_run:
        return {"success": True, "data": {
            "dry_run": True,
            "rows": accepted,
            "count": len(accepted),
            "duplicates": duplicates,
            "duplicate_count": len(duplicates),
            "errors": errors,
        }}

    currency = u.get("currency", "USD")
    created: list[dict] = []
    async with await db.client.start_session() as session:
        async with session.start_transaction():
            for c in accepted:
                doc = {
                    "id": new_id("tx"),
                    "user_id": u["owner_id"],
                    "wallet_id": payload.wallet_id,
                    "to_wallet_id": None,
                    "type": c["type"],
                    "amount": c["amount"],
                    "category": c["category"],
                    "merchant": c["merchant"],
                    "note": c["note"] or c["merchant"],
                    "date": c["date"],
                    "currency": currency,
                    "created_at": now_utc(),
                }
                wallet_amount, _ = await _apply_effect(
                    u["owner_id"], payload.wallet_id, None, c["type"],
                    c["amount"], session, reverse=False, tx_currency=currency,
                )
                doc["wallet_amount"] = float(wallet_amount)
                await txs.insert_one(doc, session)
                created.append({k: v for k, v in doc.items() if k != "_id"})
            result = {
                "imported": len(created),
                "transactions": created,
                "duplicates": duplicates,
                "duplicate_count": len(duplicates),
                "errors": errors,
            }
            if client_mid:
                await db.idempotency.insert_one({
                    "user_id": u["owner_id"], "client_mutation_id": client_mid,
                    "operation": "POST /transactions/import", "resource_type": "transaction",
                    "resource_id": payload.wallet_id,
                    "fingerprint": fingerprint, "status": "completed", "result": result,
                    "created_at": now_utc(),
                }, session=session)

    return {"success": True, "data": result}


@router.patch("/{tx_id}")
async def update_transaction(tx_id: str, body: dict[str, Any], authorization: Optional[str] = Header(None), x_client_mutation_id: Optional[str] = Header(None, alias="X-Client-Mutation-Id")):
    client_mid = x_client_mutation_id or body.get("client_mutation_id")
    u = await auth_service.get_current_user(authorization)
    db = await get_database()
    fingerprint = _idempotency_fingerprint("PATCH /transactions", tx_id, body)
    found, result = await _find_idempotency_result(db, u["owner_id"], client_mid, fingerprint)
    if found:
        return {"success": True, "data": result}

    async def txn(session):
        tx = await txs.find_one({"id": tx_id, "user_id": u["owner_id"]}, session)
        if not tx:
            raise HTTPException(404, "Not found")

        allowed = {k: v for k, v in body.items()
                   if k in {"wallet_id", "to_wallet_id", "type", "amount", "category", "merchant", "note", "date", "currency"}}
        # A split part is one leg of a single pooled debit. Editing its amount
        # or category in isolation would desync the parts from split_total and
        # from the wallet movement already applied, so those are read-only:
        # delete the split and re-enter it instead.
        if tx.get("split_group_id"):
            allowed = {k: v for k, v in allowed.items() if k in {"merchant", "note", "date"}}
        # Validate only CHANGED fields: re-validating the stored amount
        # would make legacy bad-amount records impossible to edit at all.
        if "amount" in allowed:
            _require_positive_amount(allowed["amount"])
            allowed["amount"] = float(allowed["amount"])
        if "merchant" in allowed:
            # Mirror the create-side normalization so PATCH can't smuggle
            # in whitespace-only or oversized values.
            allowed["merchant"] = str(allowed["merchant"] or "").strip()[:120]
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
            dw = await wallets.find_one({"id": merged["to_wallet_id"], "user_id": u["owner_id"]}, session)
            if not dw:
                raise HTTPException(400, "Destination wallet not found")

        # Both wallets referenced by the EFFECTIVE state must exist and
        # belong to the user: adjust_balance() is a silent no-op on a
        # missing wallet, so an unvalidated edit would move the record but
        # never the money â€” permanent balance drift.
        sw = await wallets.find_one({"id": merged["wallet_id"], "user_id": u["owner_id"]}, session)
        if not sw:
            raise HTTPException(400, "Wallet not found")
        merged["currency"] = allowed.get("currency") or tx.get("currency") or u.get("currency", "USD")
        allowed["currency"] = merged["currency"]

        # The resource, balances, and replay record must commit together.
        old_currency = tx.get("currency") or u.get("currency", "USD")
        if not tx.get("currency"):
            old_wallet = await wallets.find_one({"id": tx["wallet_id"], "user_id": u["owner_id"]}, session)
            old_currency = (old_wallet or {}).get("currency") or u.get("currency", "USD")

        # Reverse+apply is only needed when the money-relevant projection of
        # the transaction changed. Metadata-only edits (merchant/note/date/
        # category) must not touch wallet documents at all â€” it's wasted work
        # and needlessly serializes concurrent edits on the same wallet.
        # Currency is money-relevant because it changes wallet_amount.
        money_unchanged = (
            tx["wallet_id"] == merged["wallet_id"]
            and tx["type"] == merged["type"]
            and to_decimal(tx["amount"]) == to_decimal(merged["amount"])
            and (tx.get("to_wallet_id") or None) == (merged.get("to_wallet_id") or None)
            and old_currency == merged["currency"]
        )
        if not money_unchanged:
            # Atomic: fully reverse the OLD effect, then apply the NEW effect â€”
            # both in one transaction, or nothing persists.
            await _apply_effect(
                u["owner_id"], tx["wallet_id"], tx.get("to_wallet_id"), tx["type"],
                tx["amount"], session, reverse=True, tx_currency=old_currency,
                wallet_amount=tx.get("wallet_amount"),
                to_wallet_amount=tx.get("to_wallet_amount"),
            )
            wallet_amount, to_wallet_amount = await _apply_effect(
                u["owner_id"], merged["wallet_id"], merged.get("to_wallet_id"), merged["type"],
                merged["amount"], session, reverse=False, tx_currency=merged["currency"],
            )
            allowed["wallet_amount"] = float(wallet_amount)
            if to_wallet_amount is None:
                allowed.pop("to_wallet_amount", None)
                if tx.get("to_wallet_amount") is not None:
                    allowed["to_wallet_amount"] = None
            else:
                allowed["to_wallet_amount"] = float(to_wallet_amount)

        await txs.update_one({"id": tx_id, "user_id": u["owner_id"]}, {"$set": allowed}, session=session)
        updated = await txs.find_one({"id": tx_id, "user_id": u["owner_id"]}, session)
        if client_mid:
            await db.idempotency.insert_one({
                "user_id": u["owner_id"], "client_mutation_id": client_mid,
                "operation": "PATCH /transactions", "resource_type": "transaction", "resource_id": tx_id,
                "fingerprint": fingerprint, "status": "completed", "result": {"transaction": updated}, "created_at": now_utc(),
            }, session=session)
        return updated

    try:
        updated = await run_in_txn(txn)
    except DuplicateKeyError:
        found, result = await _find_idempotency_result(db, u["owner_id"], client_mid, fingerprint)
        if found:
            return {"success": True, "data": result}
        raise

    return {"success": True, "data": {"transaction": updated}}


@router.delete("/{tx_id}")
async def delete_transaction(tx_id: str, authorization: Optional[str] = Header(None), x_client_mutation_id: Optional[str] = Header(None, alias="X-Client-Mutation-Id")):
    u = await auth_service.get_current_user(authorization)

    db = await get_database()
    fingerprint = _idempotency_fingerprint("DELETE /transactions", tx_id, {})
    found, result = await _find_idempotency_result(db, u["owner_id"], x_client_mutation_id, fingerprint)
    if found:
        return {"success": True, "data": result}

    async def txn(session):
        tx = await txs.find_one({"id": tx_id, "user_id": u["owner_id"]}, session)
        if not tx:
            raise HTTPException(404, "Not found")

        # Atomic + idempotent: both sides reverted together, then the record
        # is soft-deleted inside the same session. A second delete finds no
        # active record (404) and never double-reverses.
        tx_currency = tx.get("currency")
        if not tx_currency:
            source_wallet = await wallets.find_one({"id": tx["wallet_id"], "user_id": u["owner_id"]}, session)
            tx_currency = (source_wallet or {}).get("currency") or u.get("currency", "USD")

        group_id = tx.get("split_group_id")
        if group_id:
            # Deleting any part removes the whole split and reverses the
            # original total exactly once. Reversing per-part would subtract
            # each part's share and drift the wallet, and leaving siblings
            # behind would keep spending attributed to a deleted purchase.
            parts = await txs.find_by_user(u["owner_id"], None, None, 500, None, None)
            group_parts = [p for p in parts if p.get("split_group_id") == group_id]
            # Re-use the amounts actually applied at insert time; recomputing
            # from today's FX rate would leave cross-currency splits drifted.
            applied = sum(float(p.get("wallet_amount") or 0.0) for p in group_parts)
            await _apply_effect(
                u["owner_id"], tx["wallet_id"], None, tx["type"],
                tx.get("split_total") or tx["amount"], session, reverse=True, tx_currency=tx_currency,
                wallet_amount=applied if group_parts else None,
            )
            await txs.delete_many(
                {"split_group_id": group_id, "user_id": u["owner_id"]}, session=session,
            )
        else:
            await _apply_effect(
                u["owner_id"], tx["wallet_id"], tx.get("to_wallet_id"), tx["type"],
                tx["amount"], session, reverse=True, tx_currency=tx_currency,
                wallet_amount=tx.get("wallet_amount"),
                to_wallet_amount=tx.get("to_wallet_amount"),
            )
            await txs.delete_one({"id": tx_id, "user_id": u["owner_id"]}, session=session)

        if x_client_mutation_id:
            await db.idempotency.insert_one({
                "user_id": u["owner_id"], "client_mutation_id": x_client_mutation_id,
                "operation": "DELETE /transactions", "resource_type": "transaction", "resource_id": tx_id,
                "fingerprint": fingerprint, "status": "completed", "result": None, "created_at": now_utc(),
            }, session=session)

    try:
        await run_in_txn(txn)
        # Receipts live in GridFS, outside the Mongo session, so they are
        # cleaned up after commit. Leaving them would orphan blobs forever
        # while the owning transaction no longer exists.
        try:
            from app.services.receipt_service import delete_receipts_for_transaction
            await delete_receipts_for_transaction(u["owner_id"], tx_id)
        except Exception:
            pass
    except DuplicateKeyError:
        found, result = await _find_idempotency_result(db, u["owner_id"], x_client_mutation_id, fingerprint)
        if found:
            return {"success": True, "data": result}
        raise

    return {"success": True, "data": None}

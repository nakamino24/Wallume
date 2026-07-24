"""
Matrix Finance — backend
FastAPI + MongoDB (motor). All routes prefixed with /api.
Dual auth: JWT email/password + Emergent-managed Google OAuth.
"""
from fastapi import FastAPI, APIRouter, HTTPException, Header, Request
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal, Any, Dict
from datetime import datetime, timezone, timedelta
from pathlib import Path
import os
import uuid
import logging
import asyncio
import bcrypt
import jwt
import httpx
import json as _json
import certifi

# from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
# EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")

client = AsyncIOMotorClient(
    MONGO_URL,
    serverSelectionTimeoutMS=5000,
    tlsCAFile=certifi.where(),
)
db = client[DB_NAME]

app = FastAPI(title="Matrix Finance")
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
log = logging.getLogger("matrix-finance")


# ----------------------------- helpers ------------------------------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def new_id(prefix: str = "id") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:16]}"


# ------------------------- FX conversion ------------------------------
# Free, no-API-key exchange rate service. Cached in-memory per base currency
# for 6 hours so we don't hammer it on every request.
_fx_cache: Dict[str, Any] = {}


async def get_fx_rates(base: str) -> Dict[str, float]:
    cached = _fx_cache.get(base)
    if cached and (now_utc() - cached["fetched_at"]).total_seconds() < 6 * 3600:
        return cached["rates"]
    try:
        async with httpx.AsyncClient(timeout=8.0) as hc:
            resp = await hc.get(f"https://open.er-api.com/v6/latest/{base}")
            data = resp.json()
            rates = data.get("rates") or {}
            if rates:
                _fx_cache[base] = {"rates": rates, "fetched_at": now_utc()}
                return rates
    except Exception:
        log.warning("FX rate fetch failed for base=%s, using stale/empty cache", base)
    return cached["rates"] if cached else {}


async def convert_amount(amount: float, from_ccy: Optional[str], to_ccy: Optional[str]) -> float:
    """Convert `amount` (in from_ccy) into to_ccy. Falls back to the original
    amount (1:1) if either currency is missing/unknown or the FX API is down —
    never breaks the dashboard just because a rate lookup failed."""
    if not from_ccy or not to_ccy or from_ccy == to_ccy:
        return amount
    rates = await get_fx_rates(to_ccy)
    rate = rates.get(from_ccy)
    if not rate:
        return amount
    return amount / rate


def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def issue_jwt(user_id: str) -> str:
    jti = uuid.uuid4().hex[:16]
    payload = {"sub": user_id, "jti": jti, "iat": int(now_utc().timestamp()),
               "exp": int((now_utc() + timedelta(days=30)).timestamp())}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


async def is_token_blacklisted(jti: str) -> bool:
    return await db.token_blacklist.find_one({"jti": jti}) is not None


async def get_user_from_token(authorization: Optional[str]) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing bearer token")
    token = authorization.split(" ", 1)[1]
    # try JWT first
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        jti = payload.get("jti", "")
        if jti and await is_token_blacklisted(jti):
            raise HTTPException(401, "Token revoked")
        user = await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if user:
            return user
    except jwt.PyJWTError:
        pass
    # fall back to session token
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(401, "Invalid or expired token")
    exp = session["expires_at"]
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < now_utc():
        raise HTTPException(401, "Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user


# ------------------------------- models -------------------------------
class SignupIn(BaseModel):
    email: EmailStr
    password: str
    name: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class EmergentSessionIn(BaseModel):
    session_token: str


class WalletIn(BaseModel):
    name: str
    type: Literal["cash", "bank", "credit_card", "e_wallet", "savings", "investment"]
    balance: float = 0.0
    currency: str = "USD"
    color: Optional[str] = None
    icon: Optional[str] = None


class TransactionIn(BaseModel):
    wallet_id: str
    to_wallet_id: Optional[str] = None
    type: Literal["income", "expense", "transfer"]
    amount: float
    category: str
    note: Optional[str] = ""
    date: Optional[str] = None  # ISO


class BudgetIn(BaseModel):
    category: str
    amount: float
    period: Literal["monthly", "weekly", "yearly"] = "monthly"
    icon: Optional[str] = None
    color: Optional[str] = None


class GoalIn(BaseModel):
    name: str
    target_amount: float
    saved_amount: float = 0.0
    target_date: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    kind: Literal["general", "emergency", "car", "vacation", "education", "gadget", "business"] = "general"


class GoalContributeIn(BaseModel):
    amount: float


class PlanIn(BaseModel):
    kind: Literal["wedding", "house", "car", "vacation"]
    name: str
    total_budget: float
    target_date: Optional[str] = None
    notes: Optional[str] = ""


class PlanItemIn(BaseModel):
    label: str
    amount: float = 0.0
    paid: float = 0.0
    done: bool = False


class DebtIn(BaseModel):
    name: str
    principal: float
    remaining: float
    interest_rate: float = 0.0
    monthly_payment: float = 0.0
    due_day: Optional[int] = None
    kind: Literal["loan", "credit_card", "mortgage", "personal", "other"] = "loan"


class InvestmentIn(BaseModel):
    name: str
    ticker: Optional[str] = None
    kind: Literal["stock", "etf", "mutual_fund", "bond", "crypto", "gold", "cash", "other"] = "stock"
    quantity: float = 0.0
    avg_cost: float = 0.0
    current_price: float = 0.0
    # Bond-specific (face_value/coupon_rate are informational; purchase_price/current_value
    # drive the value shown, mirrored into avg_cost/current_price so totals elsewhere still work)
    face_value: Optional[float] = None
    coupon_rate: Optional[float] = None
    purchase_price: Optional[float] = None
    current_value: Optional[float] = None
    # Supporting info
    broker: Optional[str] = None
    purchase_date: Optional[str] = None
    notes: Optional[str] = None


class AssetIn(BaseModel):
    name: str
    value: float
    kind: Literal["real_estate", "vehicle", "gadget", "cash", "receivable", "other"] = "other"


class RecurringIn(BaseModel):
    name: str
    amount: float
    type: Literal["income", "expense"] = "expense"
    category: str = "Bills"
    wallet_id: str
    frequency: Literal["weekly", "monthly", "yearly"] = "monthly"
    next_date: str  # ISO date of the next occurrence
    note: Optional[str] = ""
    active: bool = True


class ChatIn(BaseModel):
    session_id: str
    message: str


# ------------------------------ health --------------------------------
@api.get("/")
async def root():
    return {"app": "Matrix Finance", "status": "ok"}


# ------------------------------ auth ---------------------------------
@api.post("/auth/signup")
@limiter.limit("5/minute")
async def signup(payload: SignupIn, request: Request):
    existing = await db.users.find_one({"email": payload.email.lower()}, {"_id": 0})
    if existing:
        raise HTTPException(400, "Email already registered")
    user_id = new_id("user")
    doc = {
        "user_id": user_id,
        "email": payload.email.lower(),
        "name": payload.name.strip() or payload.email.split("@")[0],
        "password_hash": hash_pw(payload.password),
        "picture": None,
        "provider": "email",
        "currency": "USD",
        "theme": "dark",
        "created_at": now_utc(),
    }
    await db.users.insert_one(doc)
    doc.pop("password_hash", None)
    doc.pop("_id", None)
    await seed_starter_data(user_id)
    return {"token": issue_jwt(user_id), "user": _clean_user(doc)}


@api.post("/auth/login")
@limiter.limit("10/minute")
async def login(payload: LoginIn, request: Request):
    user = await db.users.find_one({"email": payload.email.lower()}, {"_id": 0})
    if not user or not user.get("password_hash") or not verify_pw(payload.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    user.pop("password_hash", None)
    return {"token": issue_jwt(user["user_id"]), "user": _clean_user(user)}


# Emergent Google OAuth endpoint disabled — no emergentintegrations package
# @api.post("/auth/emergent-session")
# async def emergent_session(payload: EmergentSessionIn):
#     ...


@api.get("/auth/me")
async def me(authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(authorization)
    return {"user": _clean_user(user)}


@api.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
        await db.user_sessions.delete_many({"session_token": token})
        # Blacklist the JWT so it can't be used again
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            jti = payload.get("jti")
            exp = payload.get("exp")
            if jti:
                await db.token_blacklist.update_one(
                    {"jti": jti},
                    {"$set": {"jti": jti, "expires_at": datetime.fromtimestamp(exp, tz=timezone.utc) if exp else now_utc()}},
                    upsert=True,
                )
        except jwt.PyJWTError:
            pass
    return {"ok": True}


@api.patch("/auth/me")
async def update_me(body: Dict[str, Any], authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(authorization)
    allowed = {k: v for k, v in body.items() if k in {"name", "currency", "theme", "picture"}}
    if allowed:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": allowed})
    updated = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0})
    if not updated:
        raise HTTPException(404, "User not found")
    return {"user": _clean_user(updated)}


@api.delete("/auth/me")
async def delete_account(authorization: Optional[str] = Header(None)):
    u = await get_user_from_token(authorization)
    uid = u["user_id"]
    collections = ["wallets", "transactions", "budgets", "goals", "plans",
                   "debts", "investments", "assets", "chat_messages",
                   "recurring", "user_sessions"]
    for coll in collections:
        await db[coll].delete_many({"user_id": uid})
    await db.users.delete_one({"user_id": uid})
    return {"ok": True}


def _clean_user(u: Dict[str, Any]) -> Dict[str, Any]:
    return {k: v for k, v in u.items() if k not in {"_id", "password_hash"}}


# ---------------------------- wallets --------------------------------
@api.get("/wallets")
async def list_wallets(authorization: Optional[str] = Header(None)):
    u = await get_user_from_token(authorization)
    items = await db.wallets.find({"user_id": u["user_id"]}, {"_id": 0}).sort("created_at", 1).to_list(500)
    home_ccy = u.get("currency", "USD")
    for w in items:
        w_ccy = w.get("currency", home_ccy)
        w["converted_balance"] = round(await convert_amount(float(w.get("balance", 0.0)), w_ccy, home_ccy), 2)
        w["home_currency"] = home_ccy
    return {"wallets": items}


@api.post("/wallets")
async def create_wallet(payload: WalletIn, authorization: Optional[str] = Header(None)):
    u = await get_user_from_token(authorization)
    doc = {"id": new_id("wal"), "user_id": u["user_id"], **payload.dict(), "created_at": now_utc()}
    await db.wallets.insert_one(doc)
    doc.pop("_id", None)
    return {"wallet": doc}


@api.patch("/wallets/{wallet_id}")
async def update_wallet(wallet_id: str, body: Dict[str, Any], authorization: Optional[str] = Header(None)):
    u = await get_user_from_token(authorization)
    allowed = {k: v for k, v in body.items() if k in {"name", "type", "balance", "currency", "color", "icon"}}
    await db.wallets.update_one({"id": wallet_id, "user_id": u["user_id"]}, {"$set": allowed})
    w = await db.wallets.find_one({"id": wallet_id, "user_id": u["user_id"]}, {"_id": 0})
    return {"wallet": w}


@api.delete("/wallets/{wallet_id}")
async def delete_wallet(wallet_id: str, authorization: Optional[str] = Header(None)):
    u = await get_user_from_token(authorization)
    await db.wallets.delete_one({"id": wallet_id, "user_id": u["user_id"]})
    await db.transactions.delete_many({"user_id": u["user_id"], "wallet_id": wallet_id})
    return {"ok": True}


# ------------------------- transactions ------------------------------
@api.get("/transactions")
async def list_transactions(
    authorization: Optional[str] = Header(None),
    limit: int = 100,
    type: Optional[str] = None,
):
    u = await get_user_from_token(authorization)
    q: Dict[str, Any] = {"user_id": u["user_id"]}
    if type in {"income", "expense", "transfer"}:
        q["type"] = type
    items = await db.transactions.find(q, {"_id": 0}).sort("date", -1).limit(limit).to_list(limit)
    return {"transactions": items}


@api.post("/transactions")
async def create_transaction(payload: TransactionIn, authorization: Optional[str] = Header(None)):
    u = await get_user_from_token(authorization)
    tx_date = payload.date or now_utc().isoformat()
    doc = {
        "id": new_id("tx"),
        "user_id": u["user_id"],
        **payload.dict(),
        "date": tx_date,
        "created_at": now_utc(),
    }
    w = await db.wallets.find_one({"id": payload.wallet_id, "user_id": u["user_id"]}, {"_id": 0})
    if not w:
        raise HTTPException(400, "Wallet not found")
    if payload.type == "income":
        await db.wallets.update_one({"id": payload.wallet_id, "user_id": u["user_id"]},
                                    {"$inc": {"balance": payload.amount}})
    elif payload.type == "expense":
        await db.wallets.update_one({"id": payload.wallet_id, "user_id": u["user_id"]},
                                    {"$inc": {"balance": -payload.amount}})
    elif payload.type == "transfer":
        if not payload.to_wallet_id:
            raise HTTPException(400, "to_wallet_id required for transfer")
        await db.wallets.update_one({"id": payload.wallet_id, "user_id": u["user_id"]},
                                    {"$inc": {"balance": -payload.amount}})
        await db.wallets.update_one({"id": payload.to_wallet_id, "user_id": u["user_id"]},
                                    {"$inc": {"balance": payload.amount}})
    await db.transactions.insert_one(doc)
    doc.pop("_id", None)
    return {"transaction": doc}


@api.patch("/transactions/{tx_id}")
async def update_transaction(tx_id: str, payload: Dict[str, Any], authorization: Optional[str] = Header(None)):
    u = await get_user_from_token(authorization)
    tx = await db.transactions.find_one({"id": tx_id, "user_id": u["user_id"]}, {"_id": 0})
    if not tx:
        raise HTTPException(404, "Not found")

    allowed = {k: v for k, v in payload.items()
               if k in {"wallet_id", "to_wallet_id", "type", "amount", "category", "note", "date"}}
    if not allowed:
        return {"transaction": tx}

    merged = {**tx, **allowed}
    if merged["type"] == "transfer" and not merged.get("to_wallet_id"):
        raise HTTPException(400, "to_wallet_id required for transfer")

    new_wallet = await db.wallets.find_one({"id": merged["wallet_id"], "user_id": u["user_id"]}, {"_id": 0})
    if not new_wallet:
        raise HTTPException(400, "Wallet not found")

    # --- reverse the old transaction's effect on wallet balances ---
    if tx["type"] == "income":
        await db.wallets.update_one({"id": tx["wallet_id"], "user_id": u["user_id"]},
                                    {"$inc": {"balance": -tx["amount"]}})
    elif tx["type"] == "expense":
        await db.wallets.update_one({"id": tx["wallet_id"], "user_id": u["user_id"]},
                                    {"$inc": {"balance": tx["amount"]}})
    elif tx["type"] == "transfer":
        await db.wallets.update_one({"id": tx["wallet_id"], "user_id": u["user_id"]},
                                    {"$inc": {"balance": tx["amount"]}})
        if tx.get("to_wallet_id"):
            await db.wallets.update_one({"id": tx["to_wallet_id"], "user_id": u["user_id"]},
                                        {"$inc": {"balance": -tx["amount"]}})

    # --- apply the updated transaction's effect on wallet balances ---
    if merged["type"] == "income":
        await db.wallets.update_one({"id": merged["wallet_id"], "user_id": u["user_id"]},
                                    {"$inc": {"balance": merged["amount"]}})
    elif merged["type"] == "expense":
        await db.wallets.update_one({"id": merged["wallet_id"], "user_id": u["user_id"]},
                                    {"$inc": {"balance": -merged["amount"]}})
    elif merged["type"] == "transfer":
        await db.wallets.update_one({"id": merged["wallet_id"], "user_id": u["user_id"]},
                                    {"$inc": {"balance": -merged["amount"]}})
        await db.wallets.update_one({"id": merged["to_wallet_id"], "user_id": u["user_id"]},
                                    {"$inc": {"balance": merged["amount"]}})

    await db.transactions.update_one({"id": tx_id, "user_id": u["user_id"]}, {"$set": allowed})
    updated = await db.transactions.find_one({"id": tx_id, "user_id": u["user_id"]}, {"_id": 0})
    return {"transaction": updated}


@api.delete("/transactions/{tx_id}")
async def delete_transaction(tx_id: str, authorization: Optional[str] = Header(None)):
    u = await get_user_from_token(authorization)
    tx = await db.transactions.find_one({"id": tx_id, "user_id": u["user_id"]}, {"_id": 0})
    if not tx:
        raise HTTPException(404, "Not found")
    if tx["type"] == "income":
        await db.wallets.update_one({"id": tx["wallet_id"], "user_id": u["user_id"]},
                                    {"$inc": {"balance": -tx["amount"]}})
    elif tx["type"] == "expense":
        await db.wallets.update_one({"id": tx["wallet_id"], "user_id": u["user_id"]},
                                    {"$inc": {"balance": tx["amount"]}})
    elif tx["type"] == "transfer":
        await db.wallets.update_one({"id": tx["wallet_id"], "user_id": u["user_id"]},
                                    {"$inc": {"balance": tx["amount"]}})
        if tx.get("to_wallet_id"):
            await db.wallets.update_one({"id": tx["to_wallet_id"], "user_id": u["user_id"]},
                                        {"$inc": {"balance": -tx["amount"]}})
    await db.transactions.delete_one({"id": tx_id, "user_id": u["user_id"]})
    return {"ok": True}


# ------------------------- budgets -----------------------------------
@api.get("/budgets")
async def list_budgets(authorization: Optional[str] = Header(None)):
    u = await get_user_from_token(authorization)
    items = await db.budgets.find({"user_id": u["user_id"]}, {"_id": 0}).to_list(100)
    month_start = now_utc().replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    spent_pipeline = [
        {"$match": {"user_id": u["user_id"], "type": "expense", "date": {"$gte": month_start}}},
        {"$group": {"_id": "$category", "total": {"$sum": {"$toDouble": "$amount"}}}},
    ]
    spent_by_cat: Dict[str, float] = {
        r["_id"]: round(r["total"], 2)
        for r in await db.transactions.aggregate(spent_pipeline).to_list(200)
    }
    for b in items:
        b["spent"] = spent_by_cat.get(b["category"], 0.0)
    return {"budgets": items}


@api.post("/budgets")
async def create_budget(payload: BudgetIn, authorization: Optional[str] = Header(None)):
    u = await get_user_from_token(authorization)
    doc = {"id": new_id("bud"), "user_id": u["user_id"], **payload.dict(), "created_at": now_utc()}
    await db.budgets.insert_one(doc)
    doc.pop("_id", None)
    return {"budget": doc}


@api.delete("/budgets/{budget_id}")
async def delete_budget(budget_id: str, authorization: Optional[str] = Header(None)):
    u = await get_user_from_token(authorization)
    await db.budgets.delete_one({"id": budget_id, "user_id": u["user_id"]})
    return {"ok": True}


def _advance_date(iso_date: str, frequency: str) -> str:
    d = datetime.fromisoformat(iso_date.replace("Z", "+00:00")) if "T" in iso_date else datetime.fromisoformat(iso_date)
    if frequency == "weekly":
        d = d + timedelta(days=7)
    elif frequency == "yearly":
        try:
            d = d.replace(year=d.year + 1)
        except ValueError:
            d = d + timedelta(days=365)
    else:  # monthly
        month = d.month + 1
        year = d.year + (1 if month > 12 else 0)
        month = 1 if month > 12 else month
        day = min(d.day, 28)  # avoid month-length overflow (safe default)
        d = d.replace(year=year, month=month, day=day)
    return d.isoformat()


# ------------------------- recurring (bills & subscriptions) ---------
@api.get("/recurring")
async def list_recurring(authorization: Optional[str] = Header(None)):
    u = await get_user_from_token(authorization)
    items = await db.recurring.find({"user_id": u["user_id"]}, {"_id": 0}).sort("next_date", 1).to_list(500)
    today = now_utc().date()
    for r in items:
        try:
            nd = datetime.fromisoformat(r["next_date"].replace("Z", "+00:00")).date()
            r["days_until"] = (nd - today).days
        except Exception:
            r["days_until"] = None
    return {"recurring": items}


@api.post("/recurring")
async def create_recurring(payload: RecurringIn, authorization: Optional[str] = Header(None)):
    u = await get_user_from_token(authorization)
    doc = {"id": new_id("rec"), "user_id": u["user_id"], **payload.dict(), "created_at": now_utc()}
    await db.recurring.insert_one(doc)
    doc.pop("_id", None)
    return {"recurring": doc}


@api.patch("/recurring/{rec_id}")
async def update_recurring(rec_id: str, body: Dict[str, Any], authorization: Optional[str] = Header(None)):
    u = await get_user_from_token(authorization)
    allowed_keys = {"name", "amount", "type", "category", "wallet_id", "frequency", "next_date", "note", "active"}
    allowed = {k: v for k, v in body.items() if k in allowed_keys}
    if allowed:
        await db.recurring.update_one({"id": rec_id, "user_id": u["user_id"]}, {"$set": allowed})
    r = await db.recurring.find_one({"id": rec_id, "user_id": u["user_id"]}, {"_id": 0})
    if not r:
        raise HTTPException(404, "Not found")
    return {"recurring": r}


@api.delete("/recurring/{rec_id}")
async def delete_recurring(rec_id: str, authorization: Optional[str] = Header(None)):
    u = await get_user_from_token(authorization)
    await db.recurring.delete_one({"id": rec_id, "user_id": u["user_id"]})
    return {"ok": True}


@api.post("/recurring/{rec_id}/mark_paid")
async def mark_recurring_paid(rec_id: str, authorization: Optional[str] = Header(None)):
    """Log the actual transaction for this cycle, update the wallet balance,
    and advance next_date to the following occurrence — all in one tap."""
    u = await get_user_from_token(authorization)
    r = await db.recurring.find_one({"id": rec_id, "user_id": u["user_id"]}, {"_id": 0})
    if not r:
        raise HTTPException(404, "Not found")

    wallet = await db.wallets.find_one({"id": r["wallet_id"], "user_id": u["user_id"]}, {"_id": 0})
    if not wallet:
        raise HTTPException(400, "Wallet not found")

    tx_doc = {
        "id": new_id("tx"), "user_id": u["user_id"], "wallet_id": r["wallet_id"],
        "to_wallet_id": None, "type": r["type"], "amount": r["amount"], "category": r["category"],
        "note": r.get("note") or f"{r['name']} (recurring)", "date": now_utc().isoformat(),
        "created_at": now_utc(),
    }
    await db.transactions.insert_one(tx_doc)
    delta = r["amount"] if r["type"] == "income" else -r["amount"]
    await db.wallets.update_one({"id": r["wallet_id"], "user_id": u["user_id"]}, {"$inc": {"balance": delta}})

    next_date = _advance_date(r["next_date"], r["frequency"])
    await db.recurring.update_one({"id": rec_id, "user_id": u["user_id"]}, {"$set": {"next_date": next_date}})
    updated = await db.recurring.find_one({"id": rec_id, "user_id": u["user_id"]}, {"_id": 0})
    return {"recurring": updated, "transaction": {k: v for k, v in tx_doc.items() if k != "_id"}}


# ------------------------- goals -------------------------------------
@api.get("/goals")
async def list_goals(authorization: Optional[str] = Header(None)):
    u = await get_user_from_token(authorization)
    items = await db.goals.find({"user_id": u["user_id"]}, {"_id": 0}).to_list(200)
    return {"goals": items}


@api.post("/goals")
async def create_goal(payload: GoalIn, authorization: Optional[str] = Header(None)):
    u = await get_user_from_token(authorization)
    doc = {"id": new_id("goal"), "user_id": u["user_id"], **payload.dict(), "created_at": now_utc()}
    await db.goals.insert_one(doc)
    doc.pop("_id", None)
    return {"goal": doc}


@api.post("/goals/{goal_id}/contribute")
async def contribute_goal(goal_id: str, body: GoalContributeIn, authorization: Optional[str] = Header(None)):
    u = await get_user_from_token(authorization)
    await db.goals.update_one({"id": goal_id, "user_id": u["user_id"]}, {"$inc": {"saved_amount": body.amount}})
    g = await db.goals.find_one({"id": goal_id, "user_id": u["user_id"]}, {"_id": 0})
    return {"goal": g}


@api.delete("/goals/{goal_id}")
async def delete_goal(goal_id: str, authorization: Optional[str] = Header(None)):
    u = await get_user_from_token(authorization)
    await db.goals.delete_one({"id": goal_id, "user_id": u["user_id"]})
    return {"ok": True}


# ------------------------- plans -------------------------------------
@api.get("/plans")
async def list_plans(authorization: Optional[str] = Header(None)):
    u = await get_user_from_token(authorization)
    items = await db.plans.find({"user_id": u["user_id"]}, {"_id": 0}).to_list(200)
    return {"plans": items}


@api.post("/plans")
async def create_plan(payload: PlanIn, authorization: Optional[str] = Header(None)):
    u = await get_user_from_token(authorization)
    doc = {
        "id": new_id("plan"),
        "user_id": u["user_id"],
        **payload.dict(),
        "items": _default_plan_items(payload.kind),
        "created_at": now_utc(),
    }
    await db.plans.insert_one(doc)
    doc.pop("_id", None)
    return {"plan": doc}


def _default_plan_items(kind: str) -> List[Dict[str, Any]]:
    templates = {
        "wedding": ["Venue", "Catering", "Photography", "Attire", "Decoration", "Music", "Invitations", "Rings"],
        "house": ["Down Payment", "Mortgage Reserve", "Furniture", "Renovation", "Appliances", "Moving"],
        "car": ["Down Payment", "Insurance", "Registration", "Accessories", "Maintenance Fund"],
        "vacation": ["Flights", "Accommodation", "Food & Dining", "Activities", "Transport", "Shopping"],
    }
    return [{"id": new_id("it"), "label": lbl, "amount": 0.0, "paid": 0.0, "done": False}
            for lbl in templates.get(kind, [])]


@api.patch("/plans/{plan_id}")
async def update_plan(plan_id: str, body: Dict[str, Any], authorization: Optional[str] = Header(None)):
    u = await get_user_from_token(authorization)
    allowed = {k: v for k, v in body.items() if k in {"name", "total_budget", "target_date", "notes", "items"}}
    await db.plans.update_one({"id": plan_id, "user_id": u["user_id"]}, {"$set": allowed})
    p = await db.plans.find_one({"id": plan_id, "user_id": u["user_id"]}, {"_id": 0})
    return {"plan": p}


@api.delete("/plans/{plan_id}")
async def delete_plan(plan_id: str, authorization: Optional[str] = Header(None)):
    u = await get_user_from_token(authorization)
    await db.plans.delete_one({"id": plan_id, "user_id": u["user_id"]})
    return {"ok": True}


# ---------------------- debts / investments / assets -----------------
@api.get("/debts")
async def list_debts(authorization: Optional[str] = Header(None)):
    u = await get_user_from_token(authorization)
    return {"debts": await db.debts.find({"user_id": u["user_id"]}, {"_id": 0}).to_list(200)}


@api.post("/debts")
async def create_debt(payload: DebtIn, authorization: Optional[str] = Header(None)):
    u = await get_user_from_token(authorization)
    doc = {"id": new_id("debt"), "user_id": u["user_id"], **payload.dict(), "created_at": now_utc()}
    await db.debts.insert_one(doc)
    doc.pop("_id", None)
    return {"debt": doc}


@api.patch("/debts/{debt_id}")
async def update_debt(debt_id: str, body: Dict[str, Any], authorization: Optional[str] = Header(None)):
    u = await get_user_from_token(authorization)
    allowed_keys = {"name", "principal", "remaining", "interest_rate", "monthly_payment", "due_day", "kind"}
    old = await db.debts.find_one({"id": debt_id, "user_id": u["user_id"]}, {"_id": 0})
    allowed = {k: v for k, v in body.items() if k in allowed_keys}
    if allowed:
        await db.debts.update_one({"id": debt_id, "user_id": u["user_id"]}, {"$set": allowed})
    d = await db.debts.find_one({"id": debt_id, "user_id": u["user_id"]}, {"_id": 0})
    if not d:
        raise HTTPException(404, "Not found")
    just_paid = old and float(old.get("remaining", 0)) > 0 and float(d.get("remaining", 0)) <= 0
    return {"debt": d, "celebrate": just_paid}


@api.delete("/debts/{debt_id}")
async def delete_debt(debt_id: str, authorization: Optional[str] = Header(None)):
    u = await get_user_from_token(authorization)
    await db.debts.delete_one({"id": debt_id, "user_id": u["user_id"]})
    return {"ok": True}


def _simulate_payoff(debts: List[Dict[str, Any]], strategy: str, extra_monthly: float) -> Dict[str, Any]:
    """Month-by-month amortization simulation. `strategy` decides which debt gets
    every extra dollar first: 'avalanche' = highest interest rate, 'snowball' =
    smallest balance. Freed-up minimum payments from paid-off debts roll into
    the next target automatically (the classic "debt snowball" mechanic)."""
    sim = [{
        "id": d["id"], "name": d["name"], "balance": float(d.get("remaining", 0.0)),
        "rate": float(d.get("interest_rate", 0.0)) / 100 / 12,  # monthly rate
        "min_payment": float(d.get("monthly_payment", 0.0)),
        "paid_off_month": None, "total_interest": 0.0,
    } for d in debts if float(d.get("remaining", 0.0)) > 0]

    if not sim:
        return {"months": 0, "total_interest": 0.0, "debt_free_date": None, "debts": []}

    order_key = (lambda x: -x["rate"]) if strategy == "avalanche" else (lambda x: x["balance"])
    month = 0
    total_interest = 0.0
    max_months = 600  # 50-year safety cap so a bad input can't loop forever

    while any(d["balance"] > 0.01 for d in sim) and month < max_months:
        month += 1
        pool = extra_monthly
        # minimum payments first (interest accrues, then principal)
        for d in sim:
            if d["balance"] <= 0.01:
                continue
            interest = d["balance"] * d["rate"]
            d["total_interest"] += interest
            total_interest += interest
            pay = min(d["min_payment"], d["balance"] + interest)
            d["balance"] = d["balance"] + interest - pay
            if d["balance"] <= 0.01:
                d["balance"] = 0.0
                d["paid_off_month"] = month
                pool += 0  # its own min payment frees up next month, handled by loop naturally

        # snowball/avalanche extra goes to the priority target this month
        active = [d for d in sim if d["balance"] > 0.01]
        active.sort(key=order_key)
        # freed minimum payments from already-paid-off debts also join the pool
        freed = sum(d["min_payment"] for d in sim if d["paid_off_month"] is not None and d["paid_off_month"] < month)
        pool += freed
        for d in active:
            if pool <= 0:
                break
            extra_pay = min(pool, d["balance"])
            d["balance"] -= extra_pay
            pool -= extra_pay
            if d["balance"] <= 0.01:
                d["balance"] = 0.0
                d["paid_off_month"] = month

    today = now_utc()
    debt_free_date = None
    if month < max_months:
        y, m = today.year, today.month + month
        while m > 12:
            m -= 12
            y += 1
        debt_free_date = f"{y:04d}-{m:02d}"

    return {
        "months": month if month < max_months else None,
        "total_interest": round(total_interest, 2),
        "debt_free_date": debt_free_date,
        "debts": [{"id": d["id"], "name": d["name"], "payoff_month": d["paid_off_month"],
                   "interest_paid": round(d["total_interest"], 2)} for d in sim],
    }


@api.get("/debts/payoff-plan")
async def debts_payoff_plan(extra_monthly: float = 0.0, authorization: Optional[str] = Header(None)):
    u = await get_user_from_token(authorization)
    debts = await db.debts.find({"user_id": u["user_id"]}, {"_id": 0}).to_list(200)
    if not debts:
        return {"avalanche": None, "snowball": None, "has_debts": False}
    avalanche = _simulate_payoff(debts, "avalanche", extra_monthly)
    snowball = _simulate_payoff(debts, "snowball", extra_monthly)
    return {
        "avalanche": avalanche,
        "snowball": snowball,
        "has_debts": True,
        "interest_saved_with_avalanche": round(snowball["total_interest"] - avalanche["total_interest"], 2),
    }


@api.get("/investments")
async def list_investments(authorization: Optional[str] = Header(None)):
    u = await get_user_from_token(authorization)
    return {"investments": await db.investments.find({"user_id": u["user_id"]}, {"_id": 0}).to_list(200)}


@api.post("/investments")
async def create_investment(payload: InvestmentIn, authorization: Optional[str] = Header(None)):
    u = await get_user_from_token(authorization)
    doc = {"id": new_id("inv"), "user_id": u["user_id"], **payload.dict(), "created_at": now_utc()}
    await db.investments.insert_one(doc)
    doc.pop("_id", None)
    return {"investment": doc}


@api.patch("/investments/{inv_id}")
async def update_investment(inv_id: str, body: Dict[str, Any], authorization: Optional[str] = Header(None)):
    u = await get_user_from_token(authorization)
    allowed_keys = {"name", "ticker", "kind", "quantity", "avg_cost", "current_price",
                    "face_value", "coupon_rate", "purchase_price", "current_value",
                    "broker", "purchase_date", "notes"}
    allowed = {k: v for k, v in body.items() if k in allowed_keys}
    if allowed:
        await db.investments.update_one({"id": inv_id, "user_id": u["user_id"]}, {"$set": allowed})
    inv = await db.investments.find_one({"id": inv_id, "user_id": u["user_id"]}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Not found")
    return {"investment": inv}


@api.delete("/investments/{inv_id}")
async def delete_investment(inv_id: str, authorization: Optional[str] = Header(None)):
    u = await get_user_from_token(authorization)
    await db.investments.delete_one({"id": inv_id, "user_id": u["user_id"]})
    return {"ok": True}


@api.get("/assets")
async def list_assets(authorization: Optional[str] = Header(None)):
    u = await get_user_from_token(authorization)
    return {"assets": await db.assets.find({"user_id": u["user_id"]}, {"_id": 0}).to_list(200)}


@api.post("/assets")
async def create_asset(payload: AssetIn, authorization: Optional[str] = Header(None)):
    u = await get_user_from_token(authorization)
    doc = {"id": new_id("as"), "user_id": u["user_id"], **payload.dict(), "created_at": now_utc()}
    await db.assets.insert_one(doc)
    doc.pop("_id", None)
    return {"asset": doc}


@api.delete("/assets/{asset_id}")
async def delete_asset(asset_id: str, authorization: Optional[str] = Header(None)):
    u = await get_user_from_token(authorization)
    await db.assets.delete_one({"id": asset_id, "user_id": u["user_id"]})
    return {"ok": True}


# ------------------------- analytics ---------------------------------
def _lerp_clamp(x: float, x0: float, y0: float, x1: float, y1: float) -> float:
    """Linearly interpolate y for x between (x0,y0) and (x1,y1), clamped to that range."""
    if x1 == x0:
        return y0
    t = (x - x0) / (x1 - x0)
    t = max(0.0, min(1.0, t))
    return y0 + t * (y1 - y0)


def _savings_subscore(saving_rate: float) -> float:
    """0 at -50% saving rate, 50 at breakeven, 100 at +30% or better."""
    if saving_rate <= 0:
        return _lerp_clamp(saving_rate, -50, 0, 0, 50)
    return _lerp_clamp(saving_rate, 0, 50, 30, 100)


def _debt_subscore(debt_ratio: float) -> float:
    """100 with no debt, 50 at a 50% debt ratio, 0 at 100%+."""
    if debt_ratio <= 50:
        return _lerp_clamp(debt_ratio, 0, 100, 50, 50)
    return _lerp_clamp(debt_ratio, 50, 50, 100, 0)


def _diversification_subscore(inv_total: float, wallet_total: float, asset_total: float) -> float:
    """Rewards holding some of net worth in investments; full score once ~20%+ is invested."""
    denom = max(wallet_total + inv_total + asset_total, 1.0)
    share_pct = (inv_total / denom) * 100
    return _lerp_clamp(share_pct, 0, 0, 20, 100)


def _liquidity_subscore(wallet_total: float, month_expense: float) -> float:
    """Based on how many months of expenses your liquid balance could cover."""
    if month_expense <= 0:
        return 100.0 if wallet_total > 0 else 50.0
    runway_months = wallet_total / month_expense
    return _lerp_clamp(runway_months, 0, 0, 6, 100)


@api.get("/analytics/summary")
async def analytics_summary(authorization: Optional[str] = Header(None)):
    u = await get_user_from_token(authorization)
    uid = u["user_id"]
    home_ccy = u.get("currency", "USD")

    wallets, debts, investments, assets = await asyncio.gather(
        db.wallets.find({"user_id": uid}, {"_id": 0, "balance": 1, "currency": 1}).to_list(100),
        db.debts.find({"user_id": uid}, {"_id": 0, "remaining": 1}).to_list(100),
        db.investments.find({"user_id": uid}, {"_id": 0, "quantity": 1, "current_price": 1}).to_list(100),
        db.assets.find({"user_id": uid}, {"_id": 0, "value": 1}).to_list(100),
    )

    wallet_total = 0.0
    for w in wallets:
        wallet_total += await convert_amount(float(w.get("balance", 0.0)), w.get("currency", home_ccy), home_ccy)
    debt_total = sum(float(d.get("remaining", 0.0)) for d in debts)
    inv_total = sum(float(i.get("quantity", 0.0)) * float(i.get("current_price", 0.0)) for i in investments)
    asset_total = sum(float(a.get("value", 0.0)) for a in assets)
    net_worth = wallet_total + inv_total + asset_total - debt_total

    month_start_dt = now_utc().replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # --- Single aggregation: monthly income/expense for last 6 months + current + trailing ---
    six_months_ago = month_start_dt - timedelta(days=180)
    pipeline = [
        {"$match": {"user_id": uid, "date": {"$gte": six_months_ago.isoformat()}}},
        {"$addFields": {
            "month_key": {"$substr": ["$date", 0, 7]},
            "month_label": {"$substr": ["$date", 5, 3]},
        }},
        {"$group": {
            "_id": {"month": "$month_key", "label": "$month_label", "type": "$type"},
            "total": {"$sum": {"$toDouble": "$amount"}},
        }},
        {"$sort": {"_id.month": 1}},
    ]
    agg = await db.transactions.aggregate(pipeline).to_list(200)

    # Build trend + category + trailing from agg + a single expense query
    month_map: Dict[str, dict] = {}
    income_total = 0.0
    expense_total = 0.0
    cat_totals: Dict[str, float] = {}
    cat_trailing: Dict[str, list] = {}

    for row in agg:
        mk = row["_id"]["month"]
        lbl = row["_id"]["label"]
        typ = row["_id"]["type"]
        amt = round(row["total"], 2)
        if mk not in month_map:
            month_map[mk] = {"month": lbl, "income": 0.0, "expense": 0.0}
        if typ == "income":
            month_map[mk]["income"] += amt
        else:
            month_map[mk]["expense"] += amt

        if mk == month_start_dt.strftime("%Y-%m"):
            income_total += amt if typ == "income" else 0
            expense_total += amt if typ == "expense" else 0
            if typ == "expense":
                cat_totals[row.get("category", "Other")] = cat_totals.get(row.get("category", "Other"), 0.0) + amt
        else:
            if typ == "expense":
                cat_trailing.setdefault(row.get("category", "Other"), []).append(amt)

    trend = [v for k, v in sorted(month_map.items())][-6:]

    cash_flow = income_total - expense_total
    raw_saving_rate = (cash_flow / income_total * 100) if income_total > 0 else (-100.0 if expense_total > 0 else 0.0)
    saving_rate = round(max(-100.0, min(100.0, raw_saving_rate)), 1)
    debt_ratio = round((debt_total / (wallet_total + inv_total + asset_total) * 100)
                       if (wallet_total + inv_total + asset_total) > 0 else 0.0, 1)

    score_breakdown = {
        "savings": round(_savings_subscore(saving_rate), 1),
        "debt": round(_debt_subscore(debt_ratio), 1),
        "diversification": round(_diversification_subscore(inv_total, wallet_total, asset_total), 1),
        "liquidity": round(_liquidity_subscore(wallet_total, expense_total), 1),
    }
    score = round(
        score_breakdown["savings"] * 0.40
        + score_breakdown["debt"] * 0.25
        + score_breakdown["diversification"] * 0.15
        + score_breakdown["liquidity"] * 0.20
    )
    score = max(0, min(100, score))

    category_breakdown = sorted(
        [{"category": k, "amount": round(v, 2)} for k, v in cat_totals.items()],
        key=lambda x: -x["amount"],
    )

    trailing_avg = {k: round(sum(v) / len(v), 2) for k, v in cat_trailing.items()}
    spending_alerts = sorted([
        {"category": k, "current": cat_totals[k], "average": avg,
         "pct_over": round((cat_totals[k] / avg - 1) * 100) if avg > 0 else 0}
        for k, v in cat_totals.items()
        if (avg := trailing_avg.get(k, 0.0)) >= 1.0 and v > avg * 1.3
    ], key=lambda a: -a["pct_over"])

    return {
        "net_worth": round(net_worth, 2),
        "wallet_total": round(wallet_total, 2),
        "debt_total": round(debt_total, 2),
        "investment_total": round(inv_total, 2),
        "asset_total": round(asset_total, 2),
        "month_income": round(income_total, 2),
        "month_expense": round(expense_total, 2),
        "cash_flow": round(cash_flow, 2),
        "saving_rate": saving_rate,
        "debt_ratio": debt_ratio,
        "health_score": score,
        "health_breakdown": score_breakdown,
        "spending_alerts": spending_alerts,
        "category_breakdown": category_breakdown,
        "trend": trend,
        "counts": {
            "wallets": len(wallets),
            "debts": len(debts),
            "investments": len(investments),
            "assets": len(assets),
        },
    }


# ---------------------------- AI coach ------------
async def _coach_context(authorization: Optional[str]) -> str:
    """Lightweight context for the AI coach — avoids the full analytics pipeline."""
    try:
        u = await get_user_from_token(authorization)
        uid = u["user_id"]
        cur = u.get("currency", "USD")
        wallets = await db.wallets.find({"user_id": uid}, {"_id": 0, "balance": 1, "currency": 1}).to_list(50)
        debts = await db.debts.find({"user_id": uid}, {"_id": 0, "remaining": 1}).to_list(50)
        wallet_total = 0.0
        for w in wallets:
            wallet_total += await convert_amount(float(w.get("balance", 0.0)), w.get("currency", cur), cur)
        debt_total = sum(float(d.get("remaining", 0.0)) for d in debts)
        month_start = now_utc().replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
        inc_exp = await db.transactions.aggregate([
            {"$match": {"user_id": uid, "date": {"$gte": month_start}}},
            {"$group": {"_id": "$type", "total": {"$sum": {"$toDouble": "$amount"}}}},
        ]).to_list(10)
        income = next((r["total"] for r in inc_exp if r["_id"] == "income"), 0.0)
        expense = next((r["total"] for r in inc_exp if r["_id"] == "expense"), 0.0)
        sr = round((income - expense) / income * 100, 1) if income > 0 else 0.0
        return (f"[USER CONTEXT] name={u.get('name')} currency={cur} "
                f"net_worth={round(wallet_total - debt_total, 2)} "
                f"month_income={round(income, 2)} month_expense={round(expense, 2)} "
                f"saving_rate={sr}%")
    except Exception:
        return ""

COACH_SYSTEM = (
    "You are Matrix Finance Coach, a warm, concise, and expert personal finance advisor. "
    "Give practical, numbers-first advice. Keep answers short (3-6 sentences) unless the user asks for detail. "
    "Prefer bullet points. Never give tax or legal advice as authoritative; suggest professionals for complex cases. "
    "If asked for investment specifics, remind the user of risk and diversification. Be encouraging."
)


@api.post("/coach/chat")
async def coach_chat(payload: ChatIn, authorization: Optional[str] = Header(None)):
    u = await get_user_from_token(authorization)
    if not GROQ_API_KEY:
        raise HTTPException(500, "Groq API key not configured")

    await db.chat_messages.insert_one({
        "id": new_id("msg"), "user_id": u["user_id"], "session_id": payload.session_id,
        "role": "user", "text": payload.message, "created_at": now_utc(),
    })

    try:
        ctx = await _coach_context(authorization)
    except Exception:
        ctx = ""

    system_msg = COACH_SYSTEM + ("\n" + ctx if ctx else "")

    async def gen():
        acc = ""
        try:
            async with httpx.AsyncClient(timeout=60.0) as hc:
                async with hc.stream(
                    "POST",
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {GROQ_API_KEY}",
                        "content-type": "application/json",
                    },
                    json={
                        "model": "llama-3.3-70b-versatile",
                        "max_tokens": 1024,
                        "stream": True,
                        "messages": [
                            {"role": "system", "content": system_msg},
                            {"role": "user", "content": payload.message},
                        ],
                    },
                ) as resp:
                    if resp.status_code != 200:
                        err_body = await resp.aread()
                        raise RuntimeError(f"Groq API error {resp.status_code}: {err_body.decode(errors='ignore')[:300]}")
                    async for line in resp.aiter_lines():
                        if line.startswith("data: "):
                            data = line[6:]
                            if data == "[DONE]":
                                break
                            try:
                                ev = _json.loads(data)
                                delta = ev["choices"][0]["delta"].get("content", "")
                                if delta:
                                    acc += delta
                                    yield f"data: {_json.dumps({'delta': delta})}\n\n"
                            except Exception:
                                pass
        except Exception as e:
            log.exception("coach stream error")
            yield f"data: {_json.dumps({'error': str(e)})}\n\n"

        try:
            await db.chat_messages.insert_one({
                "id": new_id("msg"), "user_id": u["user_id"], "session_id": payload.session_id,
                "role": "assistant", "text": acc, "created_at": now_utc(),
            })
        except Exception:
            pass
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


@api.get("/coach/history")
async def coach_history(session_id: str, authorization: Optional[str] = Header(None)):
    u = await get_user_from_token(authorization)
    msgs = await db.chat_messages.find(
        {"user_id": u["user_id"], "session_id": session_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(500)
    return {"messages": msgs}


# --------------------------- seed helper -----------------------------
async def seed_starter_data(user_id: str):
    wallets = [
        {"id": new_id("wal"), "user_id": user_id, "name": "Cash", "type": "cash",
         "balance": 250.0, "currency": "USD", "color": "#10B981", "icon": "wallet", "created_at": now_utc()},
        {"id": new_id("wal"), "user_id": user_id, "name": "Main Bank", "type": "bank",
         "balance": 3200.0, "currency": "USD", "color": "#18181B", "icon": "bank", "created_at": now_utc()},
    ]
    await db.wallets.insert_many(wallets)
    budgets = [
        {"category": "Food", "amount": 400, "icon": "utensils", "color": "#10B981"},
        {"category": "Transport", "amount": 150, "icon": "car", "color": "#F59E0B"},
        {"category": "Shopping", "amount": 200, "icon": "shopping-bag", "color": "#EF4444"},
        {"category": "Entertainment", "amount": 100, "icon": "film", "color": "#34D399"},
    ]
    await db.budgets.insert_many([{"id": new_id("bud"), "user_id": user_id, "period": "monthly",
                                   **b, "created_at": now_utc()} for b in budgets])


# --------------------------- indexes ---------------------------------
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.token_blacklist.create_index("jti", unique=True)
    await db.token_blacklist.create_index("expires_at", expireAfterSeconds=0)
    for coll in ("wallets", "transactions", "budgets", "goals", "plans",
                 "debts", "investments", "assets", "chat_messages", "recurring"):
        await db[coll].create_index("user_id")
    log.info("Matrix Finance backend ready")


@app.on_event("shutdown")
async def shutdown():
    client.close()


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[
        "https://victorious-enthusiasm-production.up.railway.app",
        "http://localhost:8081",
        "http://localhost:8001",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
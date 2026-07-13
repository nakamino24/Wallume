"""
Matrix Finance — backend
FastAPI + MongoDB (motor). All routes prefixed with /api.
Dual auth: JWT email/password + Emergent-managed Google OAuth.
"""
from fastapi import FastAPI, APIRouter, HTTPException, Header, Request
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal, Any, Dict
from datetime import datetime, timezone, timedelta
from pathlib import Path
import os
import uuid
import logging
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
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
log = logging.getLogger("matrix-finance")


# ----------------------------- helpers ------------------------------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def new_id(prefix: str = "id") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:16]}"


def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def issue_jwt(user_id: str) -> str:
    payload = {"sub": user_id, "iat": int(now_utc().timestamp()),
               "exp": int((now_utc() + timedelta(days=30)).timestamp())}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


async def get_user_from_token(authorization: Optional[str]) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing bearer token")
    token = authorization.split(" ", 1)[1]
    # try JWT first
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
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
    kind: Literal["stock", "crypto", "gold", "mutual_fund", "etf", "bond", "other"] = "stock"
    quantity: float = 0.0
    avg_cost: float = 0.0
    current_price: float = 0.0


class AssetIn(BaseModel):
    name: str
    value: float
    kind: Literal["real_estate", "vehicle", "gadget", "cash", "receivable", "other"] = "other"


class ChatIn(BaseModel):
    session_id: str
    message: str


# ------------------------------ health --------------------------------
@api.get("/")
async def root():
    return {"app": "Matrix Finance", "status": "ok"}


# ------------------------------ auth ---------------------------------
@api.post("/auth/signup")
async def signup(payload: SignupIn):
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
async def login(payload: LoginIn):
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


def _clean_user(u: Dict[str, Any]) -> Dict[str, Any]:
    return {k: v for k, v in u.items() if k not in {"_id", "password_hash"}}


# ---------------------------- wallets --------------------------------
@api.get("/wallets")
async def list_wallets(authorization: Optional[str] = Header(None)):
    u = await get_user_from_token(authorization)
    items = await db.wallets.find({"user_id": u["user_id"]}, {"_id": 0}).sort("created_at", 1).to_list(500)
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
    items = await db.budgets.find({"user_id": u["user_id"]}, {"_id": 0}).to_list(200)
    month_start = now_utc().replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    txs = await db.transactions.find(
        {"user_id": u["user_id"], "type": "expense", "date": {"$gte": month_start}},
        {"_id": 0, "category": 1, "amount": 1},
    ).to_list(5000)
    spent_by_cat: Dict[str, float] = {}
    for t in txs:
        spent_by_cat[t["category"]] = spent_by_cat.get(t["category"], 0.0) + float(t["amount"])
    for b in items:
        b["spent"] = round(spent_by_cat.get(b["category"], 0.0), 2)
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


@api.delete("/debts/{debt_id}")
async def delete_debt(debt_id: str, authorization: Optional[str] = Header(None)):
    u = await get_user_from_token(authorization)
    await db.debts.delete_one({"id": debt_id, "user_id": u["user_id"]})
    return {"ok": True}


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
@api.get("/analytics/summary")
async def analytics_summary(authorization: Optional[str] = Header(None)):
    u = await get_user_from_token(authorization)
    uid = u["user_id"]

    wallets = await db.wallets.find({"user_id": uid}, {"_id": 0}).to_list(500)
    debts = await db.debts.find({"user_id": uid}, {"_id": 0}).to_list(500)
    investments = await db.investments.find({"user_id": uid}, {"_id": 0}).to_list(500)
    assets = await db.assets.find({"user_id": uid}, {"_id": 0}).to_list(500)

    wallet_total = sum(float(w.get("balance", 0.0)) for w in wallets)
    debt_total = sum(float(d.get("remaining", 0.0)) for d in debts)
    inv_total = sum(float(i.get("quantity", 0.0)) * float(i.get("current_price", 0.0)) for i in investments)
    asset_total = sum(float(a.get("value", 0.0)) for a in assets)
    net_worth = wallet_total + inv_total + asset_total - debt_total

    month_start = now_utc().replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    month_txs = await db.transactions.find(
        {"user_id": uid, "date": {"$gte": month_start}},
        {"_id": 0, "type": 1, "amount": 1, "category": 1, "date": 1},
    ).to_list(10000)
    income = sum(float(t["amount"]) for t in month_txs if t["type"] == "income")
    expense = sum(float(t["amount"]) for t in month_txs if t["type"] == "expense")
    cash_flow = income - expense
    saving_rate = round((cash_flow / income * 100) if income > 0 else 0.0, 1)
    debt_ratio = round((debt_total / (wallet_total + inv_total + asset_total) * 100)
                       if (wallet_total + inv_total + asset_total) > 0 else 0.0, 1)

    score = 50
    if saving_rate >= 20: score += 25
    elif saving_rate >= 10: score += 15
    elif saving_rate > 0: score += 5
    else: score -= 10
    if debt_ratio < 20: score += 15
    elif debt_ratio < 40: score += 5
    else: score -= 10
    if inv_total > 0: score += 5
    if len(assets) > 0: score += 5
    score = max(0, min(100, score))

    cat: Dict[str, float] = {}
    for t in month_txs:
        if t["type"] == "expense":
            cat[t["category"]] = cat.get(t["category"], 0.0) + float(t["amount"])
    category_breakdown = [{"category": k, "amount": round(v, 2)} for k, v in
                          sorted(cat.items(), key=lambda x: -x[1])]

    trend = []
    for i in range(5, -1, -1):
        d = now_utc().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        y, m = d.year, d.month - i
        while m <= 0:
            m += 12
            y -= 1
        start = datetime(y, m, 1, tzinfo=timezone.utc)
        ny, nm = (y + 1, 1) if m == 12 else (y, m + 1)
        end = datetime(ny, nm, 1, tzinfo=timezone.utc)
        txs = await db.transactions.find(
            {"user_id": uid, "date": {"$gte": start.isoformat(), "$lt": end.isoformat()}},
            {"_id": 0, "type": 1, "amount": 1},
        ).to_list(20000)
        inc = sum(float(t["amount"]) for t in txs if t["type"] == "income")
        exp = sum(float(t["amount"]) for t in txs if t["type"] == "expense")
        trend.append({"month": start.strftime("%b"), "income": round(inc, 2), "expense": round(exp, 2)})

    return {
        "net_worth": round(net_worth, 2),
        "wallet_total": round(wallet_total, 2),
        "debt_total": round(debt_total, 2),
        "investment_total": round(inv_total, 2),
        "asset_total": round(asset_total, 2),
        "month_income": round(income, 2),
        "month_expense": round(expense, 2),
        "cash_flow": round(cash_flow, 2),
        "saving_rate": saving_rate,
        "debt_ratio": debt_ratio,
        "health_score": score,
        "category_breakdown": category_breakdown,
        "trend": trend,
        "counts": {
            "wallets": len(wallets),
            "debts": len(debts),
            "investments": len(investments),
            "assets": len(assets),
        },
    }


# ---------------------------- AI coach (Anthropic direct) ------------
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
        ctx_resp = await analytics_summary(authorization)
        ctx = (f"[USER CONTEXT] name={u.get('name')} currency={u.get('currency','USD')} "
               f"net_worth={ctx_resp['net_worth']} month_income={ctx_resp['month_income']} "
               f"month_expense={ctx_resp['month_expense']} saving_rate={ctx_resp['saving_rate']}% "
               f"debt_ratio={ctx_resp['debt_ratio']}% health_score={ctx_resp['health_score']}")
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
    for coll in ("wallets", "transactions", "budgets", "goals", "plans",
                 "debts", "investments", "assets", "chat_messages"):
        await db[coll].create_index("user_id")
    log.info("Matrix Finance backend ready")


@app.on_event("shutdown")
async def shutdown():
    client.close()


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
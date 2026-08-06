from __future__ import annotations

from typing import Any, Optional
from fastapi import APIRouter, Header, HTTPException
from app.schemas.models import BudgetCreate, GoalCreate, GoalContribute, PlanCreate, CategoryCreate, CategoryUpdate
from app.schemas.models import DebtCreate, InvestmentCreate, AssetCreate, RecurringCreate
from app.repositories.repos import (
    BudgetRepository, GoalRepository, PlanRepository,
    DebtRepository, InvestmentRepository, AssetRepository,
    RecurringRepository, WalletRepository, TransactionRepository,
    CategoryRepository,
)
from app.services.auth_service import AuthService
from app.services.domain_services import DebtService, FxService
from app.utils.helpers import new_id, now_utc, advance_date

auth_service = AuthService()

# --- Budgets ---
budgets_router = APIRouter(prefix="/budgets")
budgets_repo = BudgetRepository()
tx_repo = TransactionRepository()


@budgets_router.get("")
async def list_budgets(authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    home_ccy = u.get("currency", "USD")
    items = await budgets_repo.find_by_user(u["user_id"])
    month_start = now_utc().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_key = month_start.strftime("%Y-%m-%d")
    pipeline = [
        {"$match": {
            "user_id": u["user_id"],
            "type": "expense",
            # Compare the date-prefix (YYYY-MM-DD) so both full-ISO and
            # date-only stored transaction dates are matched correctly.
            "$expr": {"$gte": [{"$substr": ["$date", 0, 10]}, month_key]},
        }},
        {"$group": {"_id": "$category", "total": {"$sum": {"$toDouble": "$amount"}}}},
    ]
    spent = {r["_id"]: round(r["total"], 2) for r in await tx_repo.aggregate(pipeline)}
    for b in items:
        b["spent"] = spent.get(b["category"], 0.0)
    await FxService.convert_items(items, home_ccy, ["amount", "spent"])
    return {"success": True, "data": {"budgets": items}}


@budgets_router.post("")
async def create_budget(payload: BudgetCreate, authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    doc = {"id": new_id("bud"), "user_id": u["user_id"], "currency": payload.currency or u.get("currency", "USD"),
           **payload.model_dump(exclude={"currency"}), "created_at": now_utc()}
    await budgets_repo.insert_one(doc)
    return {"success": True, "data": {"budget": {k: v for k, v in doc.items() if k != "_id"}}}


@budgets_router.delete("/{budget_id}")
async def delete_budget(budget_id: str, authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    await budgets_repo.delete_one({"id": budget_id, "user_id": u["user_id"]})
    return {"success": True, "data": None}


# --- Goals ---
goals_router = APIRouter(prefix="/goals")
goals_repo = GoalRepository()


@goals_router.get("")
async def list_goals(authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    items = await goals_repo.find_by_user(u["user_id"])
    await FxService.convert_items(items, u.get("currency", "USD"), ["saved_amount", "target_amount"])
    return {"success": True, "data": {"goals": items}}


@goals_router.post("")
async def create_goal(payload: GoalCreate, authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    doc = {"id": new_id("goal"), "user_id": u["user_id"], "currency": payload.currency or u.get("currency", "USD"),
           **payload.model_dump(exclude={"currency"}), "created_at": now_utc()}
    await goals_repo.insert_one(doc)
    return {"success": True, "data": {"goal": {k: v for k, v in doc.items() if k != "_id"}}}


@goals_router.post("/{goal_id}/contribute")
async def contribute_goal(goal_id: str, body: GoalContribute, authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    await goals_repo.update_one({"id": goal_id, "user_id": u["user_id"]}, {"$inc": {"saved_amount": body.amount}})
    g = await goals_repo.find_one({"id": goal_id, "user_id": u["user_id"]})
    return {"success": True, "data": {"goal": g}}


@goals_router.delete("/{goal_id}")
async def delete_goal(goal_id: str, authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    await goals_repo.delete_one({"id": goal_id, "user_id": u["user_id"]})
    return {"success": True, "data": None}


# --- Plans ---
plans_router = APIRouter(prefix="/plans")
plans_repo = PlanRepository()

_PLAN_TEMPLATES = {
    "wedding": ["Venue", "Catering", "Photography", "Attire", "Decoration", "Music", "Invitations", "Rings"],
    "house": ["Down Payment", "Mortgage Reserve", "Furniture", "Renovation", "Appliances", "Moving"],
    "car": ["Down Payment", "Insurance", "Registration", "Accessories", "Maintenance Fund"],
    "vacation": ["Flights", "Accommodation", "Food & Dining", "Activities", "Transport", "Shopping"],
}


@plans_router.get("")
async def list_plans(authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    home_ccy = u.get("currency", "USD")
    items = await plans_repo.find_by_user(u["user_id"])
    for p in items:
        await FxService.convert_item(p, home_ccy, ["total_budget"])
        p_ccy = p.get("currency") or home_ccy
        for it in p.get("items", []):
            it["currency"] = p_ccy
            await FxService.convert_item(it, home_ccy, ["amount", "paid"])
    return {"success": True, "data": {"plans": items}}


@plans_router.post("")
async def create_plan(payload: PlanCreate, authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    items = [{"id": new_id("it"), "label": lbl, "amount": 0.0, "paid": 0.0, "done": False}
             for lbl in _PLAN_TEMPLATES.get(payload.kind, [])]
    doc = {"id": new_id("plan"), "user_id": u["user_id"], "currency": payload.currency or u.get("currency", "USD"),
           **payload.model_dump(exclude={"currency"}), "items": items, "created_at": now_utc()}
    await plans_repo.insert_one(doc)
    return {"success": True, "data": {"plan": {k: v for k, v in doc.items() if k != "_id"}}}


@plans_router.patch("/{plan_id}")
async def update_plan(plan_id: str, body: dict[str, Any], authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    allowed = {k: v for k, v in body.items() if k in {"name", "total_budget", "target_date", "notes", "items"}}
    await plans_repo.update_one({"id": plan_id, "user_id": u["user_id"]}, {"$set": allowed})
    p = await plans_repo.find_one({"id": plan_id, "user_id": u["user_id"]})
    return {"success": True, "data": {"plan": p}}


@plans_router.delete("/{plan_id}")
async def delete_plan(plan_id: str, authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    await plans_repo.delete_one({"id": plan_id, "user_id": u["user_id"]})
    return {"success": True, "data": None}


# --- Debts ---
debts_router = APIRouter(prefix="/debts")
debts_repo = DebtRepository()
wallets_repo = WalletRepository()


@debts_router.get("")
async def list_debts(authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    items = await debts_repo.find_by_user(u["user_id"])
    await FxService.convert_items(items, u.get("currency", "USD"), ["remaining", "principal"])
    return {"success": True, "data": {"debts": items}}


@debts_router.post("")
async def create_debt(payload: DebtCreate, authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    doc = {"id": new_id("debt"), "user_id": u["user_id"], "currency": payload.currency or u.get("currency", "USD"),
           **payload.model_dump(exclude={"currency"}), "created_at": now_utc()}
    await debts_repo.insert_one(doc)
    return {"success": True, "data": {"debt": {k: v for k, v in doc.items() if k != "_id"}}}


@debts_router.patch("/{debt_id}")
async def update_debt(debt_id: str, body: dict[str, Any], authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    allowed_keys = {"name", "principal", "remaining", "interest_rate", "monthly_payment", "due_day", "kind"}
    old = await debts_repo.find_one({"id": debt_id, "user_id": u["user_id"]})
    allowed = {k: v for k, v in body.items() if k in allowed_keys}
    if allowed:
        await debts_repo.update_one({"id": debt_id, "user_id": u["user_id"]}, {"$set": allowed})
    d = await debts_repo.find_one({"id": debt_id, "user_id": u["user_id"]})
    if not d:
        raise HTTPException(404, "Not found")
    just_paid = old and float(old.get("remaining", 0)) > 0 and float(d.get("remaining", 0)) <= 0
    return {"success": True, "data": {"debt": d, "celebrate": just_paid}}


@debts_router.delete("/{debt_id}")
async def delete_debt(debt_id: str, authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    await debts_repo.delete_one({"id": debt_id, "user_id": u["user_id"]})
    return {"success": True, "data": None}


@debts_router.get("/payoff-plan")
async def debts_payoff_plan(extra_monthly: float = 0.0, authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    home_ccy = u.get("currency", "USD")
    debts = await debts_repo.find_by_user(u["user_id"])
    svc = DebtService()
    if not debts:
        return {"success": True, "data": {"avalanche": None, "snowball": None, "has_debts": False}}
    # Convert each debt into the user's home currency so the simulation's
    # interest/balance figures are all in the displayed currency.
    await FxService.convert_items(debts, home_ccy, ["remaining", "principal", "monthly_payment"])
    for d in debts:
        d["remaining"] = d.get("converted_remaining", d.get("remaining"))
        d["principal"] = d.get("converted_principal", d.get("principal"))
        d["monthly_payment"] = d.get("converted_monthly_payment", d.get("monthly_payment"))
    avalanche = svc.simulate_payoff(debts, "avalanche", extra_monthly)
    snowball = svc.simulate_payoff(debts, "snowball", extra_monthly)
    return {
        "success": True,
        "data": {
            "avalanche": avalanche,
            "snowball": snowball,
            "has_debts": True,
            "interest_saved_with_avalanche": round(snowball["total_interest"] - avalanche["total_interest"], 2),
        },
    }


# --- Investments ---
investments_router = APIRouter(prefix="/investments")
investments_repo = InvestmentRepository()


@investments_router.get("")
async def list_investments(authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    items = await investments_repo.find_by_user(u["user_id"])
    await FxService.convert_items(items, u.get("currency", "USD"), ["avg_cost", "current_price"])
    return {"success": True, "data": {"investments": items}}


@investments_router.post("")
async def create_investment(payload: InvestmentCreate, authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    doc = {"id": new_id("inv"), "user_id": u["user_id"], "currency": payload.currency or u.get("currency", "USD"),
           **payload.model_dump(exclude={"currency"}), "created_at": now_utc()}
    await investments_repo.insert_one(doc)
    return {"success": True, "data": {"investment": {k: v for k, v in doc.items() if k != "_id"}}}


@investments_router.patch("/{inv_id}")
async def update_investment(inv_id: str, body: dict[str, Any], authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    allowed_keys = {"name", "ticker", "kind", "quantity", "avg_cost", "current_price",
                    "face_value", "coupon_rate", "purchase_price", "current_value",
                    "broker", "purchase_date", "notes"}
    allowed = {k: v for k, v in body.items() if k in allowed_keys}
    if allowed:
        await investments_repo.update_one({"id": inv_id, "user_id": u["user_id"]}, {"$set": allowed})
    inv = await investments_repo.find_one({"id": inv_id, "user_id": u["user_id"]})
    if not inv:
        raise HTTPException(404, "Not found")
    return {"success": True, "data": {"investment": inv}}


@investments_router.delete("/{inv_id}")
async def delete_investment(inv_id: str, authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    await investments_repo.delete_one({"id": inv_id, "user_id": u["user_id"]})
    return {"success": True, "data": None}


# --- Assets ---
assets_router = APIRouter(prefix="/assets")
assets_repo = AssetRepository()


@assets_router.get("")
async def list_assets(authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    items = await assets_repo.find_by_user(u["user_id"])
    await FxService.convert_items(items, u.get("currency", "USD"), ["value"])
    return {"success": True, "data": {"assets": items}}


@assets_router.post("")
async def create_asset(payload: AssetCreate, authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    doc = {"id": new_id("as"), "user_id": u["user_id"], "currency": payload.currency or u.get("currency", "USD"),
           **payload.model_dump(exclude={"currency"}), "created_at": now_utc()}
    await assets_repo.insert_one(doc)
    return {"success": True, "data": {"asset": {k: v for k, v in doc.items() if k != "_id"}}}


@assets_router.delete("/{asset_id}")
async def delete_asset(asset_id: str, authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    await assets_repo.delete_one({"id": asset_id, "user_id": u["user_id"]})
    return {"success": True, "data": None}


# --- Recurring ---
recurring_router = APIRouter(prefix="/recurring")
recurring_repo = RecurringRepository()


@recurring_router.get("")
async def list_recurring(authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    items = await recurring_repo.find_by_user(u["user_id"])
    await FxService.convert_items(items, u.get("currency", "USD"), ["amount"])
    today = now_utc().date()
    for r in items:
        try:
            nd = now_utc().fromisoformat(r["next_date"].replace("Z", "+00:00")).date()
            r["days_until"] = (nd - today).days
        except Exception:
            r["days_until"] = None
    return {"success": True, "data": {"recurring": items}}


@recurring_router.post("")
async def create_recurring(payload: RecurringCreate, authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    doc = {"id": new_id("rec"), "user_id": u["user_id"], "currency": payload.currency or u.get("currency", "USD"),
           **payload.model_dump(exclude={"currency"}), "created_at": now_utc()}
    await recurring_repo.insert_one(doc)
    return {"success": True, "data": {"recurring": {k: v for k, v in doc.items() if k != "_id"}}}


@recurring_router.patch("/{rec_id}")
async def update_recurring(rec_id: str, body: dict[str, Any], authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    allowed_keys = {"name", "amount", "type", "category", "wallet_id", "frequency", "next_date", "note", "active"}
    allowed = {k: v for k, v in body.items() if k in allowed_keys}
    if allowed:
        await recurring_repo.update_one({"id": rec_id, "user_id": u["user_id"]}, {"$set": allowed})
    r = await recurring_repo.find_one({"id": rec_id, "user_id": u["user_id"]})
    if not r:
        raise HTTPException(404, "Not found")
    return {"success": True, "data": {"recurring": r}}


@recurring_router.delete("/{rec_id}")
async def delete_recurring(rec_id: str, authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    await recurring_repo.delete_one({"id": rec_id, "user_id": u["user_id"]})
    return {"success": True, "data": None}


@recurring_router.post("/{rec_id}/mark-paid")
async def mark_recurring_paid(rec_id: str, authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    r = await recurring_repo.find_one({"id": rec_id, "user_id": u["user_id"]})
    if not r:
        raise HTTPException(404, "Not found")
    wallet = await wallets_repo.find_one({"id": r["wallet_id"], "user_id": u["user_id"]})
    if not wallet:
        raise HTTPException(400, "Wallet not found")
    tx_doc = {
        "id": new_id("tx"), "user_id": u["user_id"], "wallet_id": r["wallet_id"],
        "to_wallet_id": None, "type": r["type"], "amount": r["amount"], "category": r["category"],
        "note": r.get("note") or f"{r['name']} (recurring)", "date": now_utc().isoformat(),
        "created_at": now_utc(),
    }
    await tx_repo.insert_one(tx_doc)
    delta = r["amount"] if r["type"] == "income" else -r["amount"]
    await wallets_repo.adjust_balance(r["wallet_id"], u["user_id"], delta)
    next_date = advance_date(r["next_date"], r["frequency"])
    await recurring_repo.update_one({"id": rec_id, "user_id": u["user_id"]}, {"$set": {"next_date": next_date}})
    updated = await recurring_repo.find_one({"id": rec_id, "user_id": u["user_id"]})
    return {"success": True, "data": {"recurring": updated, "transaction": tx_doc}}


# --- Custom Categories ---
categories_router = APIRouter(prefix="/categories")
categories_repo = CategoryRepository()


@categories_router.get("")
async def list_categories(authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    items = await categories_repo.find_by_user(u["user_id"])
    return {"success": True, "data": {"categories": items}}


@categories_router.post("")
async def create_category(payload: CategoryCreate, authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    label = payload.label.strip()
    if not label:
        raise HTTPException(400, "Category label is required")
    existing = await categories_repo.find_one({"user_id": u["user_id"], "label": label, "type": payload.type})
    if existing:
        raise HTTPException(400, "Category already exists")
    doc = {"id": new_id("cat"), "user_id": u["user_id"], **payload.model_dump(exclude={"label"}), "label": label, "created_at": now_utc()}
    await categories_repo.insert_one(doc)
    return {"success": True, "data": {"category": {k: v for k, v in doc.items() if k != "_id"}}}


@categories_router.patch("/{category_id}")
async def update_category(
    category_id: str,
    payload: CategoryUpdate,
    authorization: Optional[str] = Header(None),
):
    u = await auth_service.get_current_user(authorization)
    cat = await categories_repo.find_one({"id": category_id, "user_id": u["user_id"]})
    if not cat:
        raise HTTPException(404, "Not found")

    new_label = (payload.label or cat["label"]).strip()
    if not new_label:
        raise HTTPException(400, "Category label is required")
    new_type = payload.type or cat.get("type", "expense")

    # Same duplicate check create_category performs (per user+type).
    if new_label != cat["label"] or new_type != cat.get("type"):
        dup = await categories_repo.find_one({"user_id": u["user_id"], "label": new_label, "type": new_type})
        if dup and dup["id"] != category_id:
            raise HTTPException(400, "Category already exists")

    allowed = {}
    if payload.label is not None:
        allowed["label"] = new_label
    if payload.type is not None:
        allowed["type"] = new_type
    if payload.color is not None:
        allowed["color"] = payload.color
    if payload.icon is not None:
        allowed["icon"] = payload.icon

    if not allowed:
        return {"success": True, "data": {"category": cat}}

    # If the label changed, keep historical transactions pointing at the new
    # name instead of silently losing their category.
    if "label" in allowed and allowed["label"] != cat["label"]:
        await tx_repo.update_category_for_user(
            u["user_id"], cat["label"], allowed["label"]
        )

    await categories_repo.update_one({"id": category_id, "user_id": u["user_id"]}, {"$set": allowed})
    updated = await categories_repo.find_one({"id": category_id, "user_id": u["user_id"]})
    return {"success": True, "data": {"category": updated}}


@categories_router.delete("/{category_id}")
async def delete_category(
    category_id: str,
    reassign_to: Optional[str] = None,
    authorization: Optional[str] = Header(None),
):
    """Delete a category.

    - If no transaction references the category, it is deleted immediately.
    - If transactions reference it and `reassign_to` names another category of
      the same user, those transactions are bulk-reassigned first, then the
      category is deleted.
    - If transactions reference it and no `reassign_to` is given, return
      409 Conflict with the usage count — never silently drop transaction data.
    """
    u = await auth_service.get_current_user(authorization)
    cat = await categories_repo.find_one({"id": category_id, "user_id": u["user_id"]})
    if not cat:
        raise HTTPException(404, "Not found")

    usage = await tx_repo.count_by_category(u["user_id"], cat["label"])

    if usage > 0:
        if not reassign_to:
            raise HTTPException(409, detail={"message": "in_use", "count": usage})
        target = await categories_repo.find_one({
            "id": reassign_to, "user_id": u["user_id"],
        })
        if not target:
            raise HTTPException(400, "Reassign target category not found")
        if target["id"] == category_id:
            raise HTTPException(400, "Reassign target must be a different category")
        await tx_repo.update_category_for_user(u["user_id"], cat["label"], target["label"])

    await categories_repo.delete_one({"id": category_id, "user_id": u["user_id"]})
    return {"success": True, "data": None}
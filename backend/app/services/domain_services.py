from __future__ import annotations

from typing import Any, Dict, Optional
from datetime import datetime, timezone, timedelta
import httpx
from app.repositories.repos import (
    WalletRepository, DebtRepository, InvestmentRepository,
    AssetRepository, TransactionRepository, ChatMessageRepository,
)
from app.services.auth_service import AuthService
from app.utils.helpers import now_utc


_fx_cache: Dict[str, Any] = {}


class FxService:
    @staticmethod
    async def get_rates(base: str) -> Dict[str, float]:
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
            pass
        return cached["rates"] if cached else {}

    @staticmethod
    async def convert(amount: float, from_ccy: Optional[str], to_ccy: Optional[str]) -> float:
        if not from_ccy or not to_ccy or from_ccy == to_ccy:
            return amount
        rates = await FxService.get_rates(to_ccy)
        rate = rates.get(from_ccy)
        return amount / rate if rate else amount


class AnalyticsService:
    def __init__(self) -> None:
        self.auth = AuthService()
        self.wallets = WalletRepository()
        self.debts = DebtRepository()
        self.investments = InvestmentRepository()
        self.assets = AssetRepository()
        self.transactions = TransactionRepository()

    async def summary(self, authorization: Optional[str]) -> dict:
        u = await self.auth.get_current_user(authorization)
        uid = u["user_id"]
        home_ccy = u.get("currency", "USD")

        import asyncio
        wallets, debts_list, investments, assets_list = await asyncio.gather(
            self.wallets.find_by_user(uid),
            self.debts.find_by_user(uid),
            self.investments.find_by_user(uid),
            self.assets.find_by_user(uid),
        )

        wallet_total = 0.0
        for w in wallets:
            wallet_total += await FxService.convert(
                float(w.get("balance", 0.0)), w.get("currency", home_ccy), home_ccy
            )
        debt_total = sum(float(d.get("remaining", 0.0)) for d in debts_list)
        inv_total = sum(float(i.get("quantity", 0.0)) * float(i.get("current_price", 0.0)) for i in investments)
        asset_total = sum(float(a.get("value", 0.0)) for a in assets_list)
        net_worth = wallet_total + inv_total + asset_total - debt_total

        month_start = now_utc().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        six_months_ago = month_start - timedelta(days=180)

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
        agg = await self.transactions.aggregate(pipeline)

        month_map: dict = {}
        income_total = 0.0
        expense_total = 0.0
        cat_totals: dict = {}
        cat_trailing: dict = {}

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
            if mk == month_start.strftime("%Y-%m"):
                income_total += amt if typ == "income" else 0
                expense_total += amt if typ == "expense" else 0
                if typ == "expense":
                    cat_totals[row.get("category", "Other")] = cat_totals.get(row.get("category", "Other"), 0.0) + amt
            elif typ == "expense":
                cat_trailing.setdefault(row.get("category", "Other"), []).append(amt)

        trend = [v for k, v in sorted(month_map.items())][-6:]
        cash_flow = income_total - expense_total
        raw_sr = (cash_flow / income_total * 100) if income_total > 0 else (-100.0 if expense_total > 0 else 0.0)
        saving_rate = round(max(-100.0, min(100.0, raw_sr)), 1)
        total_assets = wallet_total + inv_total + asset_total
        debt_ratio = round((debt_total / total_assets * 100) if total_assets > 0 else 0.0, 1)

        def lerp(x, x0, y0, x1, y1):
            if x1 == x0:
                return y0
            t = max(0.0, min(1.0, (x - x0) / (x1 - x0)))
            return y0 + t * (y1 - y0)

        savings_score = lerp(saving_rate, -50, 0, 0, 50) if saving_rate <= 0 else lerp(saving_rate, 0, 50, 30, 100)
        debt_score = lerp(debt_ratio, 0, 100, 50, 50) if debt_ratio <= 50 else lerp(debt_ratio, 50, 50, 100, 0)
        denom = max(wallet_total + inv_total + asset_total, 1.0)
        inv_share = (inv_total / denom) * 100
        div_score = lerp(inv_share, 0, 0, 20, 100)
        liq_score = 100.0 if expense_total <= 0 else lerp(wallet_total / expense_total, 0, 0, 6, 100)

        score = round(savings_score * 0.40 + debt_score * 0.25 + div_score * 0.15 + liq_score * 0.20)
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
            "health_breakdown": {
                "savings": round(savings_score, 1),
                "debt": round(debt_score, 1),
                "diversification": round(div_score, 1),
                "liquidity": round(liq_score, 1),
            },
            "spending_alerts": spending_alerts,
            "category_breakdown": category_breakdown,
            "trend": trend,
            "counts": {
                "wallets": len(wallets),
                "debts": len(debts_list),
                "investments": len(investments),
                "assets": len(assets_list),
            },
        }


class DebtService:
    def __init__(self) -> None:
        self.debts = DebtRepository()

    def simulate_payoff(self, debts: list[dict], strategy: str, extra_monthly: float) -> dict:
        sim = [{
            "id": d["id"], "name": d["name"],
            "balance": float(d.get("remaining", 0.0)),
            "rate": float(d.get("interest_rate", 0.0)) / 100 / 12,
            "min_payment": float(d.get("monthly_payment", 0.0)),
            "paid_off_month": None, "total_interest": 0.0,
        } for d in debts if float(d.get("remaining", 0.0)) > 0]

        if not sim:
            return {"months": 0, "total_interest": 0.0, "debt_free_date": None, "debts": []}

        order_key = (lambda x: -x["rate"]) if strategy == "avalanche" else (lambda x: x["balance"])
        month = 0
        total_interest = 0.0
        max_months = 600

        while any(d["balance"] > 0.01 for d in sim) and month < max_months:
            month += 1
            pool = extra_monthly
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

            active = sorted([d for d in sim if d["balance"] > 0.01], key=order_key)
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
            "debts": [{"id": d["id"], "name": d["name"],
                       "payoff_month": d["paid_off_month"],
                       "interest_paid": round(d["total_interest"], 2)} for d in sim],
        }


class CoachService:
    def __init__(self) -> None:
        self.auth = AuthService()
        self.fx = FxService()
        self.wallets = WalletRepository()
        self.debts = DebtRepository()
        self.transactions = TransactionRepository()
        self.chat = ChatMessageRepository()

    async def build_context(self, authorization: Optional[str]) -> str:
        try:
            u = await self.auth.get_current_user(authorization)
            uid = u["user_id"]
            cur = u.get("currency", "USD")
            wallets = await self.wallets.find_by_user(uid)
            debts = await self.debts.find_by_user(uid)
            wallet_total = 0.0
            for w in wallets:
                wallet_total += await self.fx.convert(
                    float(w.get("balance", 0.0)), w.get("currency", cur), cur
                )
            debt_total = sum(float(d.get("remaining", 0.0)) for d in debts)
            month_start = now_utc().replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
            inc_exp = await self.transactions.aggregate([
                {"$match": {"user_id": uid, "date": {"$gte": month_start}}},
                {"$group": {"_id": "$type", "total": {"$sum": {"$toDouble": "$amount"}}}},
            ])
            income = next((r["total"] for r in inc_exp if r["_id"] == "income"), 0.0)
            expense = next((r["total"] for r in inc_exp if r["_id"] == "expense"), 0.0)
            sr = round((income - expense) / income * 100, 1) if income > 0 else 0.0
            return (
                f"[USER CONTEXT] name={u.get('name')} currency={cur} "
                f"net_worth={round(wallet_total - debt_total, 2)} "
                f"month_income={round(income, 2)} month_expense={round(expense, 2)} "
                f"saving_rate={sr}%"
            )
        except Exception:
            return ""
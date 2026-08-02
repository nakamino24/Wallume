"""Income Template Engine service.

Templates are pure config (JSON files under app/data/templates). The engine
(`income_engine.py`) is profession-agnostic. This service wires template
selection, income-source CRUD, forecasting, and the AI suggestion step.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Optional
from fastapi import HTTPException
import httpx

from app.core.config import settings
from app.database.mongo import get_database
from app.repositories.repos import IncomeTemplateRepository, IncomeSourceRepository
from app.services.auth_service import AuthService
from app.services.income_engine import forecast_sources
from app.utils.helpers import new_id, now_utc

TEMPLATES_DIR = Path(__file__).parent.parent / "data" / "templates"


class IncomeService:
    def __init__(self) -> None:
        self.auth = AuthService()
        self.templates = IncomeTemplateRepository()
        self.sources = IncomeSourceRepository()

    # ----- Template loading (config JSON files) -----
    def _load_template_files(self) -> list[dict]:
        files = sorted(TEMPLATES_DIR.glob("*.json"))
        items = []
        for f in files:
            try:
                items.append(json.loads(f.read_text(encoding="utf-8")))
            except Exception:
                continue
        return items

    async def list_templates(self) -> list[dict]:
        # Templates live as JSON config files — the DB is only for admin overrides.
        return self._load_template_files()

    async def get_template(self, template_id: str) -> dict:
        for t in self._load_template_files():
            if t.get("id") == template_id:
                return t
        raise HTTPException(404, "Template not found")

    # ----- Apply template -> user income sources -----
    async def apply_template(self, authorization: Optional[str], template_id: str, override_sources: Optional[list[dict]], work_week: Optional[int], payday_day: Optional[int]) -> dict:
        u = await self.auth.get_current_user(authorization)
        template = await self.get_template(template_id)
        home_ccy = u.get("currency", "USD")

        sources = override_sources if override_sources is not None else template.get("incomeSources", [])
        docs = []
        for idx, src in enumerate(sources):
            currency = src.get("currency") or home_ccy
            docs.append(_source_doc(u["user_id"], src, currency, idx))

        await self.sources.delete_many({"user_id": u["user_id"]}, hard=True)
        for d in docs:
            await self.sources.insert_one(d)

        # Persist template presets to the user profile (work_week / payday).
        ww = work_week or template.get("workWeekDefault")
        pd = payday_day or template.get("paydayDayDefault")
        patch = {}
        if ww in (5, 6, 7):
            patch["work_week"] = ww
        if pd and 1 <= pd <= 31:
            patch["payday_day"] = pd
        if patch:
            await self.auth.update_profile(authorization, patch)

        return {"template_id": template_id, "template_name": template.get("name"), "source_count": len(docs)}

    # ----- Income source CRUD -----
    async def list_sources(self, authorization: Optional[str]) -> list[dict]:
        u = await self.auth.get_current_user(authorization)
        return await self.sources.find_by_user_ordered(u["user_id"])

    async def add_source(self, authorization: Optional[str], body: dict) -> dict:
        u = await self.auth.get_current_user(authorization)
        existing = await self.sources.find_by_user_ordered(u["user_id"])
        doc = _source_doc(u["user_id"], body, body.get("currency") or u.get("currency", "USD"), len(existing))
        await self.sources.insert_one(doc)
        return {k: v for k, v in doc.items() if k != "_id"}

    async def update_source(self, authorization: Optional[str], source_id: str, body: dict) -> dict:
        u = await self.auth.get_current_user(authorization)
        existing = await self.sources.find_one({"id": source_id, "user_id": u["user_id"]})
        if not existing:
            raise HTTPException(404, "Income source not found")
        merged = {**existing, **body}
        await self.sources.update_one({"id": source_id, "user_id": u["user_id"]}, {"$set": merged})
        return await self.sources.find_one({"id": source_id, "user_id": u["user_id"]})

    async def delete_source(self, authorization: Optional[str], source_id: str) -> None:
        u = await self.auth.get_current_user(authorization)
        await self.sources.delete_one({"id": source_id, "user_id": u["user_id"]})

    async def reorder_sources(self, authorization: Optional[str], ids: list[str]) -> None:
        u = await self.auth.get_current_user(authorization)
        for idx, sid in enumerate(ids):
            await self.sources.update_one({"id": sid, "user_id": u["user_id"]}, {"$set": {"sort_order": idx}})

    # ----- Forecast -----
    async def forecast(self, authorization: Optional[str], from_date: Optional[str] = None) -> dict:
        u = await self.auth.get_current_user(authorization)
        sources = await self.sources.find_by_user_ordered(u["user_id"])
        ref = None
        if from_date:
            from datetime import date as _d
            try:
                y, m, d = (int(x) for x in from_date.split("-"))
                ref = _d(y, m, d)
            except Exception:
                ref = None
        work_week = u.get("work_week") or 5
        results = forecast_sources(sources, work_week, ref)
        total = round(sum(r["amount"] for r in results), 2)
        next_date = min((r["next_payment_date"] for r in results if r["next_payment_date"]), default=None)
        return {"sources": results, "total_expected": total, "next_payment_date": next_date, "count": len(results)}

    # ----- AI template suggestion (Groq) -----
    async def suggest_templates(self, authorization: Optional[str], job_description: str) -> list[dict]:
        await self.auth.get_current_user(authorization)
        templates = self._load_template_files()
        if not settings.groq_api_key:
            # Fallback: keyword match
            return self._keyword_suggest(job_description, templates)
        names = [t["name"] for t in templates]
        prompt = (
            "You are a career-profiling assistant. Given a user's job description, "
            f"pick 2-4 most relevant income templates from this list: {', '.join(names)}. "
            "Return ONLY a JSON array of template names, e.g. [\"Nurse\", \"Doctor\"]. "
            f"Job: {job_description}"
        )
        try:
            async with httpx.AsyncClient(timeout=30.0) as hc:
                resp = await hc.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {settings.groq_api_key}", "Content-Type": "application/json"},
                    json={"model": "llama-3.3-70b-versatile", "max_tokens": 150,
                          "messages": [{"role": "system", "content": prompt}]},
                )
                data = resp.json()
                content = data["choices"][0]["message"]["content"]
                import re
                match = re.search(r"\[.*?\]", content, re.S)
                if match:
                    import json as _json
                    picked = _json.loads(match.group(0))
                    return [t for t in templates if t["name"] in picked]
        except Exception:
            pass
        return self._keyword_suggest(job_description, templates)

    def _keyword_suggest(self, job: str, templates: list[dict]) -> list[dict]:
        keywords = {
            "office_employee": ["office", "admin", "administrasi", "staff", "kantor"],
            "government_bumn": ["government", "pns", "bumn", "civil", "pegawai"],
            "factory_worker": ["factory", "pabrik", "operator", "produksi"],
            "nurse": ["nurse", "perawat", "hospital", "rumah sakit", "klinik"],
            "doctor": ["doctor", "dokter", "hospital"],
            "pharmacist": ["pharmacist", "apotek", "farmasi"],
            "retail_spg": ["retail", "spg", "store", "indomaret", "alfamart", "sales promotion"],
            "sales_executive": ["sales", "marketing", "account executive"],
            "freelancer": ["freelance", "freelancer", "remote"],
            "consultant": ["consultant", "konsultan"],
            "driver": ["driver", "sopir", "ojek", "gojek", "grab"],
            "teacher_lecturer": ["teacher", "guru", "lecturer", "dosen", "pendidik"],
            "content_creator": ["content", "creator", "youtube", "tiktok", "influencer"],
            "investor": ["investor", "saham", "investasi", "dividend"],
            "student": ["student", "mahasiswa", "pelajar"],
            "unemployed": ["unemployed", "pengangguran"],
        }
        low = job.lower()
        scored = []
        for tid, template in enumerate(templates):
            score = sum(1 for kw in keywords.get(template["id"], []) if kw in low)
            if score:
                scored.append((score, template))
        scored.sort(key=lambda x: -x[0])
        return [t for _, t in scored[:4]] or templates[:3]


def _source_doc(user_id: str, src: dict, currency: str, sort_order: int) -> dict:
    return {
        "id": new_id("inc"),
        "user_id": user_id,
        "name": src.get("name"),
        "calculation_method": src.get("calculationMethod", "fixed_amount"),
        "frequency": src.get("frequency", "monthly"),
        "expected_payment_date": src.get("expectedPaymentDate") or {},
        "adjustment_rules": src.get("adjustmentRules") or [],
        "forecast_rules": src.get("forecastRules") or {},
        "currency": currency,
        "tax_status": src.get("taxStatus", "taxable"),
        "recurring": src.get("recurring", True),
        "amount": float(src.get("amount") or 0),
        "hourly_rate": float(src.get("hourlyRate") or 0),
        "daily_rate": float(src.get("dailyRate") or 0),
        "per_shift": float(src.get("perShift") or 0),
        "per_visit": float(src.get("perVisit") or 0),
        "per_sale": float(src.get("perSale") or 0),
        "per_project": float(src.get("perProject") or 0),
        "percentage": float(src.get("percentage") or 0),
        "percentage_of": src.get("percentageOf"),
        "formula": src.get("formula"),
        "sort_order": sort_order,
        "created_at": now_utc(),
    }
from __future__ import annotations

from typing import Any, Optional
from fastapi import APIRouter, Header
from app.schemas.models import IncomeSourceIn, TemplateApplyRequest, ForecastRequest, TemplateSuggestRequest
from app.services.income_service import IncomeService

router = APIRouter(prefix="/income")
svc = IncomeService()


@router.get("/templates")
async def list_templates(authorization: Optional[str] = Header(None)):
    items = await svc.list_templates()
    return {"success": True, "data": {"templates": items}}


@router.get("/templates/{template_id}")
async def get_template(template_id: str, authorization: Optional[str] = Header(None)):
    t = await svc.get_template(template_id)
    return {"success": True, "data": {"template": t}}


@router.post("/templates/apply")
async def apply_template(payload: TemplateApplyRequest, template_id: str, authorization: Optional[str] = Header(None)):
    sources = [s.model_dump() for s in payload.override_sources] if payload.override_sources is not None else None
    result = await svc.apply_template(authorization, template_id, sources, payload.work_week, payload.payday_day)
    return {"success": True, "data": result}


@router.post("/templates/suggest")
async def suggest_templates(payload: TemplateSuggestRequest, authorization: Optional[str] = Header(None)):
    items = await svc.suggest_templates(authorization, payload.job_description)
    return {"success": True, "data": {"templates": items}}


@router.get("/sources")
async def list_sources(authorization: Optional[str] = Header(None)):
    items = await svc.list_sources(authorization)
    return {"success": True, "data": {"sources": items}}


@router.post("/sources")
async def add_source(payload: IncomeSourceIn, authorization: Optional[str] = Header(None)):
    doc = await svc.add_source(authorization, payload.model_dump(exclude_none=True))
    return {"success": True, "data": {"source": doc}}


@router.patch("/sources/{source_id}")
async def update_source(source_id: str, body: dict[str, Any], authorization: Optional[str] = Header(None)):
    doc = await svc.update_source(authorization, source_id, body)
    return {"success": True, "data": {"source": doc}}


@router.delete("/sources/{source_id}")
async def delete_source(source_id: str, authorization: Optional[str] = Header(None)):
    await svc.delete_source(authorization, source_id)
    return {"success": True, "data": None}


@router.post("/sources/reorder")
async def reorder_sources(body: dict[str, Any], authorization: Optional[str] = Header(None)):
    ids = body.get("ids") or []
    await svc.reorder_sources(authorization, ids)
    return {"success": True, "data": None}


@router.get("/forecast")
async def forecast(from_date: Optional[str] = None, authorization: Optional[str] = Header(None)):
    result = await svc.forecast(authorization, from_date)
    return {"success": True, "data": result}
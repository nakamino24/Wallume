from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Header
from app.services.domain_services import AnalyticsService

router = APIRouter(prefix="/analytics")
svc = AnalyticsService()


@router.get("/summary")
async def analytics_summary(authorization: Optional[str] = Header(None)):
    result = await svc.summary(authorization)
    return {"success": True, "data": result}
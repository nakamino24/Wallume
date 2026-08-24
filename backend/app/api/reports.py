from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Header, HTTPException

from app.repositories.repos import TransactionRepository
from app.services.auth_service import AuthService
from app.utils.helpers import strict_canonical_date


router = APIRouter(prefix="/reports")
auth_service = AuthService()
txs = TransactionRepository()


def _report_date(value: str, name: str) -> str:
    canonical = strict_canonical_date(value)
    if canonical != value:
        raise HTTPException(400, f"{name} must be a valid YYYY-MM-DD date")
    return canonical


@router.get("/summary")
async def report_summary(
    from_date: str,
    to_date: str,
    authorization: Optional[str] = Header(None),
):
    from_date = _report_date(from_date, "from_date")
    to_date = _report_date(to_date, "to_date")
    if from_date > to_date:
        raise HTTPException(400, "from_date must not be after to_date")

    next_day = (datetime.strptime(to_date, "%Y-%m-%d") + timedelta(days=1)).strftime("%Y-%m-%d")
    user = await auth_service.get_current_user(authorization)
    summary = await txs.aggregate_report_summary(user["user_id"], from_date, next_day)
    return {
        "success": True,
        "data": {"from_date": from_date, "to_date": to_date, **summary},
    }

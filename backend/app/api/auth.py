from typing import Any, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.schemas.models import (
    SignupRequest, LoginRequest, UserUpdateRequest,
    PasswordResetRequest, PasswordResetVerifyRequest,
    PasswordResetConfirmRequest, PasswordResetResendRequest,
)
from app.services.auth_service import AuthService
from app.services.password_reset_service import PasswordResetService

router = APIRouter(prefix="/auth")
auth_service = AuthService()
password_reset_service = PasswordResetService()
limiter = Limiter(key_func=get_remote_address)


@router.post("/signup")
@limiter.limit("5/minute")
async def signup(payload: SignupRequest, request: Request):
    result = await auth_service.signup(
        payload.email, payload.password, payload.name,
        payday_day=payload.payday_day, currency=payload.currency, work_week=payload.work_week,
    )
    return {"success": True, "data": result}


@router.post("/login")
@limiter.limit("10/minute")
async def login(payload: LoginRequest, request: Request):
    result = await auth_service.login(payload.email, payload.password)
    return {"success": True, "data": result}


@router.post("/password-reset/request")
@limiter.limit("5/15 minutes")
async def request_password_reset(
    payload: PasswordResetRequest,
    request: Request,
    background_tasks: BackgroundTasks,
):
    result = await password_reset_service.request(
        str(payload.email), payload.locale, background_tasks
    )
    return {"success": True, "data": result}


@router.post("/password-reset/resend")
@limiter.limit("5/15 minutes")
async def resend_password_reset(
    payload: PasswordResetResendRequest,
    request: Request,
    background_tasks: BackgroundTasks,
):
    result = await password_reset_service.resend(
        payload.request_id, background_tasks
    )
    return {"success": True, "data": result}


@router.post("/password-reset/verify")
async def verify_password_reset(payload: PasswordResetVerifyRequest):
    result = await password_reset_service.verify(payload.request_id, payload.code)
    return {"success": True, "data": result}


@router.post("/password-reset/confirm")
async def confirm_password_reset(payload: PasswordResetConfirmRequest):
    await password_reset_service.confirm(
        payload.reset_token, payload.new_password, payload.confirm_password
    )
    return {
        "success": True,
        "data": {"message": "Password updated. Sign in with your new password."},
    }


@router.get("/me")
async def me(authorization: Optional[str] = Header(None)):
    user = await auth_service.get_current_user(authorization)
    from app.utils.helpers import clean_user
    return {"success": True, "data": {"user": clean_user(user)}}


@router.patch("/me")
async def update_me(body: dict[str, Any], authorization: Optional[str] = Header(None)):
    updated = await auth_service.update_profile(authorization, body)
    return {"success": True, "data": {"user": updated}}


@router.delete("/me")
async def delete_account(authorization: Optional[str] = Header(None)):
    await auth_service.delete_account(authorization)
    return {"success": True, "data": None}


@router.post("/logout")
async def logout(authorization: Optional[str] = Header(None)):
    await auth_service.logout(authorization)
    return {"success": True, "data": None}

from __future__ import annotations

from typing import Any, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.schemas.models import (
    SignupRequest, LoginRequest, UserUpdateRequest,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth")
auth_service = AuthService()
limiter = Limiter(key_func=get_remote_address)


@router.post("/signup")
@limiter.limit("5/minute")
async def signup(payload: SignupRequest, request: Request):
    result = await auth_service.signup(payload.email, payload.password, payload.name)
    return {"success": True, "data": result}


@router.post("/login")
@limiter.limit("10/minute")
async def login(payload: LoginRequest, request: Request):
    result = await auth_service.login(payload.email, payload.password)
    return {"success": True, "data": result}


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
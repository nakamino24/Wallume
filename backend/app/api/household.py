from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.services.auth_service import AuthService
from app.services import tenancy_service as tenancy

router = APIRouter(prefix="/household")
auth_service = AuthService()
# Same limiter pattern as auth: an invite code is a guessable secret, so
# joining must be throttled or codes can be enumerated.
limiter = Limiter(key_func=get_remote_address)


class JoinRequest(BaseModel):
    # Minimum raised to match the 12-character codes now issued, so a client
    # cannot burn attempts on obviously-too-short inputs.
    invite_code: str = Field(min_length=6, max_length=32)


class RenameRequest(BaseModel):
    name: str = Field(min_length=1, max_length=60)


class RemoveMemberRequest(BaseModel):
    user_id: str


@router.get("")
async def get_household(authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    # Scope resolution creates the personal household on first read, so this
    # never 404s for a real account.
    await tenancy.resolve_scope(u)
    return {"success": True, "data": {"household": await tenancy.household_detail(u["user_id"])}}


@router.post("/join")
@limiter.limit("10/minute")
async def join_household(payload: JoinRequest, request: Request, authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    detail = await tenancy.join_household(u["user_id"], payload.invite_code)
    return {"success": True, "data": {"household": detail}}


@router.post("/leave")
async def leave_household(authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    return {"success": True, "data": {"household": await tenancy.leave_household(u["user_id"])}}


@router.patch("")
async def rename_household(payload: RenameRequest, authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    return {"success": True, "data": {"household": await tenancy.rename_household(u["user_id"], payload.name)}}


@router.post("/rotate-invite")
async def rotate_invite(authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    return {"success": True, "data": {"household": await tenancy.rotate_invite_code(u["user_id"])}}


@router.post("/members/remove")
async def remove_member(payload: RemoveMemberRequest, authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    detail = await tenancy.remove_member(u["user_id"], payload.user_id)
    return {"success": True, "data": {"household": detail}}

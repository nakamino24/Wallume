from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse
from app.schemas.models import CoachChatRequest
from app.services.auth_service import AuthService
from app.services.domain_services import CoachService
from app.repositories.repos import ChatMessageRepository
from app.core.config import settings
from app.utils.helpers import new_id, now_utc
import httpx
import json as _json
import logging

router = APIRouter(prefix="/coach")
auth_service = AuthService()
coach_svc = CoachService()
chat_repo = ChatMessageRepository()
log = logging.getLogger("wallume.coach")

COACH_SYSTEM = (
    "You are Wallume Coach, a warm, concise, and expert personal finance advisor. "
    "Give practical, numbers-first advice. Keep answers short (3-6 sentences) unless the user asks for detail. "
    "Prefer bullet points. Never give tax or legal advice as authoritative; suggest professionals for complex cases. "
    "If asked for investment specifics, remind the user of risk and diversification. Be encouraging."
)


@router.post("/chat")
async def coach_chat(payload: CoachChatRequest, authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    if not settings.groq_api_key:
        raise HTTPException(500, "Groq API key not configured")

    await chat_repo.insert_one({
        "id": new_id("msg"), "user_id": u["user_id"], "session_id": payload.session_id,
        "role": "user", "text": payload.message, "created_at": now_utc(),
    })

    ctx = await coach_svc.build_context(authorization)
    system_msg = COACH_SYSTEM + ("\n" + ctx if ctx else "")

    async def generate():
        acc = ""
        try:
            async with httpx.AsyncClient(timeout=60.0) as hc:
                async with hc.stream(
                    "POST",
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {settings.groq_api_key}",
                        "Content-Type": "application/json",
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
                    if resp.status_code != 200:
                        err_body = await resp.aread()
                        raise RuntimeError(f"Groq API error {resp.status_code}: {err_body.decode(errors='ignore')[:300]}")
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
            await chat_repo.insert_one({
                "id": new_id("msg"), "user_id": u["user_id"], "session_id": payload.session_id,
                "role": "assistant", "text": acc, "created_at": now_utc(),
            })
        except Exception:
            pass
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


@router.get("/history")
async def coach_history(session_id: str, authorization: Optional[str] = Header(None)):
    u = await auth_service.get_current_user(authorization)
    msgs = await (await chat_repo._collection()).find(
        {"user_id": u["user_id"], "session_id": session_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(500)
    return {"success": True, "data": {"messages": msgs}}
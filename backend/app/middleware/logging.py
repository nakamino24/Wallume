from __future__ import annotations

import time
import uuid
import logging
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

log = logging.getLogger("wallume.request")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = uuid.uuid4().hex[:12]
        start = time.perf_counter()
        response = await call_next(request)
        elapsed = int((time.perf_counter() - start) * 1000)
        log.info(
            "request_id=%s method=%s path=%s status=%d duration=%dms",
            request_id, request.method, request.url.path, response.status_code, elapsed,
        )
        response.headers["X-Request-ID"] = request_id
        return response
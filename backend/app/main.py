from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.database.mongo import get_database, create_indexes, close_database
from app.middleware.logging import RequestLoggingMiddleware
from app.api.router import register_routers
from app.utils.money import register_decimal_encoder

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

limiter = Limiter(key_func=get_remote_address, default_limits=[settings.default_rate_limit])


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_indexes()
    logging.getLogger("wallume").info("Wallume backend ready")
    yield
    await close_database()


def create_app() -> FastAPI:
    app = FastAPI(
        title="Wallume API",
        version="1.0.3b",
        docs_url="/docs",
        lifespan=lifespan,
    )

    register_decimal_encoder(app)
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    app.add_middleware(
        CORSMiddleware,
        allow_credentials=True,
        allow_origins=settings.allowed_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(RequestLoggingMiddleware)

    register_routers(app)

    @app.get("/api/")
    async def root():
        return {"success": True, "data": {"app": "Wallume", "status": "ok", "version": "1.0.3b"}}

    return app


app = create_app()






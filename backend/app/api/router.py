from app.api.auth import router as auth_router
from app.api.wallets import router as wallets_router
from app.api.transactions import router as transactions_router
from app.api.resources import (
    budgets_router, goals_router, plans_router,
    debts_router, investments_router, assets_router,
    recurring_router, categories_router,
)
from app.api.analytics import router as analytics_router
from app.api.coach import router as coach_router
from app.api.income import router as income_router, admin_router as income_admin_router


def register_routers(app):
    app.include_router(auth_router, prefix="/api")
    app.include_router(wallets_router, prefix="/api")
    app.include_router(transactions_router, prefix="/api")
    app.include_router(budgets_router, prefix="/api")
    app.include_router(goals_router, prefix="/api")
    app.include_router(plans_router, prefix="/api")
    app.include_router(debts_router, prefix="/api")
    app.include_router(investments_router, prefix="/api")
    app.include_router(assets_router, prefix="/api")
    app.include_router(recurring_router, prefix="/api")
    app.include_router(categories_router, prefix="/api")
    app.include_router(analytics_router, prefix="/api")
    app.include_router(coach_router, prefix="/api")
    app.include_router(income_router, prefix="/api")
    app.include_router(income_admin_router, prefix="/api")
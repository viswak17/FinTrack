"""
Central API router — aggregates all endpoint routers.
"""
from fastapi import APIRouter
from app.api.endpoints import (
    auth, accounts, categories, transactions, budgets,
    goals, recurring, currency, reports, ai, nlp, notifications,
)

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(accounts.router)
api_router.include_router(categories.router)
api_router.include_router(transactions.router)
api_router.include_router(budgets.router)
api_router.include_router(goals.router)
api_router.include_router(recurring.router)
api_router.include_router(currency.router)
api_router.include_router(reports.router)
api_router.include_router(ai.router)
api_router.include_router(nlp.router)
api_router.include_router(notifications.router)




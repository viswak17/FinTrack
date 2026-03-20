"""
Multi-Currency endpoint — Phase 2.
- GET /currency/rates  → latest FX rates from cache or API
- GET /currency/rates/{base}  → rates for a specific base currency
- POST /currency/preferences  → save user's preferred currencies
- GET /currency/convert  → quick amount conversion
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timedelta
import httpx
import logging

from app.core.database import get_db
from app.core.config import settings
from app.core.redis import redis_client, make_cache_key as cache_key
from app.api.deps import get_current_user

router = APIRouter(prefix="/currency", tags=["currency"])
logger = logging.getLogger(__name__)

# Forex cache TTL: 1 hour
FX_TTL = 3600
SUPPORTED_CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "JPY", "AUD", "CAD", "CHF"]


async def _fetch_rates(base: str = "USD") -> dict:
    """Fetch live rates from ExchangeRate-API, with Redis cache."""
    key = cache_key("fx", base)

    # Try Redis cache first
    if redis_client:
        import json
        cached = await redis_client.get(key)
        if cached:
            return json.loads(cached)

    # Fetch from API
    if not settings.EXCHANGE_RATE_API_KEY:
        # Return hardcoded approximate rates for dev
        return {
            "base": base,
            "rates": {
                "INR": 83.5, "USD": 1.0, "EUR": 0.92, "GBP": 0.79,
                "AED": 3.67, "SGD": 1.34, "JPY": 149.5, "AUD": 1.53,
                "CAD": 1.36, "CHF": 0.88,
            },
            "timestamp": datetime.utcnow().isoformat(),
            "source": "fallback",
        }

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"https://v6.exchangerate-api.com/v6/{settings.EXCHANGE_RATE_API_KEY}/latest/{base}"
            )
            data = resp.json()
            rates = {k: v for k, v in data.get("conversion_rates", {}).items()
                     if k in SUPPORTED_CURRENCIES}
            result = {
                "base": base,
                "rates": rates,
                "timestamp": datetime.utcnow().isoformat(),
                "source": "exchangerate-api",
            }
            # Cache result
            if redis_client:
                import json
                await redis_client.set(key, json.dumps(result), ex=FX_TTL)
            return result
    except Exception as e:
        logger.error(f"FX fetch failed: {e}")
        raise HTTPException(status_code=503, detail="Exchange rate service unavailable")


@router.get("/rates", response_model=dict)
async def get_rates(
    base: str = Query(default="USD"),
    current_user: dict = Depends(get_current_user),
):
    if base not in SUPPORTED_CURRENCIES:
        raise HTTPException(status_code=400, detail=f"Unsupported base currency: {base}")
    return await _fetch_rates(base)


@router.get("/convert", response_model=dict)
async def convert_amount(
    amount: float = Query(...),
    from_currency: str = Query(...),
    to_currency: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    """Convert an amount between two currencies."""
    rates_data = await _fetch_rates("USD")
    rates = rates_data["rates"]

    if from_currency not in rates and from_currency != "USD":
        raise HTTPException(status_code=400, detail=f"Unknown currency: {from_currency}")
    if to_currency not in rates and to_currency != "USD":
        raise HTTPException(status_code=400, detail=f"Unknown currency: {to_currency}")

    # Normalise via USD
    from_rate = rates.get(from_currency, 1.0)
    to_rate   = rates.get(to_currency, 1.0)
    in_usd    = amount / from_rate
    converted = in_usd * to_rate

    return {
        "amount":        amount,
        "from":          from_currency,
        "to":            to_currency,
        "converted":     round(converted, 4),
        "rate":          round(to_rate / from_rate, 6),
        "timestamp":     rates_data["timestamp"],
    }


@router.get("/supported", response_model=list)
async def list_supported(current_user: dict = Depends(get_current_user)):
    return SUPPORTED_CURRENCIES


@router.get("/preferences", response_model=dict)
async def get_preferences(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    doc = await db.user_preferences.find_one({"user_id": current_user["id"]})
    if not doc:
        return {"user_id": current_user["id"], "currencies": ["INR", "USD"], "base": "INR"}
    return {
        "user_id":    current_user["id"],
        "currencies": doc.get("currencies", ["INR"]),
        "base":       doc.get("base_currency", "INR"),
    }


@router.put("/preferences", response_model=dict)
async def update_preferences(
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    currencies = body.get("currencies", ["INR"])
    base = body.get("base", "INR")
    await db.user_preferences.update_one(
        {"user_id": current_user["id"]},
        {"$set": {"currencies": currencies, "base_currency": base}},
        upsert=True,
    )
    return {"user_id": current_user["id"], "currencies": currencies, "base": base}

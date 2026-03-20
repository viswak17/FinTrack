"""
AI Advisor endpoint — Phase 3.
- POST /ai/categorize          → ML auto-categorize a transaction
- POST /ai/categorize/batch    → Batch categorize up to 50 transactions
- GET  /ai/forecast            → 30-day spend forecast (Prophet / MA fallback)
- GET  /ai/insights            → Groq LLM financial insights
- POST /ai/chat                → Free-form financial advisor chat
- GET  /ai/anomalies           → Spending anomalies (IQR-based)
- POST /ai/retrain             → Manual trigger to retrain categorizer
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List
import logging
from datetime import datetime, timedelta

from app.core.database import get_db
from app.core.config import settings
from app.api.deps import get_current_user
from app.ml.categorizer import categorizer, TransactionCategorizer, MIN_TX_FOR_TRAINING
from app.ml.model_store import model_store
from app.ml.forecaster import forecaster

router = APIRouter(prefix="/ai", tags=["ai"])
logger = logging.getLogger(__name__)


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_user_categorizer(db, user_id: str) -> TransactionCategorizer:
    """Load user's personalised model or fall back to global singleton."""
    model_bytes = await model_store.load_categorizer(db, user_id)
    if model_bytes:
        return TransactionCategorizer.deserialize(model_bytes)
    return categorizer


async def _train_for_user(db, user_id: str) -> bool:
    """Fetch labelled transactions and train a personal categorizer."""
    pipeline = [
        {"$match": {"user_id": user_id, "category_id": {"$ne": None}}},
        {"$sort": {"date": -1}},
        {"$limit": 2000},
        {"$lookup": {
            "from":         "categories",
            "localField":   "category_id",
            "foreignField": "_id",
            "as":           "cat",
        }},
        {"$unwind": {"path": "$cat", "preserveNullAndEmptyArrays": True}},
        {"$project": {
            "description":   1,
            "payee":         1,
            "category_name": {"$ifNull": ["$cat.name", "Other Expenses"]},
        }},
    ]
    txs = await db.transactions.aggregate(pipeline).to_list(2000)
    if len(txs) < MIN_TX_FOR_TRAINING:
        return False

    cat = TransactionCategorizer()
    success = cat.train(txs)
    if success:
        await model_store.save_categorizer(db, user_id, cat.serialize())
    return success


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/categorize", response_model=dict)
async def categorize_transaction(
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Suggest a category for a single transaction."""
    cat = await _get_user_categorizer(db, current_user["id"])
    result = cat.categorize(
        description=body.get("description", ""),
        payee=body.get("payee", ""),
    )
    return result


@router.post("/categorize/batch", response_model=List[dict])
async def batch_categorize(
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Batch categorize up to 50 transactions."""
    transactions = body.get("transactions", [])[:50]
    cat = await _get_user_categorizer(db, current_user["id"])
    return [
        cat.categorize(
            description=tx.get("description", ""),
            payee=tx.get("payee", ""),
        )
        for tx in transactions
    ]


@router.get("/forecast", response_model=dict)
async def get_forecast(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """30-day spend forecast using Prophet or moving-average fallback."""
    return await forecaster.forecast(db, current_user["id"])


@router.get("/anomalies", response_model=List[dict])
async def detect_anomalies(
    days: int = 30,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    IQR-based anomaly detection: transactions > Q3 + 1.5*IQR for their category.
    """
    since = datetime.utcnow() - timedelta(days=days)
    pipeline = [
        {"$match": {
            "user_id": current_user["id"],
            "type":    "expense",
            "date":    {"$gte": since},
        }},
        {"$group": {
            "_id":     "$category_id",
            "amounts": {"$push": "$amount"},
            "txs":     {"$push": {"_id": "$_id", "amount": "$amount", "payee": "$payee",
                                   "description": "$description", "date": "$date"}},
        }},
    ]
    groups = await db.transactions.aggregate(pipeline).to_list(100)

    anomalies = []
    for group in groups:
        amounts = sorted(group["amounts"])
        if len(amounts) < 4:
            continue
        n = len(amounts)
        q1 = amounts[n // 4]
        q3 = amounts[3 * n // 4]
        iqr = q3 - q1
        upper = q3 + 1.5 * iqr

        for tx in group["txs"]:
            if tx["amount"] > upper:
                anomalies.append({
                    "transaction_id":  str(tx["_id"]),
                    "amount":          tx["amount"],
                    "payee":           tx.get("payee"),
                    "description":     tx.get("description"),
                    "date":            tx.get("date"),
                    "category_id":     group["_id"],
                    "threshold":       round(upper, 2),
                    "severity":        "high" if tx["amount"] > upper * 1.5 else "medium",
                })

    anomalies.sort(key=lambda x: x["amount"], reverse=True)
    return anomalies


@router.get("/insights", response_model=dict)
async def get_ai_insights(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Groq LLM-powered financial insights.
    Builds a data snapshot and asks Groq to generate actionable advice.
    """
    # Check cache first (ml_models collection, type="ai_insight")
    cached = await db.ai_insight_cache.find_one({"user_id": current_user["id"]})
    if cached:
        age = (datetime.utcnow() - cached.get("updated_at", datetime.min)).total_seconds()
        if age < 3600:  # 1hr cache
            return {"insights": cached["insights"], "cached": True}

    # Build context snapshot
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0)

    pipeline = [
        {"$match": {"user_id": current_user["id"], "date": {"$gte": month_start}}},
        {"$group": {"_id": "$type", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
    ]
    summary = {r["_id"]: r for r in await db.transactions.aggregate(pipeline).to_list(5)}

    # Top categories this month
    cat_pipeline = [
        {"$match": {"user_id": current_user["id"], "type": "expense", "date": {"$gte": month_start}, "category_id": {"$ne": None}}},
        {"$group": {"_id": "$category_id", "total": {"$sum": "$amount"}}},
        {"$sort": {"total": -1}},
        {"$limit": 5},
    ]
    top_cats_raw = await db.transactions.aggregate(cat_pipeline).to_list(5)
    top_cats = []
    for c in top_cats_raw:
        from bson import ObjectId
        cat_doc = await db.categories.find_one({"_id": ObjectId(c["_id"])}) if ObjectId.is_valid(c["_id"]) else None
        top_cats.append({
            "name":  cat_doc["name"] if cat_doc else "Unknown",
            "total": c["total"],
        })

    income  = summary.get("income",  {}).get("total", 0)
    expense = summary.get("expense", {}).get("total", 0)
    savings = income - expense

    cats_str = ', '.join([f"{c['name']} Rs{c['total']:.0f}" for c in top_cats])
    context = (
        f"This month: income Rs{income:.0f}, expenses Rs{expense:.0f}, savings Rs{savings:.0f}. "
f"Savings rate: {(savings/income*100 if income else 0):.1f}%. "
        f"Top expense categories: {cats_str}."
    )

    if not settings.GROQ_API_KEY:
        # Return a structured placeholder when no API key configured
        insights = [
            {"title": "Connect Groq", "body": "Add your GROQ_API_KEY to .env to unlock AI-powered insights.", "emoji": "🔑"},
            {"title": "Month Summary", "body": context, "emoji": "📊"},
            {"title": "Top Expense", "body": f"Your biggest category is {top_cats[0]['name']} at ₹{top_cats[0]['total']:.0f}" if top_cats else "No expenses this month.", "emoji": "💸"},
        ]
        return {"insights": insights, "cached": False, "method": "placeholder"}

    try:
        from groq import Groq
        client = Groq(api_key=settings.GROQ_API_KEY)
        chat = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": (
                    "You are a sharp, friendly personal finance advisor. "
                    "Given a user's monthly financial snapshot, generate 3–4 concise, actionable insights. "
                    "Format each insight as a JSON object with exactly three keys: title (≤6 words), body (1-2 sentences), emoji. "
                    "Return ONLY a valid JSON array of 3-4 insight objects."
                )},
                {"role": "user", "content": f"My financial snapshot: {context}"},
            ],
            temperature=0.4,
            max_tokens=512,
        )
        import json, re
        raw = chat.choices[0].message.content.strip()
        # Extract JSON array from response
        match = re.search(r'\[.*\]', raw, re.DOTALL)
        if match:
            insights = json.loads(match.group())
        else:
            insights = [{"title": "Insight", "body": raw[:200], "emoji": "📊"}]
    except Exception as e:
        logger.error(f"Groq API error: {e}")
        insights = [{"title": "AI Unavailable", "body": str(e), "emoji": "⚠️"}]

    # Cache result
    await db.ai_insight_cache.update_one(
        {"user_id": current_user["id"]},
        {"$set": {"insights": insights, "updated_at": datetime.utcnow(), "user_id": current_user["id"]}},
        upsert=True,
    )
    return {"insights": insights, "cached": False, "method": "groq"}


@router.post("/chat", response_model=dict)
async def ai_chat(
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Free-form financial advisor chat via Groq LLM."""
    message = body.get("message", "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")

    if not settings.GROQ_API_KEY:
        return {
            "reply": "🔑 Configure GROQ_API_KEY in your .env file to enable the AI advisor.",
            "model": "none",
        }

    try:
        from groq import Groq
        client = Groq(api_key=settings.GROQ_API_KEY)
        chat = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": (
                    "You are FinTrack AI — a friendly, concise personal finance assistant for Indian users. "
                    "Give practical, actionable advice in 2-3 sentences. Use ₹ for Indian Rupee."
                )},
                {"role": "user", "content": message},
            ],
            temperature=0.5,
            max_tokens=256,
        )
        reply = chat.choices[0].message.content.strip()
        return {"reply": reply, "model": "llama-3.3-70b-versatile"}
    except Exception as e:
        logger.error(f"Groq chat error: {e}")
        raise HTTPException(status_code=503, detail=f"AI service error: {e}")


@router.post("/retrain", response_model=dict)
async def retrain(
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Manually trigger categorizer retraining for current user."""
    async def _do_retrain():
        result = await _train_for_user(db, current_user["id"])
        logger.info(f"[AI] Manual retrain for {current_user['id']}: success={result}")

    background_tasks.add_task(_do_retrain)
    return {"status": "queued", "message": "Retraining started in background"}
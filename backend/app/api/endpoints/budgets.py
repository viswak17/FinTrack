"""
Budgets endpoint: CRUD + real-time spend tracking + vs-actual.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from datetime import datetime, timezone
from typing import List, Optional

from app.core.database import get_db
from app.api.deps import get_current_user
from app.schemas.budget import (
    BudgetCreate, BudgetUpdate, BudgetResponse, BudgetVsActualItem
)

router = APIRouter(prefix="/budgets", tags=["budgets"])


async def _compute_budget_spent(db, user_id: str, budget: dict) -> float:
    """Sum expenses for this budget's category in the budget's date range."""
    if not budget.get("category_id"):
        return 0.0

    match = {
        "user_id": user_id,
        "category_id": budget["category_id"],
        "type": "expense",
        "date": {"$gte": budget["start_date"]},
    }
    if budget.get("end_date"):
        match["date"]["$lte"] = budget["end_date"]

    pipeline = [
        {"$match": match},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]
    result = await db.transactions.aggregate(pipeline).to_list(1)
    return result[0]["total"] if result else 0.0


def _format_budget(doc: dict, spent: float = 0.0) -> BudgetResponse:
    budget_amount = doc.get("amount", 0.0)
    remaining = max(budget_amount - spent, 0.0)
    percent_used = (spent / budget_amount * 100) if budget_amount > 0 else 0.0

    return BudgetResponse(
        id=str(doc["_id"]),
        user_id=doc["user_id"],
        category_id=doc.get("category_id"),
        name=doc.get("name"),
        amount=budget_amount,
        budget_type=doc.get("budget_type", "category"),
        start_date=doc["start_date"],
        end_date=doc.get("end_date"),
        is_active=doc.get("is_active", True),
        rollover_enabled=doc.get("rollover_enabled", False),
        spent=spent,
        remaining=remaining,
        percent_used=round(percent_used, 1),
    )


@router.get("/active", response_model=List[BudgetResponse])
async def list_active_budgets(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Return currently active budgets with real-time spend computed."""
    cursor = db.budgets.find({
        "user_id": current_user["id"],
        "is_active": True,
    })

    result = []
    async for doc in cursor:
        spent = await _compute_budget_spent(db, current_user["id"], doc)
        result.append(_format_budget(doc, spent))
    return result


@router.get("/vs-actual", response_model=List[BudgetVsActualItem])
async def budget_vs_actual(
    month: Optional[str] = Query(None, description="YYYY-MM format"),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Budget vs actual spend comparison table for a given month."""
    now = datetime.now(timezone.utc)
    if month:
        year, mon = map(int, month.split("-"))
        from calendar import monthrange
        _, days = monthrange(year, mon)
        start = datetime(year, mon, 1)
        end = datetime(year, mon, days, 23, 59, 59)
    else:
        start = datetime(now.year, now.month, 1)
        end = now

    cursor = db.budgets.find({
        "user_id": current_user["id"],
        "is_active": True,
        "start_date": {"$lte": end},
    })

    result = []
    async for doc in cursor:
        category_id = doc.get("category_id")
        budget_amount = doc.get("amount", 0.0)

        # Get actual spend
        match = {
            "user_id": current_user["id"],
            "type": "expense",
            "date": {"$gte": start, "$lte": end},
        }
        if category_id:
            match["category_id"] = category_id

        pipeline = [
            {"$match": match},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
        ]
        agg = await db.transactions.aggregate(pipeline).to_list(1)
        actual = agg[0]["total"] if agg else 0.0

        variance = budget_amount - actual
        pct = (actual / budget_amount * 100) if budget_amount > 0 else 0.0
        status = "under" if pct < 80 else ("warning" if pct <= 100 else "over")

        # Get category name
        cat_name = doc.get("name", "Unknown")
        if category_id:
            cat_doc = await db.categories.find_one({"_id": ObjectId(category_id)})
            if cat_doc:
                cat_name = cat_doc["name"]

        result.append(BudgetVsActualItem(
            category_id=category_id or "",
            category_name=cat_name,
            budget_amount=budget_amount,
            actual_spent=actual,
            variance=variance,
            percent_used=round(pct, 1),
            status=status,
        ))

    return result


@router.get("/", response_model=List[BudgetResponse])
async def list_budgets(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    cursor = db.budgets.find({"user_id": current_user["id"]}).sort("created_at", -1)
    result = []
    async for doc in cursor:
        spent = await _compute_budget_spent(db, current_user["id"], doc)
        result.append(_format_budget(doc, spent))
    return result


@router.post("/", response_model=BudgetResponse, status_code=201)
async def create_budget(
    body: BudgetCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    doc = {
        "user_id": current_user["id"],
        "category_id": body.category_id,
        "name": body.name,
        "amount": body.amount,
        "budget_type": body.budget_type,
        "start_date": body.start_date,
        "end_date": body.end_date,
        "is_active": True,
        "rollover_enabled": body.rollover_enabled,
        "created_at": datetime.utcnow(),
    }
    result = await db.budgets.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _format_budget(doc)


@router.get("/{budget_id}", response_model=BudgetResponse)
async def get_budget(
    budget_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    doc = await db.budgets.find_one({
        "_id": ObjectId(budget_id),
        "user_id": current_user["id"],
    })
    if not doc:
        raise HTTPException(status_code=404, detail="Budget not found")
    spent = await _compute_budget_spent(db, current_user["id"], doc)
    return _format_budget(doc, spent)


@router.put("/{budget_id}", response_model=BudgetResponse)
async def update_budget(
    budget_id: str,
    body: BudgetUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No update fields")

    result = await db.budgets.update_one(
        {"_id": ObjectId(budget_id), "user_id": current_user["id"]},
        {"$set": updates},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Budget not found")

    doc = await db.budgets.find_one({"_id": ObjectId(budget_id)})
    spent = await _compute_budget_spent(db, current_user["id"], doc)
    return _format_budget(doc, spent)


@router.delete("/{budget_id}", status_code=204)
async def delete_budget(
    budget_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    result = await db.budgets.delete_one({
        "_id": ObjectId(budget_id),
        "user_id": current_user["id"],
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Budget not found")
    return None

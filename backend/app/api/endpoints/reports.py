"""
Reports endpoint — Phase 2.
Aggregation-based financial analytics + CSV export.
PDF export via WeasyPrint available as a future enhancement (Phase 3).
"""
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timedelta
from calendar import monthrange
from typing import Optional
from bson import ObjectId
import csv
import io

from app.core.database import get_db
from app.api.deps import get_current_user

router = APIRouter(prefix="/reports", tags=["reports"])


def _month_range(year: int, month: int):
    _, days = monthrange(year, month)
    return datetime(year, month, 1), datetime(year, month, days, 23, 59, 59)


@router.get("/summary")
async def monthly_summary(
    year: int  = Query(default=None),
    month: int = Query(default=None),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Income vs Expense summary for a given month (current month if not specified)."""
    now = datetime.utcnow()
    year  = year  or now.year
    month = month or now.month
    start, end = _month_range(year, month)

    pipeline = [
        {"$match": {
            "user_id": current_user["id"],
            "date":    {"$gte": start, "$lte": end},
            "type":    {"$in": ["income", "expense"]},
        }},
        {"$group": {
            "_id":   "$type",
            "total": {"$sum": "$amount"},
            "count": {"$sum": 1},
        }},
    ]
    raw = await db.transactions.aggregate(pipeline).to_list(10)
    result = {r["_id"]: {"total": r["total"], "count": r["count"]} for r in raw}

    income   = result.get("income",  {}).get("total", 0.0)
    expense  = result.get("expense", {}).get("total", 0.0)
    savings  = income - expense
    rate     = round(savings / income * 100, 1) if income > 0 else 0.0

    return {
        "year": year, "month": month,
        "income":        income,
        "expense":       expense,
        "savings":       savings,
        "savings_rate":  rate,
        "tx_count_income":  result.get("income",  {}).get("count", 0),
        "tx_count_expense": result.get("expense", {}).get("count", 0),
    }


@router.get("/category-breakdown")
async def category_breakdown(
    year:  int = Query(default=None),
    month: int = Query(default=None),
    type:  str = Query(default="expense"),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Spending by category for a given month — pie chart data."""
    now = datetime.utcnow()
    year  = year  or now.year
    month = month or now.month
    start, end = _month_range(year, month)

    pipeline = [
        {"$match": {
            "user_id":     current_user["id"],
            "date":        {"$gte": start, "$lte": end},
            "type":        type,
            "category_id": {"$ne": None},
        }},
        {"$group": {
            "_id":   "$category_id",
            "total": {"$sum": "$amount"},
            "count": {"$sum": 1},
        }},
        {"$sort": {"total": -1}},
    ]
    rows = await db.transactions.aggregate(pipeline).to_list(50)

    # Look up category names
    result = []
    for row in rows:
        cat_id = row["_id"]
        cat = await db.categories.find_one({"_id": ObjectId(cat_id)}) if cat_id and ObjectId.is_valid(str(cat_id)) else None
        result.append({
            "category_id":   cat_id,
            "category_name": cat["name"] if cat else "Uncategorized",
            "emoji":         cat.get("emoji", "📂") if cat else "📂",
            "color":         cat.get("color", "#6366F1") if cat else "#6366F1",
            "total":         row["total"],
            "count":         row["count"],
        })

    grand_total = sum(r["total"] for r in result)
    for r in result:
        r["percent"] = round(r["total"] / grand_total * 100, 1) if grand_total else 0

    return {"year": year, "month": month, "type": type, "items": result, "grand_total": grand_total}


@router.get("/monthly-trend")
async def monthly_trend(
    months: int = Query(default=6, ge=1, le=24),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Income vs expense for last N months — line chart data."""
    now = datetime.utcnow()
    result = []

    for i in range(months - 1, -1, -1):
        # Calculate target month
        target = now.replace(day=1) - timedelta(days=i * 28)
        y, m = target.year, target.month
        start, end = _month_range(y, m)

        pipeline = [
            {"$match": {
                "user_id": current_user["id"],
                "date":    {"$gte": start, "$lte": end},
                "type":    {"$in": ["income", "expense"]},
            }},
            {"$group": {"_id": "$type", "total": {"$sum": "$amount"}}},
        ]
        raw = await db.transactions.aggregate(pipeline).to_list(5)
        by_type = {r["_id"]: r["total"] for r in raw}

        result.append({
            "year":    y,
            "month":   m,
            "label":   f"{y}-{m:02d}",
            "income":  by_type.get("income",  0.0),
            "expense": by_type.get("expense", 0.0),
            "savings": by_type.get("income", 0.0) - by_type.get("expense", 0.0),
        })

    return result


@router.get("/daily-spend")
async def daily_spend(
    year:  int = Query(default=None),
    month: int = Query(default=None),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Daily spending for a month — bar chart data."""
    now = datetime.utcnow()
    year  = year  or now.year
    month = month or now.month
    start, end = _month_range(year, month)

    pipeline = [
        {"$match": {
            "user_id": current_user["id"],
            "date":    {"$gte": start, "$lte": end},
            "type":    "expense",
        }},
        {"$group": {
            "_id":   {"$dayOfMonth": "$date"},
            "total": {"$sum": "$amount"},
            "count": {"$sum": 1},
        }},
        {"$sort": {"_id": 1}},
    ]
    raw = await db.transactions.aggregate(pipeline).to_list(31)
    by_day = {r["_id"]: r for r in raw}

    _, days_in_month = monthrange(year, month)
    result = []
    for day in range(1, days_in_month + 1):
        d = by_day.get(day, {"total": 0.0, "count": 0})
        result.append({"day": day, "label": f"{year}-{month:02d}-{day:02d}",
                        "total": d["total"], "count": d["count"]})
    return result


@router.get("/top-merchants")
async def top_merchants(
    months: int = Query(default=1),
    limit:  int = Query(default=10),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Top spending merchants/payees."""
    since = datetime.utcnow() - timedelta(days=months * 30)
    pipeline = [
        {"$match": {
            "user_id": current_user["id"],
            "type":    "expense",
            "date":    {"$gte": since},
            "payee":   {"$ne": None, "$gt": ""},
        }},
        {"$group": {
            "_id":   "$payee",
            "total": {"$sum": "$amount"},
            "count": {"$sum": 1},
        }},
        {"$sort": {"total": -1}},
        {"$limit": limit},
    ]
    raw = await db.transactions.aggregate(pipeline).to_list(limit)
    return [{"payee": r["_id"], "total": r["total"], "count": r["count"]} for r in raw]


@router.get("/export/csv")
async def export_csv(
    start_date: Optional[str] = None,
    end_date:   Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Download transactions as CSV."""
    query = {"user_id": current_user["id"]}
    if start_date:
        query.setdefault("date", {})["$gte"] = datetime.fromisoformat(start_date)
    if end_date:
        query.setdefault("date", {})["$lte"] = datetime.fromisoformat(end_date)

    cursor = db.transactions.find(query).sort("date", -1)

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=[
        "date", "type", "amount", "currency", "payee", "description",
        "category_id", "account_id", "tags", "notes",
    ])
    writer.writeheader()

    async for tx in cursor:
        writer.writerow({
            "date":        tx.get("date", "").isoformat() if tx.get("date") else "",
            "type":        tx.get("type", ""),
            "amount":      tx.get("amount", 0),
            "currency":    tx.get("currency", "INR"),
            "payee":       tx.get("payee", ""),
            "description": tx.get("description", ""),
            "category_id": tx.get("category_id", ""),
            "account_id":  tx.get("account_id", ""),
            "tags":        ",".join(tx.get("tags", [])),
            "notes":       tx.get("notes", ""),
        })

    output.seek(0)
    filename = f"fintrack_export_{datetime.utcnow().date()}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )

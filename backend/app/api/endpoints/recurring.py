"""
Recurring Transactions endpoint — Phase 2.
CRUD for recurring rules + manual trigger.
The background task (APScheduler) processes due rules daily.
"""
from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from datetime import datetime, timedelta
from typing import List, Optional

from app.core.database import get_db
from app.api.deps import get_current_user

router = APIRouter(prefix="/recurring", tags=["recurring"])

FREQUENCY_DAYS = {
    "daily": 1, "weekly": 7, "fortnightly": 14,
    "monthly": 30, "quarterly": 91, "yearly": 365,
}


def _next_due(last_due: datetime, frequency: str, interval: int = 1) -> datetime:
    days = FREQUENCY_DAYS.get(frequency, 30) * interval
    return last_due + timedelta(days=days)


def _fmt(doc: dict) -> dict:
    return {
        "id":            str(doc["_id"]),
        "user_id":       doc["user_id"],
        "account_id":    doc.get("account_id"),
        "category_id":   doc.get("category_id"),
        "name":          doc.get("name"),
        "type":          doc.get("type", "expense"),
        "amount":        doc.get("amount", 0.0),
        "currency":      doc.get("currency", "INR"),
        "frequency":     doc.get("frequency", "monthly"),
        "interval":      doc.get("interval", 1),
        "start_date":    doc.get("start_date"),
        "end_date":      doc.get("end_date"),
        "next_due":      doc.get("next_due"),
        "last_processed":doc.get("last_processed"),
        "is_active":     doc.get("is_active", True),
        "description":   doc.get("description"),
        "payee":         doc.get("payee"),
        "remind_days_before": doc.get("remind_days_before", 0),
        "created_at":    doc.get("created_at"),
    }


@router.get("/", response_model=List[dict])
async def list_recurring(
    active_only: bool = True,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    query = {"user_id": current_user["id"]}
    if active_only:
        query["is_active"] = True
    cursor = db.recurring_rules.find(query).sort("next_due", 1)
    return [_fmt(d) async for d in cursor]


@router.post("/", response_model=dict, status_code=201)
async def create_recurring(
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    # Validate account
    account = await db.accounts.find_one({
        "_id": ObjectId(body["account_id"]),
        "user_id": current_user["id"],
    })
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    start = datetime.fromisoformat(body.get("start_date", datetime.utcnow().isoformat()))
    doc = {
        "user_id":            current_user["id"],
        "account_id":         body["account_id"],
        "category_id":        body.get("category_id"),
        "name":               body.get("name"),
        "type":               body.get("type", "expense"),
        "amount":             float(body.get("amount", 0)),
        "currency":           body.get("currency", "INR"),
        "frequency":          body.get("frequency", "monthly"),
        "interval":           int(body.get("interval", 1)),
        "start_date":         start,
        "end_date":           datetime.fromisoformat(body["end_date"]) if body.get("end_date") else None,
        "next_due":           start,
        "last_processed":     None,
        "is_active":          True,
        "description":        body.get("description"),
        "payee":              body.get("payee"),
        "remind_days_before": int(body.get("remind_days_before", 0)),
        "created_at":         datetime.utcnow(),
    }
    r = await db.recurring_rules.insert_one(doc)
    doc["_id"] = r.inserted_id
    return _fmt(doc)


@router.get("/{rule_id}", response_model=dict)
async def get_recurring(
    rule_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    doc = await db.recurring_rules.find_one({
        "_id": ObjectId(rule_id), "user_id": current_user["id"],
    })
    if not doc:
        raise HTTPException(status_code=404, detail="Recurring rule not found")
    return _fmt(doc)


@router.put("/{rule_id}", response_model=dict)
async def update_recurring(
    rule_id: str,
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    allowed = {"name", "amount", "frequency", "interval", "category_id",
               "description", "payee", "remind_days_before", "is_active", "end_date"}
    updates = {k: v for k, v in body.items() if k in allowed}
    if not updates:
        raise HTTPException(status_code=400, detail="No valid fields")
    if "amount" in updates:
        updates["amount"] = float(updates["amount"])
    if "end_date" in updates and updates["end_date"]:
        updates["end_date"] = datetime.fromisoformat(updates["end_date"])

    result = await db.recurring_rules.update_one(
        {"_id": ObjectId(rule_id), "user_id": current_user["id"]},
        {"$set": updates},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Recurring rule not found")
    doc = await db.recurring_rules.find_one({"_id": ObjectId(rule_id)})
    return _fmt(doc)


@router.delete("/{rule_id}", status_code=204)
async def delete_recurring(
    rule_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    result = await db.recurring_rules.delete_one({
        "_id": ObjectId(rule_id), "user_id": current_user["id"],
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Recurring rule not found")
    return None


@router.post("/{rule_id}/process-now", response_model=dict)
async def process_now(
    rule_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Manually trigger a recurring rule — creates the transaction immediately."""
    rule = await db.recurring_rules.find_one({
        "_id": ObjectId(rule_id), "user_id": current_user["id"],
    })
    if not rule:
        raise HTTPException(status_code=404, detail="Recurring rule not found")

    # Create transaction
    tx = {
        "user_id":      rule["user_id"],
        "account_id":   rule["account_id"],
        "category_id":  rule.get("category_id"),
        "type":         rule["type"],
        "amount":       rule["amount"],
        "currency":     rule.get("currency", "INR"),
        "fx_rate":      1.0,
        "date":         datetime.utcnow(),
        "description":  rule.get("description") or rule.get("name"),
        "payee":        rule.get("payee"),
        "tags":         ["recurring"],
        "recurring_id": rule_id,
        "is_split":     False,
        "hash":         f"rec_{rule_id}_{datetime.utcnow().date()}",
        "created_at":   datetime.utcnow(),
    }
    await db.transactions.insert_one(tx)

    # Update account balance
    if rule["type"] == "expense":
        await db.accounts.update_one(
            {"_id": ObjectId(rule["account_id"])},
            {"$inc": {"current_balance": -rule["amount"]}},
        )
    elif rule["type"] == "income":
        await db.accounts.update_one(
            {"_id": ObjectId(rule["account_id"])},
            {"$inc": {"current_balance": rule["amount"]}},
        )

    # Advance next_due
    next_due = _next_due(rule.get("next_due", datetime.utcnow()), rule["frequency"], rule.get("interval", 1))
    await db.recurring_rules.update_one(
        {"_id": ObjectId(rule_id)},
        {"$set": {"last_processed": datetime.utcnow(), "next_due": next_due}},
    )

    doc = await db.recurring_rules.find_one({"_id": ObjectId(rule_id)})
    return _fmt(doc)

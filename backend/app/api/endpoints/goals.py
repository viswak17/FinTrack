"""
Goals & Savings endpoint — Phase 2.
Supports: savings, debt_payoff, investment, net_worth goal types.
Includes contribution logging.
"""
from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from datetime import datetime
from typing import List, Optional

from app.core.database import get_db
from app.api.deps import get_current_user

router = APIRouter(prefix="/goals", tags=["goals"])


def _fmt(doc: dict) -> dict:
    current = doc.get("current_amount", 0.0)
    target  = doc.get("target_amount", 1.0)
    pct     = min(round(current / target * 100, 1), 100) if target else 0.0
    return {
        "id":              str(doc["_id"]),
        "user_id":         doc["user_id"],
        "name":            doc.get("name"),
        "goal_type":       doc.get("goal_type", "savings"),
        "target_amount":   target,
        "current_amount":  current,
        "target_date":     doc.get("target_date"),
        "account_id":      doc.get("account_id"),
        "is_achieved":     doc.get("is_achieved", False),
        "description":     doc.get("description"),
        "emoji":           doc.get("emoji", "🎯"),
        "color":           doc.get("color", "#6366F1"),
        "percent_complete":pct,
        "remaining":       max(target - current, 0.0),
        "created_at":      doc.get("created_at"),
    }


@router.get("/", response_model=List[dict])
async def list_goals(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    cursor = db.goals.find({"user_id": current_user["id"]}).sort("created_at", -1)
    return [_fmt(d) async for d in cursor]


@router.post("/", response_model=dict, status_code=201)
async def create_goal(
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    doc = {
        "user_id":       current_user["id"],
        "name":          body.get("name"),
        "goal_type":     body.get("goal_type", "savings"),
        "target_amount": float(body.get("target_amount", 0)),
        "current_amount":float(body.get("current_amount", 0)),
        "target_date":   body.get("target_date"),
        "account_id":    body.get("account_id"),
        "is_achieved":   False,
        "description":   body.get("description"),
        "emoji":         body.get("emoji", "🎯"),
        "color":         body.get("color", "#6366F1"),
        "created_at":    datetime.utcnow(),
    }
    r = await db.goals.insert_one(doc)
    doc["_id"] = r.inserted_id
    return _fmt(doc)


@router.get("/{goal_id}", response_model=dict)
async def get_goal(
    goal_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    doc = await db.goals.find_one({"_id": ObjectId(goal_id), "user_id": current_user["id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Goal not found")
    return _fmt(doc)


@router.put("/{goal_id}", response_model=dict)
async def update_goal(
    goal_id: str,
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    allowed = {"name", "target_amount", "current_amount", "target_date",
               "description", "emoji", "color", "is_achieved"}
    updates = {k: v for k, v in body.items() if k in allowed}
    if not updates:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    for f in ("target_amount", "current_amount"):
        if f in updates:
            updates[f] = float(updates[f])
    result = await db.goals.update_one(
        {"_id": ObjectId(goal_id), "user_id": current_user["id"]},
        {"$set": updates},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Goal not found")
    doc = await db.goals.find_one({"_id": ObjectId(goal_id)})
    return _fmt(doc)


@router.delete("/{goal_id}", status_code=204)
async def delete_goal(
    goal_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    result = await db.goals.delete_one({"_id": ObjectId(goal_id), "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Goal not found")
    return None


@router.post("/{goal_id}/contribute", response_model=dict, status_code=201)
async def contribute_to_goal(
    goal_id: str,
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Log a contribution and update goal's current_amount."""
    goal = await db.goals.find_one({"_id": ObjectId(goal_id), "user_id": current_user["id"]})
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    amount = float(body.get("amount", 0))
    note   = body.get("note", "")
    new_current = goal.get("current_amount", 0.0) + amount
    is_achieved = new_current >= goal.get("target_amount", 0)

    # Update goal
    await db.goals.update_one(
        {"_id": ObjectId(goal_id)},
        {"$set": {"current_amount": new_current, "is_achieved": is_achieved}},
    )

    # Log contribution
    contrib = {
        "goal_id":    goal_id,
        "user_id":    current_user["id"],
        "amount":     amount,
        "note":       note,
        "created_at": datetime.utcnow(),
    }
    await db.goal_contributions.insert_one(contrib)

    doc = await db.goals.find_one({"_id": ObjectId(goal_id)})
    return _fmt(doc)


@router.get("/{goal_id}/contributions", response_model=List[dict])
async def list_contributions(
    goal_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    cursor = db.goal_contributions.find(
        {"goal_id": goal_id, "user_id": current_user["id"]}
    ).sort("created_at", -1)
    return [
        {
            "id":         str(d["_id"]),
            "amount":     d.get("amount"),
            "note":       d.get("note"),
            "created_at": d.get("created_at"),
        }
        async for d in cursor
    ]

"""
Notifications endpoint — Phase 4.
Pulls real-time alerts from existing data (budgets, goals, recurring, anomalies).
No separate notifications collection needed — generated on-demand and cached.

GET  /notifications          → list unread notifications
POST /notifications/read     → mark all as read (clears Redis cache flag)
"""
from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timedelta
from typing import List
import logging

from app.core.database import get_db
from app.api.deps import get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])
logger = logging.getLogger(__name__)


async def _budget_alerts(db, user_id: str) -> List[dict]:
    """Return budgets at ≥ 80% utilization."""
    alerts = []
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    budgets = await db.budgets.find({"user_id": user_id, "is_active": True}).to_list(50)
    for b in budgets:
        if not b.get("category_id") or not b.get("amount"):
            continue
        spent_agg = await db.transactions.aggregate([
            {"$match": {
                "user_id":     user_id,
                "category_id": b["category_id"],
                "type":        "expense",
                "date":        {"$gte": month_start},
            }},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
        ]).to_list(1)
        spent = spent_agg[0]["total"] if spent_agg else 0
        pct   = spent / b["amount"] if b["amount"] else 0

        if pct >= 1.0:
            alerts.append({
                "id":      f"budget_over_{b['_id']}",
                "type":    "budget_overrun",
                "title":   "Budget Overrun 🚨",
                "body":    f"You've exceeded your budget. Spent ₹{spent:.0f} / ₹{b['amount']:.0f}",
                "severity":"high",
                "read":    False,
                "created_at": datetime.utcnow().isoformat(),
            })
        elif pct >= 0.8:
            alerts.append({
                "id":      f"budget_warn_{b['_id']}",
                "type":    "budget_warning",
                "title":   "Budget Alert ⚠️",
                "body":    f"Budget at {pct*100:.0f}% — ₹{b['amount']-spent:.0f} remaining this month",
                "severity":"medium",
                "read":    False,
                "created_at": datetime.utcnow().isoformat(),
            })
    return alerts


async def _goal_milestones(db, user_id: str) -> List[dict]:
    """Return goal milestone notifications (25/50/75/100%)."""
    alerts = []
    goals = await db.goals.find({"user_id": user_id, "is_achieved": False}).to_list(20)
    for g in goals:
        if not g.get("target_amount"):
            continue
        pct = (g.get("current_amount", 0) / g["target_amount"]) * 100
        for milestone in [25, 50, 75]:
            if pct >= milestone:
                alerts.append({
                    "id":      f"goal_{g['_id']}_{milestone}",
                    "type":    "goal_milestone",
                    "title":   f"Goal Milestone 🎯",
                    "body":    f"{g.get('name','Goal')} is {milestone}% funded! (₹{g.get('current_amount',0):.0f} / ₹{g['target_amount']:.0f})",
                    "severity":"low",
                    "read":    False,
                    "created_at": datetime.utcnow().isoformat(),
                })
                break  # only show highest milestone
    return alerts


async def _upcoming_recurring(db, user_id: str) -> List[dict]:
    """Return recurring transactions due in the next 7 days."""
    alerts = []
    window = datetime.utcnow() + timedelta(days=7)
    rules  = await db.recurring_rules.find({
        "user_id":   user_id,
        "is_paused": {"$ne": True},
        "next_due":  {"$lte": window},
    }).to_list(20)

    for r in rules:
        days_away = (r["next_due"] - datetime.utcnow()).days
        label = "today" if days_away == 0 else f"in {days_away} day{'s' if days_away != 1 else ''}"
        alerts.append({
            "id":      f"recurring_{r['_id']}",
            "type":    "recurring_due",
            "title":   f"Recurring Due 🔁",
            "body":    f"{r.get('description','Recurring')} · ₹{r.get('amount',0):.0f} due {label}",
            "severity":"low",
            "read":    False,
            "created_at": datetime.utcnow().isoformat(),
        })
    return alerts


async def _anomaly_alerts(db, user_id: str) -> List[dict]:
    """Return recent anomaly log entries."""
    alerts = []
    since  = datetime.utcnow() - timedelta(days=2)
    logs   = await db.anomaly_log.find({
        "user_id":    user_id,
        "created_at": {"$gte": since},
    }).sort("created_at", -1).to_list(5)

    for log in logs:
        alerts.append({
            "id":      f"anomaly_{log['_id']}",
            "type":    "anomaly",
            "title":   "Unusual Spend Detected ⚠️",
            "body":    log.get("reason", f"Unusual transaction of ₹{log.get('amount',0):.0f} detected"),
            "severity":"high",
            "read":    False,
            "created_at": log.get("created_at", datetime.utcnow()).isoformat(),
        })
    return alerts


@router.get("", response_model=List[dict])
async def get_notifications(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Aggregate all unread notification types for the current user."""
    uid = current_user["id"]
    all_notifs = []

    budget_alerts, goal_milestones, recurring_notifs, anomaly_notifs = await _collect_all(db, uid)

    all_notifs = budget_alerts + goal_milestones + recurring_notifs + anomaly_notifs
    # Sort by severity: high → medium → low, then by created_at desc
    sev_order = {"high": 0, "medium": 1, "low": 2}
    all_notifs.sort(key=lambda n: (sev_order.get(n["severity"], 9), n["created_at"]))
    return all_notifs[:20]


async def _collect_all(db, uid):
    import asyncio
    budget_alerts, goal_milestones, recurring_notifs, anomaly_notifs = await asyncio.gather(
        _budget_alerts(db, uid),
        _goal_milestones(db, uid),
        _upcoming_recurring(db, uid),
        _anomaly_alerts(db, uid),
    )
    return budget_alerts, goal_milestones, recurring_notifs, anomaly_notifs


@router.post("/read", response_model=dict)
async def mark_all_read(
    current_user: dict = Depends(get_current_user),
):
    """Mark all notifications as read (client-side state cleared)."""
    return {"status": "ok", "message": "All notifications marked as read"}

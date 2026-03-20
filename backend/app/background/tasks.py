"""
APScheduler background tasks — Phase 2 real implementations.
Jobs run INSIDE the FastAPI process (no separate worker needed).
"""
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def _get_db():
    """Import the live db object from the database module."""
    from app.core.database import db
    return db


async def process_recurring_transactions():
    """
    Daily 08:00 — Create transactions for any recurring rules that are due today.
    Updates account balances and advances next_due date.
    """
    from bson import ObjectId
    from calendar import monthrange

    db = await _get_db()
    if db is None:
        logger.warning("[CRON] Database not ready, skipping recurring processor")
        return

    now = datetime.utcnow()
    today_end = now.replace(hour=23, minute=59, second=59)

    cursor = db.recurring_rules.find({
        "is_active": True,
        "next_due":  {"$lte": today_end},
    })

    processed = 0
    async for rule in cursor:
        try:
            # Skip if end_date has passed
            if rule.get("end_date") and rule["end_date"] < now:
                await db.recurring_rules.update_one(
                    {"_id": rule["_id"]}, {"$set": {"is_active": False}}
                )
                continue

            # Create the transaction
            tx = {
                "user_id":      rule["user_id"],
                "account_id":   rule["account_id"],
                "category_id":  rule.get("category_id"),
                "type":         rule["type"],
                "amount":       rule["amount"],
                "currency":     rule.get("currency", "INR"),
                "fx_rate":      1.0,
                "date":         now,
                "description":  rule.get("description") or rule.get("name"),
                "payee":        rule.get("payee"),
                "tags":         ["recurring", "auto-generated"],
                "recurring_id": str(rule["_id"]),
                "is_split":     False,
                "hash":         f"rec_{rule['_id']}_{now.date()}",
                "created_at":   now,
            }

            # Check hash dedup
            existing = await db.transactions.find_one({"hash": tx["hash"]})
            if existing:
                continue

            await db.transactions.insert_one(tx)

            # Update account balance
            delta = rule["amount"] if rule["type"] == "income" else -rule["amount"]
            await db.accounts.update_one(
                {"_id": ObjectId(rule["account_id"])},
                {"$inc": {"current_balance": delta}},
            )

            # Advance next_due
            freq_days = {
                "daily": 1, "weekly": 7, "fortnightly": 14,
                "monthly": 30, "quarterly": 91, "yearly": 365,
            }
            days = freq_days.get(rule.get("frequency", "monthly"), 30) * rule.get("interval", 1)
            next_due = rule["next_due"] + timedelta(days=days)

            await db.recurring_rules.update_one(
                {"_id": rule["_id"]},
                {"$set": {"last_processed": now, "next_due": next_due}},
            )
            processed += 1

        except Exception as e:
            logger.error(f"[CRON] Error processing rule {rule.get('_id')}: {e}")

    logger.info(f"[CRON] Recurring processor: {processed} transactions created")


async def send_budget_alerts():
    """
    Daily 09:00 — Check budgets >80% spent and log alerts.
    """
    from datetime import timezone

    db = await _get_db()
    if db is None:
        return

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    cursor = db.budgets.find({"is_active": True})
    alerts = []
    async for budget in cursor:
        if not budget.get("category_id"):
            continue
        pipeline = [
            {"$match": {
                "user_id":     budget["user_id"],
                "category_id": budget["category_id"],
                "type":        "expense",
                "date":        {"$gte": start},
            }},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
        ]
        result = await db.transactions.aggregate(pipeline).to_list(1)
        spent = result[0]["total"] if result else 0.0
        pct = spent / budget["amount"] * 100 if budget["amount"] > 0 else 0.0

        if pct >= 80:
            level = "over" if pct > 100 else "warning"
            alerts.append({
                "user_id":     budget["user_id"],
                "budget_id":   str(budget["_id"]),
                "budget_name": budget.get("name", "Budget"),
                "percent":     round(pct, 1),
                "level":       level,
                "created_at":  now,
            })

    if alerts:
        await db.budget_alert_log.insert_many(alerts)
        logger.info(f"[CRON] Budget alerts: {len(alerts)} alerts created")


async def refresh_fx_cache():
    """
    Hourly — pre-warm Redis FX rate cache for INR and USD bases.
    """
    try:
        from app.api.endpoints.currency import _fetch_rates
        for base in ["USD", "INR"]:
            await _fetch_rates(base)
        logger.info("[CRON] FX cache refreshed")
    except Exception as e:
        logger.warning(f"[CRON] FX refresh failed: {e}")


async def retrain_categorizer():
    """Weekly Sunday midnight — Retrain personal ML categorizer for all active users."""
    db = await _get_db()
    if not db:
        return

    from app.api.endpoints.ai import _train_for_user
    users = await db.users.find({}, {"_id": 1}).to_list(1000)
    for u in users:
        try:
            await _train_for_user(db, str(u["_id"]))
        except Exception as e:
            logger.error(f"[CRON] Categorizer retrain failed for {u['_id']}: {e}")
    logger.info(f"[CRON] Categorizer retraining complete for {len(users)} users")


async def retrain_prophet():
    """Weekly Sunday 00:30 — Pre-calculate Prophet forecasts for all users."""
    db = await _get_db()
    if not db:
        return

    from app.ml.forecaster import forecaster
    users = await db.users.find({}, {"_id": 1}).to_list(1000)
    for u in users:
        try:
            await forecaster.forecast(db, str(u["_id"]))
        except Exception as e:
            logger.error(f"[CRON] Prophet retrain failed for {u['_id']}: {e}")
    logger.info(f"[CRON] Prophet forecasting complete for {len(users)} users")


def start_scheduler():
    """Start APScheduler with all registered cron jobs."""
    scheduler.add_job(process_recurring_transactions, "cron", hour=8,  minute=0,  id="recurring")
    scheduler.add_job(send_budget_alerts,             "cron", hour=9,  minute=0,  id="budget_alerts")
    scheduler.add_job(refresh_fx_cache,               "cron", minute=0,           id="fx_cache")
    scheduler.add_job(retrain_categorizer, "cron", day_of_week="sun", hour=0, minute=0,  id="ml_cat")
    scheduler.add_job(retrain_prophet,     "cron", day_of_week="sun", hour=0, minute=30, id="ml_prophet")
    scheduler.start()
    logger.info("✅ APScheduler started — 5 cron jobs registered")


def stop_scheduler():
    scheduler.shutdown()
    logger.info("APScheduler stopped.")

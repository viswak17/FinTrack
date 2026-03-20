"""
ML Model Store — Phase 3.
Persists trained models to MongoDB (GridFS-style via binary field) and
provides async load/save helpers used by the retraining cron job.
"""
import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)


class ModelStore:
    """Load and persist ML models to/from MongoDB ml_models collection."""

    async def save_categorizer(self, db, user_id: str, model_bytes: bytes) -> str:
        """Upsert a categorizer model for a user."""
        result = await db.ml_models.update_one(
            {"user_id": user_id, "model_type": "categorizer"},
            {
                "$set": {
                    "user_id":    user_id,
                    "model_type": "categorizer",
                    "model_data": model_bytes,
                    "updated_at": datetime.utcnow(),
                    "is_active":  True,
                    "version":    1,
                }
            },
            upsert=True,
        )
        logger.info(f"[ModelStore] Saved categorizer for user {user_id}")
        return str(result.upserted_id or "updated")

    async def load_categorizer(self, db, user_id: str) -> Optional[bytes]:
        """Load the active categorizer model bytes for a user, or None."""
        doc = await db.ml_models.find_one(
            {"user_id": user_id, "model_type": "categorizer", "is_active": True},
            sort=[("updated_at", -1)],
        )
        return doc["model_data"] if doc else None

    async def save_forecast(self, db, user_id: str, forecast_json: dict) -> None:
        """Cache a Prophet forecast result for a user."""
        await db.ml_forecasts.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "user_id":    user_id,
                    "forecast":   forecast_json,
                    "updated_at": datetime.utcnow(),
                }
            },
            upsert=True,
        )

    async def load_forecast(self, db, user_id: str) -> Optional[dict]:
        """Load cached forecast, return None if older than 24h."""
        from datetime import timedelta
        doc = await db.ml_forecasts.find_one({"user_id": user_id})
        if not doc:
            return None
        age = (datetime.utcnow() - doc["updated_at"]).total_seconds()
        return doc["forecast"] if age < 86400 else None  # 24h TTL


# Singleton
model_store = ModelStore()

"""
Prophet Spend Forecaster — Phase 3.
Uses Meta Prophet to forecast next 30 days of spending per user.
Falls back to a simple 90-day moving average if Prophet is unavailable.
"""
import logging
from datetime import datetime, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

FORECAST_DAYS = 30
MIN_POINTS    = 10  # minimum data points for Prophet


def _moving_average_forecast(series: list[dict], days: int = FORECAST_DAYS) -> list[dict]:
    """Simple 7-day moving average fallback when Prophet isn't available."""
    if not series:
        return []
    amounts = [p["y"] for p in series]
    avg = sum(amounts[-7:]) / min(len(amounts[-7:]), 1)

    last_date = datetime.fromisoformat(series[-1]["ds"])
    result = []
    for i in range(1, days + 1):
        dt = last_date + timedelta(days=i)
        result.append({
            "ds":    dt.isoformat(),
            "yhat":  round(avg, 2),
            "yhat_lower": round(avg * 0.7, 2),
            "yhat_upper": round(avg * 1.3, 2),
        })
    return result


class SpendForecaster:
    """Async spend forecaster using Prophet or moving-average fallback."""

    async def build_series(self, db, user_id: str) -> list[dict]:
        """Aggregate daily spend from transactions into a Prophet-ready series."""
        since = datetime.utcnow() - timedelta(days=180)
        pipeline = [
            {"$match": {
                "user_id": user_id,
                "type":    "expense",
                "date":    {"$gte": since},
            }},
            {"$group": {
                "_id":   {
                    "$dateToString": {"format": "%Y-%m-%d", "date": "$date"}
                },
                "total": {"$sum": "$amount"},
            }},
            {"$sort": {"_id": 1}},
        ]
        raw = await db.transactions.aggregate(pipeline).to_list(180)
        return [{"ds": r["_id"], "y": r["total"]} for r in raw]

    def _prophet_forecast(self, series: list[dict]) -> list[dict]:
        try:
            import pandas as pd
            from prophet import Prophet  # type: ignore

            df = pd.DataFrame(series)
            df["ds"] = pd.to_datetime(df["ds"])
            df["y"]  = df["y"].astype(float)

            m = Prophet(
                daily_seasonality=False,
                weekly_seasonality=True,
                yearly_seasonality=False,
                changepoint_prior_scale=0.15,
            )
            m.fit(df)

            future = m.make_future_dataframe(periods=FORECAST_DAYS)
            forecast = m.predict(future)

            result = forecast.tail(FORECAST_DAYS)[["ds", "yhat", "yhat_lower", "yhat_upper"]].copy()
            result["yhat"]       = result["yhat"].clip(lower=0).round(2)
            result["yhat_lower"] = result["yhat_lower"].clip(lower=0).round(2)
            result["yhat_upper"] = result["yhat_upper"].clip(lower=0).round(2)
            result["ds"] = result["ds"].dt.strftime("%Y-%m-%d")

            return result.to_dict("records")
        except ImportError:
            logger.warning("Prophet not installed, using moving average fallback")
            return None
        except Exception as e:
            logger.error(f"Prophet forecast error: {e}")
            return None

    async def forecast(self, db, user_id: str) -> dict:
        """
        Build a 30-day spend forecast.
        Returns: {series, forecast, total_predicted, method}
        """
        from app.ml.model_store import model_store

        # Check cache
        cached = await model_store.load_forecast(db, user_id)
        if cached:
            return cached

        series = await self.build_series(db, user_id)

        if len(series) < MIN_POINTS:
            daily_avg = sum(p["y"] for p in series) / max(len(series), 1) if series else 0.0
            forecast_points = []
            last = datetime.utcnow()
            for i in range(1, FORECAST_DAYS + 1):
                dt = last + timedelta(days=i)
                forecast_points.append({
                    "ds":         dt.strftime("%Y-%m-%d"),
                    "yhat":       round(daily_avg, 2),
                    "yhat_lower": round(daily_avg * 0.7, 2),
                    "yhat_upper": round(daily_avg * 1.3, 2),
                })
            result = {
                "series":          series,
                "forecast":        forecast_points,
                "total_predicted": round(sum(p["yhat"] for p in forecast_points), 2),
                "method":          "simple_average",
                "note":            f"Need {MIN_POINTS} days of data for Prophet. Using average for now.",
            }
        else:
            # Try Prophet first, fallback to moving average
            forecast_points = self._prophet_forecast(series)
            if forecast_points is None:
                forecast_points = _moving_average_forecast(series)
                method = "moving_average"
            else:
                method = "prophet"

            result = {
                "series":          series,
                "forecast":        forecast_points,
                "total_predicted": round(sum(p["yhat"] for p in forecast_points), 2),
                "method":          method,
            }

        # Cache result
        await model_store.save_forecast(db, user_id, result)
        return result


# Singleton
forecaster = SpendForecaster()

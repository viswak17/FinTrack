"""
FinTrack FastAPI application entrypoint.

Startup sequence:
  1. Connect to MongoDB Atlas (Motor async client)
  2. Create MongoDB indexes
  3. Connect to Redis
  4. Start APScheduler (cron jobs for ML retraining + recurring)
  5. Mount all API routes

Shutdown:
  1. Stop APScheduler
  2. Close Redis
  3. Close MongoDB
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.core.config import settings
from app.core.database import connect_to_mongo, close_mongo_connection
from app.core.redis import connect_to_redis, close_redis_connection
from app.background.tasks import start_scheduler, stop_scheduler
from app.api.router import api_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application startup and shutdown lifecycle."""
    # ── Startup ───────────────────────────────────────────────────────────
    logger.info("🚀 FinTrack backend starting up...")
    await connect_to_mongo()
    await connect_to_redis()
    start_scheduler()
    logger.info("✅ All services connected. FinTrack is ready.")

    yield   # Application is running

    # ── Shutdown ──────────────────────────────────────────────────────────
    logger.info("🛑 FinTrack backend shutting down...")
    stop_scheduler()
    await close_redis_connection()
    await close_mongo_connection()
    logger.info("✅ Shutdown complete.")


app = FastAPI(
    title="FinTrack API",
    description="Personal Finance Operating System — FastAPI backend",
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ────────────────────────────────────────────────────────────────────
app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    """Health check endpoint for load balancer / uptime monitoring."""
    return {"status": "ok", "version": settings.APP_VERSION, "app": settings.APP_NAME}

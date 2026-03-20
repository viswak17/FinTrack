from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import IndexModel, ASCENDING, DESCENDING
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

client: AsyncIOMotorClient = None
db: AsyncIOMotorDatabase = None


async def connect_to_mongo():
    """Create database connection on startup."""
    global client, db
    logger.info("Connecting to MongoDB Atlas...")
    client = AsyncIOMotorClient(settings.MONGODB_URI)
    db = client[settings.MONGODB_DB_NAME]
    logger.info(f"Connected to MongoDB: {settings.MONGODB_DB_NAME}")
    await create_indexes()


async def close_mongo_connection():
    """Close database connection on shutdown."""
    global client
    if client:
        client.close()
        logger.info("MongoDB connection closed.")


async def get_db() -> AsyncIOMotorDatabase:
    """Dependency: yields the database instance."""
    return db


async def create_indexes():
    """Create all required MongoDB indexes for performance."""
    global db

    # transactions — most frequent query pattern
    await db.transactions.create_indexes([
        IndexModel([("user_id", ASCENDING), ("date", DESCENDING)], name="user_date"),
        IndexModel([("user_id", ASCENDING), ("category_id", ASCENDING)], name="user_category"),
        IndexModel([("user_id", ASCENDING), ("account_id", ASCENDING)], name="user_account"),
        IndexModel([("user_id", ASCENDING), ("type", ASCENDING)], name="user_type"),
    ])

    # budgets
    await db.budgets.create_indexes([
        IndexModel([("user_id", ASCENDING), ("is_active", ASCENDING)], name="user_active"),
    ])

    # goals — only once, removed from the loop below
    await db.goals.create_indexes([
        IndexModel([("user_id", ASCENDING)], name="user_id"),
    ])

    # recurring_rules
    await db.recurring_rules.create_indexes([
        IndexModel([("user_id", ASCENDING), ("next_due_date", ASCENDING)], name="user_due"),
    ])

    # ai_insight_cache — TTL index
    await db.ai_insight_cache.create_indexes([
        IndexModel([("user_id", ASCENDING), ("expires_at", ASCENDING)], name="user_expires"),
        IndexModel([("expires_at", ASCENDING)], name="ttl_expires", expireAfterSeconds=0),
    ])

    # currency_rates
    await db.currency_rates.create_indexes([
        IndexModel([("base", ASCENDING), ("fetched_at", DESCENDING)], name="base_fetched"),
    ])

    # accounts, categories, crypto_holdings, ml_models — basic user_id index
    for collection in ["accounts", "categories", "crypto_holdings", "ml_models"]:
        await db[collection].create_indexes([
            IndexModel([("user_id", ASCENDING)], name="user_id"),
        ])

    logger.info("MongoDB indexes created successfully.")
import redis.asyncio as aioredis
from app.core.config import settings
import logging
from typing import Optional

logger = logging.getLogger(__name__)

redis_client: Optional[aioredis.Redis] = None


async def connect_to_redis():
    """Create Redis connection on startup."""
    global redis_client
    logger.info("Connecting to Redis...")
    redis_client = aioredis.from_url(
        settings.REDIS_URL,
        password=settings.REDIS_PASSWORD,
        encoding="utf-8",
        decode_responses=True,
    )
    # Verify connection
    await redis_client.ping()
    logger.info("Redis connected successfully.")


async def close_redis_connection():
    """Close Redis connection on shutdown."""
    global redis_client
    if redis_client:
        await redis_client.close()
        logger.info("Redis connection closed.")


async def get_redis() -> aioredis.Redis:
    """Dependency: yields the Redis client."""
    return redis_client


# ─── Cache Helpers ────────────────────────────────────────────────────────────

async def cache_set(key: str, value: str, ttl: int = 3600) -> None:
    """Set a string value in Redis with TTL."""
    await redis_client.setex(key, ttl, value)


async def cache_get(key: str) -> Optional[str]:
    """Get a cached value by key. Returns None if missing."""
    return await redis_client.get(key)


async def cache_delete(key: str) -> None:
    """Delete a key from cache."""
    await redis_client.delete(key)


async def cache_delete_pattern(pattern: str) -> None:
    """Delete all keys matching a glob pattern."""
    keys = await redis_client.keys(pattern)
    if keys:
        await redis_client.delete(*keys)


async def increment_counter(key: str, ttl: int = 86400) -> int:
    """Increment a counter and set TTL if key is new. Used for rate limiting."""
    pipe = redis_client.pipeline()
    await pipe.incr(key)
    await pipe.expire(key, ttl)
    results = await pipe.execute()
    return results[0]


def make_cache_key(namespace: str, user_id: str, *args: str) -> str:
    """Build a namespaced, user-scoped Redis key."""
    parts = [namespace, user_id] + list(args)
    return ":".join(parts)

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    c = AsyncIOMotorClient('mongodb+srv://fintrack-user:viswak123@cluster0.1ov3tnb.mongodb.net/fintrack')
    result = await c.fintrack.ai_insight_cache.delete_many({})
    print('Cleared:', result.deleted_count, 'docs')
    c.close()

asyncio.run(main())
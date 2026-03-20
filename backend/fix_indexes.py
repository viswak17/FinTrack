import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    c = AsyncIOMotorClient('mongodb+srv://fintrack-user:viswak123@cluster0.1ov3tnb.mongodb.net/fintrack?retryWrites=true&w=majority')
    db = c.fintrack
    cols = await db.list_collection_names()
    print('Collections found:', cols)
    for col in cols:
        try:
            await db[col].drop_indexes()
            print('Dropped indexes: ' + col)
        except Exception as e:
            print('Error ' + col + ': ' + str(e))
    c.close()

asyncio.run(main())
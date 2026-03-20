"""
Accounts endpoint: CRUD + Net Worth summary.
All operations are user-scoped via the auth dependency.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from datetime import datetime

from app.core.database import get_db
from app.api.deps import get_current_user
from app.schemas.account import (
    AccountCreate, AccountUpdate, AccountResponse, NetWorthResponse
)

router = APIRouter(prefix="/accounts", tags=["accounts"])


def _format_account(doc: dict) -> AccountResponse:
    return AccountResponse(
        id=str(doc["_id"]),
        user_id=doc["user_id"],
        name=doc["name"],
        type=doc["type"],
        currency=doc["currency"],
        initial_balance=doc.get("initial_balance", 0.0),
        current_balance=doc.get("current_balance", 0.0),
        credit_limit=doc.get("credit_limit"),
        color=doc.get("color", "#6366F1"),
        icon=doc.get("icon", "bank"),
        is_archived=doc.get("is_archived", False),
    )


@router.get("/", response_model=list[AccountResponse])
async def list_accounts(
    include_archived: bool = False,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    query = {"user_id": current_user["id"]}
    if not include_archived:
        query["is_archived"] = {"$ne": True}

    cursor = db.accounts.find(query).sort("created_at", 1)
    accounts = []
    async for doc in cursor:
        accounts.append(_format_account(doc))
    return accounts


@router.post("/", response_model=AccountResponse, status_code=201)
async def create_account(
    body: AccountCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    doc = {
        "user_id": current_user["id"],
        "name": body.name,
        "type": body.type,
        "currency": body.currency,
        "initial_balance": body.initial_balance,
        "current_balance": body.initial_balance,   # starts equal to initial
        "credit_limit": body.credit_limit,
        "color": body.color,
        "icon": body.icon,
        "is_archived": False,
        "created_at": datetime.utcnow(),
    }
    result = await db.accounts.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _format_account(doc)


@router.get("/net-worth", response_model=NetWorthResponse)
async def get_net_worth(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Aggregated net worth: assets − liabilities."""
    cursor = db.accounts.find({
        "user_id": current_user["id"],
        "is_archived": {"$ne": True},
    })

    LIABILITY_TYPES = {"credit_card", "loan"}
    total_assets = 0.0
    total_liabilities = 0.0
    account_list = []

    async for doc in cursor:
        balance = doc.get("current_balance", 0.0)
        formatted = _format_account(doc)
        account_list.append(formatted)

        if doc["type"] in LIABILITY_TYPES:
            total_liabilities += abs(balance)
        else:
            total_assets += balance

    return NetWorthResponse(
        total_assets=total_assets,
        total_liabilities=total_liabilities,
        net_worth=total_assets - total_liabilities,
        currency=current_user.get("base_currency", "INR"),
        accounts=[a.model_dump() for a in account_list],
    )


@router.get("/{account_id}", response_model=AccountResponse)
async def get_account(
    account_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    doc = await db.accounts.find_one({
        "_id": ObjectId(account_id),
        "user_id": current_user["id"],
    })
    if not doc:
        raise HTTPException(status_code=404, detail="Account not found")
    return _format_account(doc)


@router.put("/{account_id}", response_model=AccountResponse)
async def update_account(
    account_id: str,
    body: AccountUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No update fields provided")

    result = await db.accounts.update_one(
        {"_id": ObjectId(account_id), "user_id": current_user["id"]},
        {"$set": updates},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Account not found")

    doc = await db.accounts.find_one({"_id": ObjectId(account_id)})
    return _format_account(doc)


@router.delete("/{account_id}", status_code=204)
async def delete_account(
    account_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Archive rather than hard-delete to preserve transaction history."""
    result = await db.accounts.update_one(
        {"_id": ObjectId(account_id), "user_id": current_user["id"]},
        {"$set": {"is_archived": True}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Account not found")
    return None

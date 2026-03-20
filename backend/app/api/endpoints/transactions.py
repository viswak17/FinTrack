"""
Transactions endpoint: CRUD + advanced filters + pagination + split + bulk import.
Balance adjustments happen automatically on create/update/delete.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from datetime import datetime
import hashlib
import csv
import io
from typing import List, Optional

from app.core.database import get_db
from app.api.deps import get_current_user
from app.schemas.transaction import (
    TransactionCreate, TransactionUpdate, TransactionResponse,
    SplitTransactionRequest
)

router = APIRouter(prefix="/transactions", tags=["transactions"])


def _make_hash(amount: float, date: str, description: str) -> str:
    raw = f"{amount}|{date}|{description}"
    return hashlib.md5(raw.encode()).hexdigest()


def _format_tx(doc: dict) -> TransactionResponse:
    return TransactionResponse(
        id=str(doc["_id"]),
        user_id=doc["user_id"],
        account_id=doc["account_id"],
        category_id=doc.get("category_id"),
        type=doc["type"],
        amount=doc["amount"],
        currency=doc.get("currency", "INR"),
        fx_rate=doc.get("fx_rate", 1.0),
        date=doc["date"],
        description=doc.get("description"),
        payee=doc.get("payee"),
        tags=doc.get("tags", []),
        notes=doc.get("notes"),
        receipt_url=doc.get("receipt_url"),
        recurring_id=doc.get("recurring_id"),
        is_split=doc.get("is_split", False),
        created_at=doc["created_at"],
    )


async def _update_account_balance(db, account_id: str, delta: float):
    """Add delta to account's current_balance."""
    await db.accounts.update_one(
        {"_id": ObjectId(account_id)},
        {"$inc": {"current_balance": delta}},
    )


@router.get("/", response_model=dict)
async def list_transactions(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    category_id: Optional[str] = None,
    account_id: Optional[str] = None,
    type: Optional[str] = None,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    search: Optional[str] = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    sort_by: str = Query(default="date"),
    sort_dir: int = Query(default=-1),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    query = {"user_id": current_user["id"]}

    if start_date:
        query.setdefault("date", {})["$gte"] = start_date
    if end_date:
        query.setdefault("date", {})["$lte"] = end_date
    if category_id:
        query["category_id"] = category_id
    if account_id:
        query["account_id"] = account_id
    if type:
        query["type"] = type
    if min_amount:
        query.setdefault("amount", {})["$gte"] = min_amount
    if max_amount:
        query.setdefault("amount", {})["$lte"] = max_amount
    if search:
        query["$or"] = [
            {"description": {"$regex": search, "$options": "i"}},
            {"payee": {"$regex": search, "$options": "i"}},
            {"tags": {"$in": [search]}},
        ]

    total = await db.transactions.count_documents(query)
    skip = (page - 1) * page_size

    cursor = (
        db.transactions.find(query)
        .sort(sort_by, sort_dir)
        .skip(skip)
        .limit(page_size)
    )

    items = []
    async for doc in cursor:
        items.append(_format_tx(doc).model_dump())

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
    }


@router.post("/", response_model=TransactionResponse, status_code=201)
async def create_transaction(
    body: TransactionCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    # Validate account belongs to user
    account = await db.accounts.find_one({
        "_id": ObjectId(body.account_id),
        "user_id": current_user["id"],
    })
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    if body.type == "transfer" and not body.to_account_id:
        raise HTTPException(status_code=400, detail="to_account_id required for transfers")

    doc = {
        "user_id": current_user["id"],
        "account_id": body.account_id,
        "category_id": body.category_id,
        "type": body.type,
        "amount": body.amount,
        "currency": body.currency,
        "fx_rate": 1.0,
        "date": body.date,
        "description": body.description,
        "payee": body.payee,
        "tags": body.tags,
        "notes": body.notes,
        "recurring_id": body.recurring_id,
        "to_account_id": body.to_account_id,
        "is_split": False,
        "hash": _make_hash(body.amount, str(body.date), body.description or ""),
        "created_at": datetime.utcnow(),
    }

    result = await db.transactions.insert_one(doc)
    doc["_id"] = result.inserted_id

    # Update account balance
    if body.type == "expense":
        await _update_account_balance(db, body.account_id, -body.amount)
    elif body.type == "income":
        await _update_account_balance(db, body.account_id, body.amount)
    elif body.type == "transfer":
        await _update_account_balance(db, body.account_id, -body.amount)
        await _update_account_balance(db, body.to_account_id, body.amount)

    return _format_tx(doc)


@router.get("/{transaction_id}", response_model=TransactionResponse)
async def get_transaction(
    transaction_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    doc = await db.transactions.find_one({
        "_id": ObjectId(transaction_id),
        "user_id": current_user["id"],
    })
    if not doc:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return _format_tx(doc)


@router.put("/{transaction_id}", response_model=TransactionResponse)
async def update_transaction(
    transaction_id: str,
    body: TransactionUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    old_doc = await db.transactions.find_one({
        "_id": ObjectId(transaction_id),
        "user_id": current_user["id"],
    })
    if not old_doc:
        raise HTTPException(status_code=404, detail="Transaction not found")

    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No update fields")

    # If amount changed, adjust account balance
    if body.amount and body.amount != old_doc["amount"]:
        diff = body.amount - old_doc["amount"]
        if old_doc["type"] == "expense":
            await _update_account_balance(db, old_doc["account_id"], -diff)
        elif old_doc["type"] == "income":
            await _update_account_balance(db, old_doc["account_id"], diff)

    await db.transactions.update_one(
        {"_id": ObjectId(transaction_id)},
        {"$set": updates},
    )
    doc = await db.transactions.find_one({"_id": ObjectId(transaction_id)})
    return _format_tx(doc)


@router.delete("/{transaction_id}", status_code=204)
async def delete_transaction(
    transaction_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    doc = await db.transactions.find_one({
        "_id": ObjectId(transaction_id),
        "user_id": current_user["id"],
    })
    if not doc:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Reverse balance impact
    if doc["type"] == "expense":
        await _update_account_balance(db, doc["account_id"], doc["amount"])
    elif doc["type"] == "income":
        await _update_account_balance(db, doc["account_id"], -doc["amount"])
    elif doc["type"] == "transfer":
        await _update_account_balance(db, doc["account_id"], doc["amount"])
        if doc.get("to_account_id"):
            await _update_account_balance(db, doc["to_account_id"], -doc["amount"])

    await db.transactions.delete_one({"_id": ObjectId(transaction_id)})
    return None


@router.post("/{transaction_id}/split", response_model=List[TransactionResponse], status_code=201)
async def split_transaction(
    transaction_id: str,
    body: SplitTransactionRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Split a transaction into multiple sub-transactions."""
    parent = await db.transactions.find_one({
        "_id": ObjectId(transaction_id),
        "user_id": current_user["id"],
    })
    if not parent:
        raise HTTPException(status_code=404, detail="Transaction not found")

    total_split = sum(s.get("amount", 0) for s in body.splits)
    if abs(total_split - parent["amount"]) > 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"Split amounts ({total_split}) must equal original ({parent['amount']})",
        )

    # Mark parent as split
    await db.transactions.update_one(
        {"_id": ObjectId(transaction_id)},
        {"$set": {"is_split": True}},
    )

    created = []
    for split in body.splits:
        split_doc = {
            **parent,
            "_id": ObjectId(),
            "amount": split["amount"],
            "category_id": split.get("category_id", parent.get("category_id")),
            "description": split.get("description", parent.get("description")),
            "is_split": True,
            "split_from_id": transaction_id,
            "created_at": datetime.utcnow(),
        }
        await db.transactions.insert_one(split_doc)
        created.append(_format_tx(split_doc))

    return created


@router.post("/bulk-import", response_model=dict, status_code=201)
async def bulk_import(
    file: UploadFile = File(...),
    account_id: str = Query(...),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Import transactions from a CSV file with duplicate detection."""
    account = await db.accounts.find_one({
        "_id": ObjectId(account_id),
        "user_id": current_user["id"],
    })
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    content = await file.read()
    reader = csv.DictReader(io.StringIO(content.decode("utf-8")))

    imported = 0
    skipped = 0
    errors = []

    for i, row in enumerate(reader):
        try:
            amount = float(row.get("amount", 0))
            date_str = row.get("date", "")
            description = row.get("description", "")
            tx_type = row.get("type", "expense").lower()

            tx_hash = _make_hash(amount, date_str, description)
            # Duplicate check
            existing = await db.transactions.find_one({
                "user_id": current_user["id"],
                "hash": tx_hash,
            })
            if existing:
                skipped += 1
                continue

            tx_date = datetime.fromisoformat(date_str)
            doc = {
                "user_id": current_user["id"],
                "account_id": account_id,
                "category_id": None,
                "type": tx_type,
                "amount": abs(amount),
                "currency": account.get("currency", "INR"),
                "fx_rate": 1.0,
                "date": tx_date,
                "description": description,
                "payee": row.get("payee"),
                "tags": [],
                "is_split": False,
                "hash": tx_hash,
                "created_at": datetime.utcnow(),
            }
            await db.transactions.insert_one(doc)
            if tx_type == "expense":
                await _update_account_balance(db, account_id, -abs(amount))
            else:
                await _update_account_balance(db, account_id, abs(amount))
            imported += 1

        except Exception as e:
            errors.append({"row": i + 2, "error": str(e)})

    return {"imported": imported, "skipped": skipped, "errors": errors}

"""
Categories endpoint: CRUD with two-level hierarchy.
Also returns categories with their children nested.
"""
from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from datetime import datetime
from typing import List

from app.core.database import get_db
from app.api.deps import get_current_user
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse

router = APIRouter(prefix="/categories", tags=["categories"])


def _format_category(doc: dict, children: list = []) -> CategoryResponse:
    return CategoryResponse(
        id=str(doc["_id"]),
        user_id=doc["user_id"],
        name=doc["name"],
        type=doc["type"],
        color=doc.get("color", "#6366F1"),
        emoji=doc.get("emoji", "📂"),
        parent_id=doc.get("parent_id"),
        is_system=doc.get("is_system", False),
        children=children,
    )


@router.get("/", response_model=List[CategoryResponse])
async def list_categories(
    type: str = None,
    flat: bool = False,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Return categories for current user.
    By default returns hierarchical (nested children).
    Set flat=true for a flat list.
    """
    query = {"user_id": current_user["id"]}
    if type:
        query["type"] = type

    cursor = db.categories.find(query).sort("name", 1)
    all_cats = {}
    async for doc in cursor:
        all_cats[str(doc["_id"])] = doc

    if flat:
        return [_format_category(doc) for doc in all_cats.values()]

    # Build hierarchy: top-level + children list
    result = []
    for cat_id, doc in all_cats.items():
        if doc.get("parent_id") is None:
            children = [
                _format_category(c)
                for c in all_cats.values()
                if c.get("parent_id") == cat_id
            ]
            result.append(_format_category(doc, children=children))

    return result


@router.post("/", response_model=CategoryResponse, status_code=201)
async def create_category(
    body: CategoryCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    # Validate parent_id exists and belongs to user
    if body.parent_id:
        parent = await db.categories.find_one({
            "_id": ObjectId(body.parent_id),
            "user_id": current_user["id"],
        })
        if not parent:
            raise HTTPException(status_code=404, detail="Parent category not found")

    doc = {
        "user_id": current_user["id"],
        "name": body.name,
        "type": body.type,
        "color": body.color,
        "emoji": body.emoji,
        "parent_id": body.parent_id,
        "is_system": False,
        "created_at": datetime.utcnow(),
    }
    result = await db.categories.insert_one(doc)
    doc["_id"] = result.inserted_id
    return _format_category(doc)


@router.get("/{category_id}", response_model=CategoryResponse)
async def get_category(
    category_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    doc = await db.categories.find_one({
        "_id": ObjectId(category_id),
        "user_id": current_user["id"],
    })
    if not doc:
        raise HTTPException(status_code=404, detail="Category not found")
    return _format_category(doc)


@router.put("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: str,
    body: CategoryUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No update fields provided")

    result = await db.categories.update_one(
        {"_id": ObjectId(category_id), "user_id": current_user["id"]},
        {"$set": updates},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")

    doc = await db.categories.find_one({"_id": ObjectId(category_id)})
    return _format_category(doc)


@router.delete("/{category_id}", status_code=204)
async def delete_category(
    category_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    # Don't allow deletion of system categories
    doc = await db.categories.find_one({
        "_id": ObjectId(category_id),
        "user_id": current_user["id"],
    })
    if not doc:
        raise HTTPException(status_code=404, detail="Category not found")
    if doc.get("is_system"):
        raise HTTPException(status_code=400, detail="Cannot delete system categories")

    await db.categories.delete_one({"_id": ObjectId(category_id)})
    # Remove sub-categories as well
    await db.categories.delete_many({
        "user_id": current_user["id"],
        "parent_id": category_id,
    })
    return None

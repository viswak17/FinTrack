"""
MongoDB document models (Pydantic).
These map 1-to-1 to MongoDB BSON documents.
ObjectId is represented as str in Python.
"""
from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from datetime import datetime


class PyObjectId(str):
    """Custom type to handle MongoDB ObjectId as string."""

    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        from bson import ObjectId
        if isinstance(v, ObjectId):
            return str(v)
        if not ObjectId.is_valid(str(v)):
            raise ValueError(f"Invalid ObjectId: {v}")
        return str(v)


class UserDocument(BaseModel):
    """users collection."""
    id: Optional[str] = Field(None, alias="_id")
    email: EmailStr
    hashed_password: str
    full_name: Optional[str] = None
    base_currency: str = "INR"
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True

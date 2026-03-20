from pydantic import BaseModel, Field
from typing import Optional, Literal


class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    type: Literal["income", "expense"]
    color: str = "#6366F1"
    emoji: str = "📂"
    parent_id: Optional[str] = None


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    emoji: Optional[str] = None


class CategoryResponse(BaseModel):
    id: str
    user_id: str
    name: str
    type: str
    color: str
    emoji: str
    parent_id: Optional[str] = None
    is_system: bool
    children: list = []

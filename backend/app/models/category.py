from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


class CategoryDocument(BaseModel):
    """categories collection."""
    id: Optional[str] = Field(None, alias="_id")
    user_id: str
    name: str
    type: Literal["income", "expense"]
    color: str = "#6366F1"
    emoji: str = "📂"
    parent_id: Optional[str] = None   # null = top-level category
    is_system: bool = False            # pre-seeded system categories
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True

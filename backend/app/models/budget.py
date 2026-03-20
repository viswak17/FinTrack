from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


class BudgetDocument(BaseModel):
    """budgets collection."""
    id: Optional[str] = Field(None, alias="_id")
    user_id: str
    category_id: Optional[str] = None
    name: Optional[str] = None
    amount: float
    budget_type: Literal["category", "envelope", "zero_based", "project"] = "category"
    start_date: datetime
    end_date: Optional[datetime] = None
    is_active: bool = True
    rollover_enabled: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True

from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


class RecurringRuleDocument(BaseModel):
    """recurring_rules collection."""
    id: Optional[str] = Field(None, alias="_id")
    user_id: str
    name: str
    type: Literal["subscription", "bill", "income", "emi", "sip"]
    amount: float
    currency: str = "INR"
    category_id: Optional[str] = None
    account_id: Optional[str] = None
    frequency: Literal["daily", "weekly", "monthly", "quarterly", "yearly", "custom"]
    interval: int = 1                       # e.g. every 2 weeks
    start_date: datetime
    end_date: Optional[datetime] = None
    next_due_date: datetime
    auto_create: bool = True
    remind_before_days: int = 3
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True

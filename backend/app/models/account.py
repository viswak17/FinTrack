from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


class AccountDocument(BaseModel):
    """accounts collection."""
    id: Optional[str] = Field(None, alias="_id")
    user_id: str
    name: str
    type: Literal["bank", "cash", "credit_card", "investment", "crypto", "loan"]
    currency: str = "INR"
    initial_balance: float = 0.0
    current_balance: float = 0.0
    credit_limit: Optional[float] = None   # For credit cards
    color: str = "#6366F1"
    icon: str = "bank"
    is_archived: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True

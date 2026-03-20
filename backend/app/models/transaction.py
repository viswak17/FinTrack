from pydantic import BaseModel, Field
from typing import Optional, Literal, List
from datetime import datetime


class TransactionDocument(BaseModel):
    """transactions collection."""
    id: Optional[str] = Field(None, alias="_id")
    user_id: str
    account_id: str
    category_id: Optional[str] = None
    type: Literal["income", "expense", "transfer"]
    amount: float
    currency: str = "INR"
    fx_rate: float = 1.0                   # rate to base currency at transaction time
    date: datetime
    description: Optional[str] = None
    payee: Optional[str] = None
    tags: List[str] = []
    notes: Optional[str] = None
    receipt_url: Optional[str] = None
    recurring_id: Optional[str] = None     # links to recurring_rules
    is_split: bool = False
    split_from_id: Optional[str] = None   # parent transaction id for split children
    to_account_id: Optional[str] = None   # for transfer type
    hash: Optional[str] = None            # for duplicate detection in CSV import
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True

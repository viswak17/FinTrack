from pydantic import BaseModel, Field
from typing import Optional, Literal, List
from datetime import datetime


class TransactionCreate(BaseModel):
    account_id: str
    category_id: Optional[str] = None
    type: Literal["income", "expense", "transfer"]
    amount: float = Field(..., gt=0)
    currency: str = "INR"
    date: datetime
    description: Optional[str] = None
    payee: Optional[str] = None
    tags: List[str] = []
    notes: Optional[str] = None
    recurring_id: Optional[str] = None
    to_account_id: Optional[str] = None   # required for transfer


class TransactionUpdate(BaseModel):
    category_id: Optional[str] = None
    amount: Optional[float] = None
    date: Optional[datetime] = None
    description: Optional[str] = None
    payee: Optional[str] = None
    tags: Optional[List[str]] = None
    notes: Optional[str] = None


class TransactionResponse(BaseModel):
    id: str
    user_id: str
    account_id: str
    category_id: Optional[str] = None
    type: str
    amount: float
    currency: str
    fx_rate: float
    date: datetime
    description: Optional[str] = None
    payee: Optional[str] = None
    tags: List[str] = []
    notes: Optional[str] = None
    receipt_url: Optional[str] = None
    recurring_id: Optional[str] = None
    is_split: bool
    created_at: datetime


class TransactionFilter(BaseModel):
    """Query params for filtering transactions."""
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    category_id: Optional[str] = None
    account_id: Optional[str] = None
    type: Optional[Literal["income", "expense", "transfer"]] = None
    tags: Optional[List[str]] = None
    min_amount: Optional[float] = None
    max_amount: Optional[float] = None
    search: Optional[str] = None
    page: int = 1
    page_size: int = 20


class SplitTransactionRequest(BaseModel):
    splits: List[dict]   # [{amount, category_id, description}]


class BulkImportRow(BaseModel):
    date: datetime
    amount: float
    description: str
    type: Literal["income", "expense"] = "expense"
    category_id: Optional[str] = None

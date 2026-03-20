from pydantic import BaseModel, Field
from typing import Optional, Literal


class AccountCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    type: Literal["bank", "cash", "credit_card", "investment", "crypto", "loan"]
    currency: str = "INR"
    initial_balance: float = 0.0
    credit_limit: Optional[float] = None
    color: str = "#6366F1"
    icon: str = "bank"


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    credit_limit: Optional[float] = None
    is_archived: Optional[bool] = None


class AccountResponse(BaseModel):
    id: str
    user_id: str
    name: str
    type: str
    currency: str
    initial_balance: float
    current_balance: float
    credit_limit: Optional[float] = None
    color: str
    icon: str
    is_archived: bool


class NetWorthResponse(BaseModel):
    total_assets: float
    total_liabilities: float
    net_worth: float
    currency: str
    accounts: list

from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


class GoalCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    type: Literal["savings", "debt_payoff", "investment", "net_worth"] = "savings"
    target_amount: float = Field(..., gt=0)
    currency: str = "INR"
    deadline: Optional[datetime] = None
    account_id: Optional[str] = None
    color: str = "#6366F1"
    emoji: str = "🎯"


class GoalUpdate(BaseModel):
    name: Optional[str] = None
    target_amount: Optional[float] = None
    deadline: Optional[datetime] = None
    color: Optional[str] = None
    emoji: Optional[str] = None
    is_paused: Optional[bool] = None


class GoalContributeRequest(BaseModel):
    amount: float = Field(..., gt=0)
    date: Optional[datetime] = None
    note: Optional[str] = None


class GoalResponse(BaseModel):
    id: str
    user_id: str
    name: str
    type: str
    target_amount: float
    current_amount: float
    currency: str
    deadline: Optional[datetime] = None
    account_id: Optional[str] = None
    is_completed: bool
    is_paused: bool
    color: str
    emoji: str
    percent_complete: float = 0.0
    monthly_needed: Optional[float] = None


class RecurringCreate(BaseModel):
    name: str
    type: Literal["subscription", "bill", "income", "emi", "sip"]
    amount: float = Field(..., gt=0)
    currency: str = "INR"
    category_id: Optional[str] = None
    account_id: Optional[str] = None
    frequency: Literal["daily", "weekly", "monthly", "quarterly", "yearly", "custom"]
    interval: int = 1
    start_date: datetime
    end_date: Optional[datetime] = None
    auto_create: bool = True
    remind_before_days: int = 3


class RecurringResponse(BaseModel):
    id: str
    user_id: str
    name: str
    type: str
    amount: float
    currency: str
    category_id: Optional[str] = None
    account_id: Optional[str] = None
    frequency: str
    interval: int
    start_date: datetime
    end_date: Optional[datetime] = None
    next_due_date: datetime
    auto_create: bool
    remind_before_days: int
    is_active: bool

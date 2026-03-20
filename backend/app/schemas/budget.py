from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


class BudgetCreate(BaseModel):
    category_id: Optional[str] = None
    name: Optional[str] = None
    amount: float = Field(..., gt=0)
    budget_type: Literal["category", "envelope", "zero_based", "project"] = "category"
    start_date: datetime
    end_date: Optional[datetime] = None
    rollover_enabled: bool = False


class BudgetUpdate(BaseModel):
    amount: Optional[float] = None
    end_date: Optional[datetime] = None
    is_active: Optional[bool] = None
    rollover_enabled: Optional[bool] = None


class BudgetResponse(BaseModel):
    id: str
    user_id: str
    category_id: Optional[str] = None
    name: Optional[str] = None
    amount: float
    budget_type: str
    start_date: datetime
    end_date: Optional[datetime] = None
    is_active: bool
    rollover_enabled: bool
    # Computed fields (populated at query time)
    spent: float = 0.0
    remaining: float = 0.0
    percent_used: float = 0.0


class BudgetVsActualItem(BaseModel):
    category_id: str
    category_name: str
    budget_amount: float
    actual_spent: float
    variance: float
    percent_used: float
    status: Literal["under", "warning", "over"]

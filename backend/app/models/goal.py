from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


class GoalDocument(BaseModel):
    """goals collection."""
    id: Optional[str] = Field(None, alias="_id")
    user_id: str
    name: str
    type: Literal["savings", "debt_payoff", "investment", "net_worth"]
    target_amount: float
    current_amount: float = 0.0
    currency: str = "INR"
    deadline: Optional[datetime] = None
    account_id: Optional[str] = None
    is_completed: bool = False
    is_paused: bool = False
    color: str = "#6366F1"
    emoji: str = "🎯"
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True


class GoalContributionDocument(BaseModel):
    """goal_contributions collection."""
    id: Optional[str] = Field(None, alias="_id")
    goal_id: str
    user_id: str
    amount: float
    date: datetime
    note: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class CurrencyRateDocument(BaseModel):
    """currency_rates collection."""
    id: Optional[str] = Field(None, alias="_id")
    base: str
    quote: str
    rate: float
    fetched_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True


class CryptoHoldingDocument(BaseModel):
    """crypto_holdings collection."""
    id: Optional[str] = Field(None, alias="_id")
    user_id: str
    account_id: Optional[str] = None
    symbol: str              # e.g. "BTC", "ETH"
    quantity: float
    avg_buy_price: float
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True


class UserPreferencesDocument(BaseModel):
    """user_preferences collection."""
    id: Optional[str] = Field(None, alias="_id")
    user_id: str
    base_currency: str = "INR"
    ai_calls_today: int = 0
    ai_calls_reset_date: Optional[datetime] = None
    theme: str = "dark"
    sidebar_collapsed: bool = False
    ml_features_enabled: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True

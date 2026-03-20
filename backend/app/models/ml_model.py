from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class MLModelDocument(BaseModel):
    """ml_models collection — metadata for GridFS-stored model blobs."""
    id: Optional[str] = Field(None, alias="_id")
    user_id: str
    model_type: str       # "categorizer" | "prophet" | "anomaly" | "savings_ridge"
    gridfs_file_id: Optional[str] = None
    trained_at: Optional[datetime] = None
    accuracy_score: Optional[float] = None
    sample_count: int = 0
    feature_version: str = "1.0"
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True


class MLForecastDocument(BaseModel):
    """ml_forecasts collection — cached forecast results."""
    id: Optional[str] = Field(None, alias="_id")
    user_id: str
    forecast_date: datetime
    predicted_amount: float
    lower_bound: float
    upper_bound: float
    model_version: str = "1.0"
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True


class AnomalyLogDocument(BaseModel):
    """anomaly_log collection."""
    id: Optional[str] = Field(None, alias="_id")
    user_id: str
    transaction_id: str
    anomaly_score: float
    flag_type: str         # "amount_outlier" | "timing_unusual" | "frequency_spike"
    reason: str
    is_dismissed: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True


class AIInsightCacheDocument(BaseModel):
    """ai_insight_cache collection."""
    id: Optional[str] = Field(None, alias="_id")
    user_id: str
    insight_type: str      # "pulse" | "chat_context" | "narrative"
    content: str
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True

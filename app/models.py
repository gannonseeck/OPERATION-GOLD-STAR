from typing import Optional, Dict, List
from pydantic import BaseModel, Field, model_validator

class PricingRequest(BaseModel):
    psa_cert: Optional[str] = None
    cardId: Optional[str] = None
    setId: Optional[str] = None
    number: Optional[str] = None
    name: Optional[str] = None
    includeHistory: bool = True

    @model_validator(mode="after")
    def at_least_one_identifier(cls, values):
        if not any(getattr(values, k) for k in ["cardId", "psa_cert", "setId", "name"]):
            raise ValueError("At least one identifier must be provided")
        if values.setId and not values.number:
            raise ValueError("number required with setId")
        return values

class Explain(BaseModel):
    windowDays: int
    sampleSize: int
    variance: float
    sources: List[str]
    trend: str
    notes: List[str] = []

class QuoteResponse(BaseModel):
    market_price: float
    graded_prices: Dict[str, float] = Field(default_factory=dict)
    confidence: float
    explain: Explain
    offer_price: Optional[float] = None
    no_offer: Optional[bool] = None
    reason: Optional[str] = None

from pydantic import BaseModel, Field, field_validator


class TempRejection(BaseModel):
    """
    Frontend may only send what the admin enters.
    cost_price, stock, loss, and date are computed/set on the backend.
    Extra fields from a tampered request are ignored.
    """
    product_id: str = Field(..., min_length=1, description="Product being rejected")
    quantity: int = Field(..., gt=0, description="Number of boxes rejected — must be greater than 0")
    reason: str = Field(..., min_length=1, max_length=200, description="Reason for rejection / waste")

    model_config = {"extra": "ignore"}

    @field_validator("product_id")
    @classmethod
    def strip_product_id(cls, v: str) -> str:
        cleaned = (v or "").strip()
        if not cleaned:
            raise ValueError("product_id is required")
        return cleaned

    @field_validator("reason")
    @classmethod
    def strip_reason(cls, v: str) -> str:
        cleaned = (v or "").strip()
        if not cleaned:
            raise ValueError("reason is required")
        return cleaned

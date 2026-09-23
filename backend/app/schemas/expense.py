from pydantic import BaseModel, Field, field_validator
from datetime import date
from typing import Optional


class TempExpense(BaseModel):
    """
    Frontend may only send what the admin enters.
    total_expenses, profit, loss, and other calculated fields are ignored.
    """
    expense_date: date = Field(..., description="Expense date in YYYY-MM-DD format")
    category: str = Field(..., min_length=1, max_length=100, description="Expense category")
    amount: float = Field(..., gt=0, description="Expense amount — must be greater than 0")
    description: Optional[str] = Field(None, max_length=500, description="Optional note")

    model_config = {"extra": "ignore"}

    @field_validator("category")
    @classmethod
    def strip_category(cls, v: str) -> str:
        cleaned = (v or "").strip()
        if not cleaned:
            raise ValueError("category is required")
        return cleaned

    @field_validator("description")
    @classmethod
    def strip_description(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("description cannot be blank if provided")
        return cleaned

from pydantic import BaseModel, Field, ConfigDict

class StaffRejectionResponse(BaseModel):
    rejection_id: str = Field(..., description="The unique identifier of the rejection")
    product_id: str = Field(..., description="The unique identifier of the product")
    product_name: str = Field(..., description="The name of the product")
    quantity: int = Field(..., description="The quantity of rejected boxes")
    rejection_date: str = Field(..., description="The date of rejection in YYYY-MM-DD format")
    reason: str = Field(..., description="The reason for rejection")
    rejection_loss: float = Field(..., description="The total rejection loss amount")

    model_config = ConfigDict(from_attributes=True)

class StaffCreateRejectionResponse(BaseModel):
    message: str = Field(..., description="Status message")
    rejection_id: str = Field(..., description="The unique identifier of the rejection")
    product_id: str = Field(..., description="The unique identifier of the product")
    rejected_quantity: int = Field(..., description="The quantity of rejected boxes")
    remaining_stock: int = Field(..., description="Remaining stock of the product")
    rejection_loss: float = Field(..., description="The calculated loss amount for this rejection")

    model_config = ConfigDict(from_attributes=True)


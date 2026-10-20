from pydantic import BaseModel, Field, ConfigDict

class StaffProductResponse(BaseModel):
    product_id: str = Field(..., description="The unique identifier of the product")
    product_name: str = Field(..., description="The name of the product")
    product_brand: str = Field(..., description="The brand of the product")
    product_size: str = Field(..., description="The size of the product")
    product_stock_quantity: int = Field(..., description="The stock quantity of the product")

    model_config = ConfigDict(from_attributes=True)

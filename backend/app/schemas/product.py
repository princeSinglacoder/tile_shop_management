from pydantic import BaseModel, Field
from typing import Optional

class TempProduct(BaseModel):
    name: str = Field(..., min_length=1,max_length=100,description="The name of the product")
    brand: str = Field(..., min_length=1,max_length=100, description="The brand of the product")
    size: str = Field(...,min_length=1,max_length=30, description="The size of the product")
    selling_price: float = Field(...,gt=0,description="The selling price of the product must be greater than 0")
    stock_quantity: int = Field(...,ge=0, description="The stock quantity of the product")

class Product(TempProduct):
    id: str = Field(..., description="The unique identifier of the product")

class ProductUpdate(BaseModel):
    # make attributes optional for update
    name: Optional[str] = Field(None, min_length=1,max_length=100,description="The name of the product")
    brand: Optional[str] = Field(None, min_length=1,max_length=100, description="The brand of the product")
    size: Optional[str] = Field(None,min_length=1,max_length=30, description="The size of the product")
    selling_price: Optional[float] = Field(None, gt=0, description="The selling price of the product must be greater than 0")
from pydantic import BaseModel, Field
from datetime import date

class TempSaleItem(BaseModel):
    product_id: str = Field(..., min_length=1, description="The unique identifier of the product")
    quantity: int = Field(..., gt=0, description="The quantity of the product being sold must be greater than 0")

class TempSale(BaseModel):
    customer_name: str = Field(..., min_length=1, max_length=100, description="The name of the customer")
    sale_date: date = Field(..., description="The date of the sale in YYYY-MM-DD format")
    items: list[TempSaleItem] = Field(..., min_length=1, description="A list of items being sold. Must contain at least one item.")

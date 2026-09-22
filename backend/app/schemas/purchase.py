from pydantic import BaseModel, Field
from datetime import date

class TempPurchaseItem(BaseModel):
    product_id: str = Field(..., min_length=1, description="The unique identifier of the product")
    quantity: int = Field(..., gt=0, description="The quantity of the product being purchased must be greater than 0")
    purchase_price: float = Field(..., gt=0, description="The purchase price of the product must be greater than 0")


class TempPurchase(BaseModel):
    supplier_name: str = Field(..., min_length=1, max_length=100, description="The name of the supplier")
    purchase_date: date = Field(..., description="The date of the purchase in YYYY-MM-DD format")
    items: list[TempPurchaseItem] = Field(..., min_length=1, description="A list of items being purchased. Must contain at least one item.")

# class Purchase(TempPurchase):
#     purchase_id: str = Field(..., description="The unique identifier of the purchase")
#     total_amount: float = Field(..., gt=0, description="The total amount of the purchase must be greater than 0")

# class PurchaseItem(TempPurchaseItem):
#     purchase_item_id: str = Field(..., description="The unique identifier of the purchase item")
#     purchase_id: str = Field(..., description="The unique identifier of the purchase")
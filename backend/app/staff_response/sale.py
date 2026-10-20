from pydantic import BaseModel, Field, ConfigDict
from typing import List

class StaffSaleItemResponse(BaseModel):
    sale_item_id: str = Field(..., description="The unique identifier of the sale item")
    product_id: str = Field(..., description="The unique identifier of the product")
    product_name: str = Field(..., description="The name of the product")
    quantity: int = Field(..., description="The quantity of the product sold")
    selling_price: float = Field(..., description="The selling price of the product")

    model_config = ConfigDict(from_attributes=True)

class StaffSaleResponse(BaseModel):
    sale_id: str = Field(..., description="The unique identifier of the sale")
    customer_name: str = Field(..., description="The name of the customer")
    phone_number: str = Field(..., description="The phone number of the customer")
    date: str = Field(..., description="The date of the sale")
    total_amount: float = Field(..., description="The total amount of the sale")
    cash_amount: float = Field(..., description="The cash amount received")
    upi_amount: float = Field(..., description="The UPI amount received")
    outstanding_amount: float = Field(..., description="The outstanding balance")
    refund_amount: float = Field(..., description="The pending refund amount")
    refunded_amount: float = Field(..., description="The refunded amount")
    items: List[StaffSaleItemResponse] = Field(default_factory=list, description="List of items in the sale")

    model_config = ConfigDict(from_attributes=True)

class StaffReturnItemResponse(BaseModel):
    sale_item_id: str = Field(..., description="The unique identifier of the sale item")
    product_id: str = Field(..., description="The unique identifier of the product")
    returned_quantity: int = Field(..., description="Quantity returned")
    remaining_quantity: int = Field(..., description="Quantity remaining after return")
    product_stock_quantity: int = Field(..., description="Updated product stock quantity")

    model_config = ConfigDict(from_attributes=True)

class StaffReturnResponse(BaseModel):
    message: str = Field(..., description="Status message")
    sale_id: str = Field(..., description="The unique identifier of the sale")
    total_return_amount: float = Field(..., description="Total return amount")
    total_amount: float = Field(..., description="Updated sale total amount")
    outstanding_amount: float = Field(..., description="Updated outstanding amount")
    refund_amount: float = Field(..., description="Updated refund amount")
    refunded_amount: float = Field(..., description="Updated refunded amount")
    items: List[StaffReturnItemResponse] = Field(default_factory=list, description="Updated return items")

    model_config = ConfigDict(from_attributes=True)

class StaffCreateSaleResponse(BaseModel):
    message: str = Field(..., description="Status message")
    sale_id: str = Field(..., description="The unique identifier of the sale")
    customer_name: str = Field(..., description="The name of the customer")
    phone_number: str = Field(..., description="The phone number of the customer")
    date: str = Field(..., description="The date of the sale")
    total_amount: float = Field(..., description="The total amount of the sale")
    cash_amount: float = Field(..., description="The cash amount received")
    upi_amount: float = Field(..., description="The UPI amount received")
    outstanding_amount: float = Field(..., description="The outstanding balance")
    refund_amount: float = Field(..., description="The pending refund amount")
    refunded_amount: float = Field(..., description="The refunded amount")
    items: List[StaffSaleItemResponse] = Field(default_factory=list, description="List of items in the sale")

    model_config = ConfigDict(from_attributes=True)



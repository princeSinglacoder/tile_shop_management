from pydantic import BaseModel, Field
from datetime import date
from typing import Literal

class TempSaleItem(BaseModel):
    product_id: str = Field(..., min_length=1, description="The unique identifier of the product")
    quantity: int = Field(..., gt=0, description="The quantity of the product being sold must be greater than 0")
    selling_price: float = Field(..., gt=0, description="The selling price of the product must be greater than 0")

class TempSale(BaseModel):
    customer_name: str = Field(..., min_length=1, max_length=100, description="The name of the customer")
    phone_number: str = Field(..., min_length=10, max_length=10, pattern=r"^\d{10}$",description="The phone number of the customer")
    sale_date: date = Field(..., description="The date of the sale in YYYY-MM-DD format")
    items: list[TempSaleItem] = Field(..., min_length=1, description="A list of items being sold. Must contain at least one item.")
    cash_amount: float = Field( 0.0,ge=0, description="The amount of cash received from the customer")
    upi_amount: float = Field( 0.0, ge=0, description="The amount of UPI received from the customer")
    udhari_amount: float = Field( 0.0, ge=0, description="The outstanding amount to be collected from the customer")

class TempPayment(BaseModel):
    payment_method: Literal["cash","upi"] = Field(..., description="The method of payment")
    amount: float = Field(..., gt=0, description="Amount paid by customer")
    
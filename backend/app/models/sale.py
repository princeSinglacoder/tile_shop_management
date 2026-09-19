from app.databases.database import Base
from sqlalchemy import Column, String, Integer, Date, Float, ForeignKey

class SaleDBModel(Base):
    __tablename__ = "sales"

    sale_id = Column(String, primary_key=True, index=True)

    customer_name = Column(String, nullable=False)

    date = Column(Date, nullable=False)

    total_amount = Column(Float, nullable=False)

class SaleItemDBModel(Base):
    __tablename__ = "sale_items"

    sale_item_id = Column(String, primary_key=True, index=True)

    sale_id = Column(
        String,
        ForeignKey("sales.sale_id"),
        nullable=False,
        index=True
    )

    product_id = Column(
        String,
        ForeignKey("product_data.product_id"),
        nullable=False,
        index=True
    )

    quantity = Column(Integer, nullable=False)

    selling_price = Column(Float, nullable=False)

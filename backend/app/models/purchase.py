from app.databases.database import Base
from sqlalchemy import Column,String, Integer, Date, Float, ForeignKey

class PurchaseDBModel(Base):
    __tablename__ = "purchases"

    purchase_id = Column(String, primary_key=True, index=True)

    supplier_name = Column(String, nullable=False)

    date = Column(Date, nullable=False)

    total_amount = Column(Float, nullable=False)

class PurchaseItemDBModel(Base):
    __tablename__ = "purchase_items"

    purchase_item_id = Column(String, primary_key=True, index=True)

    purchase_id = Column(
        String,
        ForeignKey("purchases.purchase_id"),
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

    purchase_price = Column(Float, nullable=False)
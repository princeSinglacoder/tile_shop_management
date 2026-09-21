
from sqlalchemy import Column, String, Float, Integer

from app.databases.database import Base


class ProductDBModel(Base):
    __tablename__ = "product_data"
    product_id = Column(String, primary_key=True, index=True)
    product_name = Column(String)
    product_brand = Column(String)
    product_size = Column(String)
    product_selling_price = Column(Float)
    product_stock_quantity = Column(Integer)
    
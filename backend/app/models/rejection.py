from app.databases.database import Base
from sqlalchemy import Column, String, Integer, Date, Float, ForeignKey


class RejectionDBModel(Base):
    __tablename__ = "rejections"

    rejection_id = Column(String, primary_key=True, index=True)

    product_id = Column(
        String,
        ForeignKey("product_data.product_id"),
        nullable=False,
        index=True
    )

    quantity = Column(Integer, nullable=False)

    rejection_date = Column(Date, nullable=False)

    reason = Column(String, nullable=False)

    # Snapshot of product Avg Purchase Price at rejection time
    cost_price = Column(Float, nullable=False)

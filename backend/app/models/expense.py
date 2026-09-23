from app.databases.database import Base
from sqlalchemy import Column, String, Date, Float


class ExpenseDBModel(Base):
    __tablename__ = "expenses"

    expense_id = Column(String, primary_key=True, index=True)

    # Not unique — multiple expenses allowed on the same day
    expense_date = Column(Date, nullable=False, index=True)

    category = Column(String, nullable=False)

    amount = Column(Float, nullable=False)

    description = Column(String, nullable=True)

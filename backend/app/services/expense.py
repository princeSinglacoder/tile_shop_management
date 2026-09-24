from datetime import date
from typing import Optional

from app.schemas.expense import TempExpense
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.expense import ExpenseDBModel
from app.utils.date_range import apply_date_range_filter
import uuid


def create_expense(temp_expense: TempExpense, db: Session):
    category = (temp_expense.category or "").strip()
    if not category:
        raise HTTPException(status_code=400, detail="Expense category is required")

    if temp_expense.amount is None or temp_expense.amount <= 0:
        raise HTTPException(
            status_code=400,
            detail="Expense amount must be greater than 0"
        )

    description = None
    if temp_expense.description is not None:
        description = temp_expense.description.strip()
        if not description:
            raise HTTPException(
                status_code=400,
                detail="Description cannot be blank if provided"
            )

    if not temp_expense.expense_date:
        raise HTTPException(status_code=400, detail="Expense date is required")

    expense = ExpenseDBModel(
        expense_id=str(uuid.uuid4()),
        expense_date=temp_expense.expense_date,
        category=category,
        amount=float(temp_expense.amount),
        description=description,
    )

    try:
        db.add(expense)
        db.commit()
        db.refresh(expense)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create expense"
        )

    return {
        "message": "Expense created successfully",
        "expense_id": expense.expense_id,
        "expense_date": str(expense.expense_date) if expense.expense_date else "",
        "category": expense.category,
        "amount": round(expense.amount, 2),
        "description": expense.description or "",
    }


def get_all_expenses(db: Session):
    expenses = db.query(ExpenseDBModel).order_by(
        ExpenseDBModel.expense_date.desc(),
        ExpenseDBModel.expense_id.desc(),
    ).all()
    return _serialize_expenses(expenses)


def filter_expenses(
    db: Session,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
):
    query = db.query(ExpenseDBModel)
    query = apply_date_range_filter(
        query, ExpenseDBModel.expense_date, start_date, end_date
    )
    expenses = query.order_by(
        ExpenseDBModel.expense_date.desc(),
        ExpenseDBModel.expense_id.desc(),
    ).all()
    return _serialize_expenses(expenses)


def _serialize_expenses(expenses):
    return [
        {
            "expense_id": e.expense_id,
            "expense_date": str(e.expense_date) if e.expense_date else "",
            "category": e.category,
            "amount": round(e.amount, 2) if e.amount is not None else 0.0,
            "description": e.description or "",
        }
        for e in expenses
    ]

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.schemas.expense import TempExpense
from app.databases.database import get_db
from app.utils.jwt import get_current_user
from app.utils.date_range import resolve_filter_date_range
from app.services.expense import create_expense as create_expense_service
from app.services.expense import get_all_expenses
from app.services.expense import filter_expenses


router = APIRouter(prefix="/expenses", tags=["expenses"])


@router.post("/create")
def create_expense(
    temp_expense: TempExpense,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.user_role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create expenses")

    return create_expense_service(temp_expense, db)


@router.get("/all")
def get_expenses(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.user_role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can view expenses")

    return get_all_expenses(db)


@router.get("/filter")
def filter_expenses_by_date(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.user_role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can view expenses")

    start, end = resolve_filter_date_range(start_date, end_date)
    return filter_expenses(db, start_date=start, end_date=end)

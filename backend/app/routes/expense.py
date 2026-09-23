from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.schemas.expense import TempExpense
from app.databases.database import get_db
from app.utils.jwt import get_current_user
from app.services.expense import create_expense as create_expense_service
from app.services.expense import get_all_expenses


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

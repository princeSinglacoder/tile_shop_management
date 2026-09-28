from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.schemas.purchase import TempPurchase
from app.databases.database import get_db
from app.utils.jwt import get_current_user
from app.utils.date_range import resolve_filter_date_range
from app.services.purchase import create_purchase as create_purchase_service
from app.services.purchase import get_all_purchase
from app.services.purchase import filter_purchases


router = APIRouter(prefix="/purchases", tags=["purchase"])

@router.post("/create")
def create_purchase(
    tempPurchase: TempPurchase,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.user_role != "admin":
        raise HTTPException(
            status_code=403,
            detail="You are not authorized to create a purchase"
        )

    return create_purchase_service(tempPurchase, db)

@router.get("/all")
def get_purchase(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.user_role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can view purchases")

    return get_all_purchase(db)


@router.get("/filter")
def filter_purchases_by_date(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.user_role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can view purchases")

    start, end = resolve_filter_date_range(start_date, end_date)
    return filter_purchases(db, start_date=start, end_date=end)

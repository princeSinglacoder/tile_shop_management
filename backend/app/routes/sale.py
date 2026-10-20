from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.schemas.sales import TempSale, TempPayment, TempReturn
from app.staff_response.sale import StaffSaleResponse, StaffReturnResponse, StaffCreateSaleResponse
from app.databases.database import get_db
from app.utils.jwt import get_current_user
from app.utils.date_range import resolve_filter_date_range
from app.services.sale import create_sale as create_sale_service
from app.services.sale import make_payment as make_payment_service
from app.services.sale import get_all_sales
from app.services.sale import filter_sales
from app.services.sale import get_outstanding_sales
from app.services.sale import return_product_service
from app.services.sale import complete_refund_service

router = APIRouter(prefix="/sales", tags=["sales"])

@router.post("/create")
def create_sale(
    tempSale: TempSale,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    role = (current_user.user_role or "").strip().lower()
    if role not in ("admin", "staff"):
        raise HTTPException(status_code=403, detail="Only admins and staff can create sales")

    result = create_sale_service(tempSale, db)

    if role == "staff":
        return StaffCreateSaleResponse.model_validate(result)

    return result

@router.get("/all")
def get_sales(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    role = (current_user.user_role or "").strip().lower()
    if role not in ("admin", "staff"):
        raise HTTPException(status_code=403, detail="Only admins and staff can view sales")

    sales = get_all_sales(db)

    if role == "staff":
        return [StaffSaleResponse.model_validate(s) for s in sales]

    return sales


@router.get("/filter")
def filter_sales_by_date(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.user_role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can view sales")

    start, end = resolve_filter_date_range(start_date, end_date)
    return filter_sales(db, start_date=start, end_date=end)


@router.get("/outstanding")
def get_outstanding(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    role = (current_user.user_role or "").strip().lower()
    if role not in ("admin", "staff"):
        raise HTTPException(status_code=403, detail="Only admins and staff can view outstanding sales")

    return get_outstanding_sales(db)


@router.post("/{sale_id}/payment")
def make_payment(
    sale_id: str,
    temp_payment: TempPayment,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    role = (current_user.user_role or "").strip().lower()
    if role not in ("admin", "staff"):
        raise HTTPException(status_code=403, detail="Only admins and staff can make payments")

    return make_payment_service(sale_id, temp_payment, db)


@router.post("/{sale_id}/return")
def return_product(
    sale_id: str,
    temp_return: TempReturn,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    role = (current_user.user_role or "").strip().lower()
    if role not in ("admin", "staff"):
        raise HTTPException(status_code=403, detail="Only admins and staff can return product")

    result = return_product_service(sale_id, temp_return, db)

    if role == "staff":
        return StaffReturnResponse.model_validate(result)

    return result


@router.post("/{sale_id}/refund-complete")
def complete_refund(
    sale_id: str,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    role = (current_user.user_role or "").strip().lower()
    if role not in ("admin", "staff"):
        raise HTTPException(status_code=403, detail="Only admins and staff can complete refunds")

    return complete_refund_service(sale_id, db)

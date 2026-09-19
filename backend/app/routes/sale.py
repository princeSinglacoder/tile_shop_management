from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.schemas.sales import TempSale
from app.databases.database import get_db
from app.utils.jwt import get_current_user
from app.services.sale import create_sale as create_sale_service
from app.services.sale import get_all_sales


router = APIRouter(prefix="/sales", tags=["sales"])

@router.post("/create")
def create_sale(
    tempSale: TempSale,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.user_role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create sales")

    return create_sale_service(tempSale, db)

@router.get("/all")
def get_sales(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.user_role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can view sales")

    return get_all_sales(db)

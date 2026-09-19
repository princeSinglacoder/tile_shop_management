from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.schemas.purchase import TempPurchase
from app.databases.database import get_db
from app.utils.jwt import get_current_user
from app.services.purchase import create_purchase as create_purchase_service
from app.services.purchase import get_all_purchase


router = APIRouter(prefix="/purchases", tags=["purchase"])

@router.post("/create")
def create_purchase(
    tempPurchase: TempPurchase,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.user_role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create purchases")

    return create_purchase_service(tempPurchase, db)

@router.get("/all")
def get_purchase(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.user_role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can view purchases")

    return get_all_purchase(db)
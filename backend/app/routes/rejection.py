from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.schemas.rejection import TempRejection
from app.databases.database import get_db
from app.utils.jwt import get_current_user
from app.services.rejection import create_rejection as create_rejection_service
from app.services.rejection import get_all_rejections


router = APIRouter(prefix="/rejections", tags=["rejections"])


@router.post("/create")
def create_rejection(
    temp_rejection: TempRejection,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.user_role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can record rejections")

    return create_rejection_service(temp_rejection, db)


@router.get("/all")
def get_rejections(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.user_role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can view rejections")

    return get_all_rejections(db)

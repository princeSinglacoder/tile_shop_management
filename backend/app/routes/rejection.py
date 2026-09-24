from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.schemas.rejection import TempRejection
from app.databases.database import get_db
from app.utils.jwt import get_current_user
from app.utils.date_range import resolve_filter_date_range
from app.services.rejection import create_rejection as create_rejection_service
from app.services.rejection import get_all_rejections
from app.services.rejection import filter_rejections


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


@router.get("/filter")
def filter_rejections_by_date(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.user_role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can view rejections")

    start, end = resolve_filter_date_range(start_date, end_date)
    return filter_rejections(db, start_date=start, end_date=end)

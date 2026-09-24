from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.databases.database import get_db
from app.services.report import get_filtered_report, get_report_summary
from app.utils.date_range import resolve_filter_date_range
from app.utils.jwt import get_current_user

router = APIRouter(prefix="/reports", tags=["reports"])


def _require_admin(current_user) -> None:
    if current_user.user_role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Only admins can view reports",
        )


@router.get("/summary")
def reports_summary(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    return get_report_summary(db)


@router.get("/filter")
def reports_filter(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    start, end = resolve_filter_date_range(start_date, end_date)
    return get_filtered_report(db, start_date=start, end_date=end)

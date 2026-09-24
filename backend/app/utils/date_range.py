from datetime import date
from typing import Optional, Tuple

from fastapi import HTTPException


def parse_optional_date(value: Optional[str], field_name: str) -> Optional[date]:
    """Parse an optional YYYY-MM-DD query param. Raises 400 on invalid values."""
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid {field_name}. Expected format: YYYY-MM-DD",
        )


def resolve_filter_date_range(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> Tuple[Optional[date], Optional[date]]:
    """
    Parse and validate date range for dedicated /filter endpoints.
    Requires at least one of start_date or end_date.
    """
    start = parse_optional_date(start_date, "start_date")
    end = parse_optional_date(end_date, "end_date")

    if start is None and end is None:
        raise HTTPException(
            status_code=400,
            detail="At least one of start_date or end_date is required",
        )

    if start is not None and end is not None and start > end:
        raise HTTPException(
            status_code=400,
            detail="start_date cannot be greater than end_date",
        )

    return start, end


def apply_date_range_filter(query, column, start_date: Optional[date], end_date: Optional[date]):
    """Apply optional inclusive date bounds to a SQLAlchemy query."""
    if start_date is not None:
        query = query.filter(column >= start_date)
    if end_date is not None:
        query = query.filter(column <= end_date)
    return query

from datetime import date
from app.schemas.rejection import TempRejection
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.product import ProductDBModel
from app.models.rejection import RejectionDBModel
import uuid


def create_rejection(temp_rejection: TempRejection, db: Session):
    product = db.query(ProductDBModel).filter(
        ProductDBModel.product_id == temp_rejection.product_id
    ).first()

    if not product:
        raise HTTPException(
            status_code=404,
            detail=f"Product with id '{temp_rejection.product_id}' not found"
        )

    if temp_rejection.quantity <= 0:
        raise HTTPException(
            status_code=400,
            detail="Rejection quantity must be greater than 0"
        )

    reason = (temp_rejection.reason or "").strip()
    if not reason:
        raise HTTPException(
            status_code=400,
            detail="Rejection reason is required"
        )

    # Current DB stock is the source of truth — never trust frontend stock
    current_stock = product.product_stock_quantity or 0

    if temp_rejection.quantity > current_stock:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Cannot reject {temp_rejection.quantity} boxes. "
                f"Only {current_stock} boxes available in stock."
            )
        )

    # Snapshot current Avg Purchase Price — never trust frontend for this
    cost_price = (
        product.product_purchase_price
        if product.product_purchase_price is not None
        else 0.0
    )

    rejection_loss = round(temp_rejection.quantity * cost_price, 2)
    new_stock = current_stock - temp_rejection.quantity

    rejection = RejectionDBModel(
        rejection_id=str(uuid.uuid4()),
        product_id=product.product_id,
        quantity=temp_rejection.quantity,
        rejection_date=date.today(),  # backend sets current date — not from frontend
        reason=reason,
        cost_price=cost_price,
    )

    # Decrease stock only — do NOT change Avg PP / sales / payments
    product.product_stock_quantity = new_stock

    try:
        db.add(rejection)
        db.commit()
        db.refresh(rejection)

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to record rejection — transaction rolled back: {str(e)}"
        )

    return {
        "message": "Rejection recorded successfully",
        "rejection_id": rejection.rejection_id,
        "product_id": rejection.product_id,
        "rejected_quantity": rejection.quantity,
        "remaining_stock": new_stock,
        "cost_price": round(cost_price, 2),
        "rejection_loss": rejection_loss,
    }


def get_all_rejections(db: Session):
    rejections = db.query(RejectionDBModel).order_by(
        RejectionDBModel.rejection_date.desc()
    ).all()

    result = []

    for r in rejections:
        product = db.query(ProductDBModel).filter(
            ProductDBModel.product_id == r.product_id
        ).first()

        result.append({
            "rejection_id": r.rejection_id,
            "product_id": r.product_id,
            "product_name": product.product_name if product else "Unknown",
            "quantity": r.quantity,
            "rejection_date": str(r.rejection_date) if r.rejection_date else "",
            "reason": r.reason,
            "cost_price": round(r.cost_price, 2) if r.cost_price is not None else 0.0,
            "rejection_loss": round(r.quantity * (r.cost_price or 0.0), 2),
        })

    return result

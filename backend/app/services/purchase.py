from app.schemas.purchase import TempPurchase
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.product import ProductDBModel
from app.models.purchase import PurchaseDBModel, PurchaseItemDBModel
import uuid


def create_purchase(tempPurchase: TempPurchase, db: Session):

    # Check for duplicate product_id inside the same purchase request
    product_ids = [item.product_id for item in tempPurchase.items]

    if len(product_ids) != len(set(product_ids)):
        raise HTTPException(
            status_code=400,
            detail="Same product cannot be added twice in one purchase"
        )

    # Validate every product_id exists in the database
    products = []

    for item in tempPurchase.items:

        product = db.query(ProductDBModel).filter(
            ProductDBModel.product_id == item.product_id
        ).first()

        if not product:
            raise HTTPException(
                status_code=404,
                detail=f"Product with id '{item.product_id}' not found"
            )

        products.append((item, product))

    # Generate one purchase_id for the entire purchase
    purchase_id = str(uuid.uuid4())

    # Calculate total_amount in the backend
    total_amount = sum(item.quantity * item.purchase_price for item, _ in products)

    # Build ORM objects (not yet committed)
    purchase = PurchaseDBModel(
        purchase_id=purchase_id,
        supplier_name=tempPurchase.supplier_name,
        date=tempPurchase.purchase_date,
        total_amount=total_amount,
    )

    purchase_items = []
    for item, product in products:  
        purchase_items.append(
            PurchaseItemDBModel(
                purchase_item_id=str(uuid.uuid4()),
                purchase_id=purchase_id,
                product_id=item.product_id,
                quantity=item.quantity,
                purchase_price=item.purchase_price,
            )
        )
        # Increase stock (column is now Integer)
        current_stock = product.product_stock_quantity or 0
        current_avg_pp = product.product_purchase_price or 0.0

        new_quantity = item.quantity
        new_purchase_price = item.purchase_price

        new_stock = current_stock+new_quantity

        if current_stock == 0:
            new_avg_pp = new_purchase_price
        else:
            new_avg_pp = (
                (current_stock * current_avg_pp)
                + (new_quantity * new_purchase_price)
            ) / new_stock

        product.product_stock_quantity = new_stock
        product.product_purchase_price = new_avg_pp

    # Commit everything in a single transaction; rollback on any failure
    try:
        db.add(purchase)
        for pi in purchase_items:
            db.add(pi)
        db.commit()
        db.refresh(purchase)

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create purchase — transaction rolled back: {str(e)}"
        )

    return {
        "message": "Purchase created successfully",
        "purchase_id": purchase.purchase_id,
        "supplier_name": purchase.supplier_name,
        "date": str(purchase.date) if purchase.date else "",
        "total_amount": round(purchase.total_amount, 2),
        "items": [
            {
                "purchase_item_id": pi.purchase_item_id,
                "product_id": pi.product_id,
                "product_name": product.product_name,
                "quantity": pi.quantity,
                "purchase_price": pi.purchase_price,
            }
            for pi, (item, product) in zip(purchase_items, products)
        ],
    }


def get_all_purchase(db: Session):
    purchases = db.query(PurchaseDBModel).order_by(PurchaseDBModel.date.desc()).all()

    result = []

    for purchase in purchases:
        items = db.query(PurchaseItemDBModel).filter(
            PurchaseItemDBModel.purchase_id == purchase.purchase_id
        ).all()

        serialized_items = []
        for it in items:
            prod = db.query(ProductDBModel).filter(
                ProductDBModel.product_id == it.product_id
            ).first()
            serialized_items.append({
                "purchase_item_id": it.purchase_item_id,
                "product_id": it.product_id,
                "product_name": prod.product_name if prod else "Unknown",
                "quantity": it.quantity,
                "purchase_price": it.purchase_price,
            })

        result.append({
            "purchase_id": purchase.purchase_id,
            "supplier_name": purchase.supplier_name,
            "date": str(purchase.date) if purchase.date else "",
            "total_amount": purchase.total_amount,
            "items": serialized_items
        })

    return result

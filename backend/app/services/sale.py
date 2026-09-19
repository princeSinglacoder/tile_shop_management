from app.schemas.sales import TempSale
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.product import ProductDBModel
from app.models.sale import SaleDBModel, SaleItemDBModel
import uuid


def create_sale(tempSale: TempSale, db: Session):

    # Check for duplicate product_id inside the same sale request
    product_ids = [item.product_id for item in tempSale.items]

    if len(product_ids) != len(set(product_ids)):
        raise HTTPException(
            status_code=400,
            detail="Same product cannot be added twice in one sale"
        )

    # Validate every product_id exists in the database
    products = []

    for item in tempSale.items:

        product = db.query(ProductDBModel).filter(
            ProductDBModel.product_id == item.product_id
        ).first()

        if not product:
            raise HTTPException(
                status_code=404,
                detail=f"Product with id '{item.product_id}' not found"
            )

        # Check available stock is enough
        try:
            current_stock = int(float(product.product_stock_quantity or 0))
        except (ValueError, TypeError):
            current_stock = 0

        if current_stock < item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Not enough stock for product '{product.product_name}'. Available: {current_stock}, Requested: {item.quantity}"
            )

        products.append((item, product))

    # Generate one sale_id for the entire sale
    sale_id = str(uuid.uuid4())

    # Get selling_price from DB and calculate total_amount in the backend
    total_amount = 0.0
    for item, product in products:
        try:
            selling_price = float(product.product_selling_price or 0)
        except (ValueError, TypeError):
            selling_price = 0.0
        total_amount += item.quantity * selling_price

    # Build ORM objects (not yet committed)
    sale = SaleDBModel(
        sale_id=sale_id,
        customer_name=tempSale.customer_name,
        date=tempSale.sale_date,
        total_amount=total_amount,
    )

    sale_items = []
    for item, product in products:
        try:
            selling_price = float(product.product_selling_price or 0)
        except (ValueError, TypeError):
            selling_price = 0.0

        sale_items.append(
            SaleItemDBModel(
                sale_item_id=str(uuid.uuid4()),
                sale_id=sale_id,
                product_id=item.product_id,
                quantity=item.quantity,
                selling_price=selling_price,
            )
        )
        # Decrease stock safely (column stored as String, cast back to str)
        try:
            current_stock = int(float(product.product_stock_quantity or 0))
        except (ValueError, TypeError):
            current_stock = 0
        product.product_stock_quantity = str(current_stock - item.quantity)

    # Commit everything in a single transaction; rollback on any failure
    try:
        db.add(sale)
        for si in sale_items:
            db.add(si)
        db.commit()
        db.refresh(sale)

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create sale — transaction rolled back: {str(e)}"
        )

    return {
        "message": "Sale created successfully",
        "sale_id": sale.sale_id,
        "total_amount": round(sale.total_amount, 2),
    }


def get_all_sales(db: Session):
    sales = db.query(SaleDBModel).order_by(SaleDBModel.date.desc()).all()

    result = []

    for sale in sales:
        items = db.query(SaleItemDBModel).filter(
            SaleItemDBModel.sale_id == sale.sale_id
        ).all()

        serialized_items = []
        for it in items:
            prod = db.query(ProductDBModel).filter(
                ProductDBModel.product_id == it.product_id
            ).first()
            serialized_items.append({
                "sale_item_id": it.sale_item_id,
                "product_id": it.product_id,
                "product_name": prod.product_name if prod else "Unknown",
                "quantity": it.quantity,
                "selling_price": it.selling_price,
            })

        result.append({
            "sale_id": sale.sale_id,
            "customer_name": sale.customer_name,
            "date": str(sale.date) if sale.date else "",
            "total_amount": sale.total_amount,
            "items": serialized_items
        })

    return result

from datetime import date
from typing import Optional

from app.schemas.sales import TempSale, TempPayment, TempReturn
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.product import ProductDBModel
from app.models.sale import SaleDBModel, SaleItemDBModel
from app.utils.date_range import apply_date_range_filter
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
        current_stock = product.product_stock_quantity or 0

        if current_stock < item.quantity:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Not enough stock for product '{product.product_name}'. "
                    f"Available: {current_stock}, Requested: {item.quantity}"
                )
            )
        if item.quantity <= 0:
            raise HTTPException(
                status_code=400,
                detail="Quantity must be greater than 0"
            )

        if item.selling_price <= 0:
            raise HTTPException(
                status_code=400,
                detail="Selling price must be greater than 0"
            )

        products.append((item, product))

    # Generate one sale_id for the entire sale
    sale_id = str(uuid.uuid4())

    # Calculate total using the selling price enter by admin
    total_amount = 0.0

    for item, product in products:
        total_amount += item.quantity * item.selling_price

    total_amount = round(total_amount,2)

    cash_amount= tempSale.cash_amount
    upi_amount = tempSale.upi_amount
    udhari_amount = tempSale.udhari_amount

    payment_total = round(cash_amount+upi_amount+udhari_amount,2)

    if payment_total != total_amount:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Payment amounts must equal sale total. "
                f"Sale total: {total_amount}, "
                f"Cash: {cash_amount}, "
                f"UPI: {upi_amount}, "
                f"Udhaari: {udhari_amount}, "
                f"Payment total: {payment_total}"
            )
        )

    # Build ORM objects (not yet committed)
    sale = SaleDBModel(
        sale_id=sale_id,
        customer_name=tempSale.customer_name,
        phone_number=tempSale.phone_number,
        date=tempSale.sale_date,
        total_amount=total_amount,
        cash_amount = cash_amount,
        upi_amount = upi_amount,
        outstanding_amount = udhari_amount,
    )

    sale_items = []
    for item, product in products:
        # Snapshot the current average purchase price
        cost_price = product.product_purchase_price if product.product_purchase_price is not None else 0.0

        sale_items.append(
            SaleItemDBModel(
                sale_item_id=str(uuid.uuid4()),
                sale_id=sale_id,
                product_id=item.product_id,
                quantity=item.quantity,
                selling_price=item.selling_price,
                cost_price=cost_price
            )
        )
        # Decrease stock (column is now Integer)
        current_stock = product.product_stock_quantity or 0
        product.product_stock_quantity = current_stock - item.quantity

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
        "customer_name": sale.customer_name,
        "phone_number": sale.phone_number or "",
        "date": str(sale.date) if sale.date else "",
        "total_amount": round(sale.total_amount, 2),
        "cash_amount": round(sale.cash_amount, 2),
        "upi_amount": round(sale.upi_amount, 2),
        "outstanding_amount": round(sale.outstanding_amount, 2),
        "refund_amount": round(sale.refund_amount, 2) if sale.refund_amount is not None else 0.0,
        "items": [
            {
                "sale_item_id": si.sale_item_id,
                "product_id": si.product_id,
                "product_name": product.product_name,
                "quantity": si.quantity,
                "selling_price": si.selling_price,
                "cost_price": si.cost_price,
            }
            for si, (item, product) in zip(sale_items, products)
        ],
    }


def get_all_sales(db: Session):
    sales = db.query(SaleDBModel).order_by(SaleDBModel.date.desc()).all()
    return _serialize_sales(sales, db)


def filter_sales(
    db: Session,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
):
    query = db.query(SaleDBModel)
    query = apply_date_range_filter(query, SaleDBModel.date, start_date, end_date)
    sales = query.order_by(SaleDBModel.date.desc()).all()
    return _serialize_sales(sales, db)


def _serialize_sales(sales, db: Session):
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
                "cost_price": it.cost_price,
            })

        result.append({
            "sale_id": sale.sale_id,
            "customer_name": sale.customer_name,
            "phone_number": sale.phone_number or "",
            "date": str(sale.date) if sale.date else "",
            "total_amount": round(sale.total_amount, 2) if sale.total_amount is not None else 0.0,
            "cash_amount": round(sale.cash_amount, 2) if sale.cash_amount is not None else 0.0,
            "upi_amount": round(sale.upi_amount, 2) if sale.upi_amount is not None else 0.0,
            "outstanding_amount": round(sale.outstanding_amount, 2) if sale.outstanding_amount is not None else 0.0,
            "refund_amount": round(sale.refund_amount, 2) if sale.refund_amount is not None else 0.0,
            "items": serialized_items
        })

    return result


def get_outstanding_sales(db: Session):
    sales = db.query(SaleDBModel).filter(
        SaleDBModel.outstanding_amount > 0
    ).order_by(SaleDBModel.outstanding_amount.desc()).all()

    result = []

    for sale in sales:
        result.append({
            "sale_id": sale.sale_id,
            "customer_name": sale.customer_name,
            "phone_number": sale.phone_number or "",
            "outstanding_amount": round(sale.outstanding_amount, 2) if sale.outstanding_amount is not None else 0.0,
        })

    return result


def make_payment(sale_id: str, temp_payment: TempPayment, db: Session):
    sale = db.query(SaleDBModel).filter(SaleDBModel.sale_id == sale_id).first()

    if not sale:
        raise HTTPException(status_code=404, detail=f"Sale with id '{sale_id}' not found")

    if temp_payment.amount <= 0:
        raise HTTPException(
            status_code=400,
            detail="Payment amount must be greater than 0"
        )

    # Check that payment does not exceed outstanding amount
    if temp_payment.amount > sale.outstanding_amount:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Payment cannot be greater than outstanding amount. "
                f"Outstanding: {sale.outstanding_amount}, "
                f"Payment: {temp_payment.amount}"
            )
        )

    # Apply payment
    payment_amount = round(temp_payment.amount, 2)
    if temp_payment.payment_method == "cash":
        sale.cash_amount = round(sale.cash_amount + payment_amount, 2)

    elif temp_payment.payment_method == "upi":
        sale.upi_amount = round(sale.upi_amount + payment_amount, 2)

    # Reduce outstanding
    remaining_outstanding = round(sale.outstanding_amount - payment_amount, 2)
    sale.outstanding_amount = 0.0 if remaining_outstanding < 0.001 else remaining_outstanding

    try:
        db.commit()
        db.refresh(sale)

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process payment — transaction rolled back: {str(e)}"
        )

    return {
        "message": "Payment recorded successfully",
        "sale_id": sale.sale_id,
        "cash_amount": round(sale.cash_amount, 2),
        "upi_amount": round(sale.upi_amount, 2),
        "outstanding_amount": round(sale.outstanding_amount, 2)
    }


def return_product_service(sale_id: str, temp_return: TempReturn, db: Session):
    # ---------------------------------------------------
    # 1. Check sale exists
    # ---------------------------------------------------

    sale = db.query(SaleDBModel).filter(
        SaleDBModel.sale_id == sale_id
    ).first()

    if not sale:
        raise HTTPException(
            status_code=404,
            detail=f"Sale with id '{sale_id}' not found"
        )

    # ---------------------------------------------------
    # 2. Get requested sale_item_ids
    # ---------------------------------------------------

    sale_item_ids = [
        item.sale_item_id
        for item in temp_return.items
    ]


    # ---------------------------------------------------
    # 3. Check duplicate sale_item_id
    # ---------------------------------------------------

    if len(sale_item_ids) != len(set(sale_item_ids)):
        raise HTTPException(
            status_code=400,
            detail="Same sale item cannot be returned twice in one request"
        )

    return_items = []

    for request_item in temp_return.items:

        sale_item = db.query(SaleItemDBModel).filter(
            SaleItemDBModel.sale_item_id == request_item.sale_item_id
        ).first()

        if not sale_item:
            raise HTTPException(
                status_code=404,
                detail=f"Sale item with id '{request_item.sale_item_id}' not found"
            )

        # Make sure this sale item belong to the current sale

        if sale_item.sale_id != sale_id:
            raise HTTPException(
                status_code=400,
                detail=f"Sale item '{request_item.sale_item_id}' does not belong to sale '{sale_id}'"
            )

        # Make sure requested return quantity is valid
        if request_item.quantity <= 0:
            raise HTTPException(
                status_code=400,
                detail="Return quantity must be greater than 0"
            )

        if request_item.quantity > sale_item.quantity:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Cannot return {request_item.quantity} boxes. "
                    f"Only {sale_item.quantity} boxes were sold in this sale item."
                )
            )

        # Store complete DB row for later calculations
        return_items.append(
            (request_item, sale_item)
        )

    total_return_amount = 0.0

    for request_item, sale_item in return_items:

        total_return_amount += (
            request_item.quantity * sale_item.selling_price
        )

    total_return_amount = round(total_return_amount, 2)

    # calculate new sale total
    new_sale_total = round(sale.total_amount-total_return_amount,2)

    if new_sale_total < 0:
        raise HTTPException(
            status_code=400,
            detail="Return amount cannot exceed sale amount"
        )

    current_outstanding = sale.outstanding_amount or 0.0
    current_refund = sale.refund_amount or 0.0

    if total_return_amount <= current_outstanding:

        # Customer still has some outstanding amount
        sale.outstanding_amount = round(
            current_outstanding - total_return_amount,
            2
        )
    else:
         # Return amount is greater than outstanding amount
        refund_amount = round(
            total_return_amount - current_outstanding,
            2
        )

        sale.outstanding_amount = 0.0

        sale.refund_amount = round(
            current_refund + refund_amount,
            2
        )

    # Update sale total
    sale.total_amount = new_sale_total

    # ---------------------------------------------------
    # Update products and sale item quantities
    # ---------------------------------------------------

    updated_items = []

    for request_item, sale_item in return_items:

        return_quantity = request_item.quantity

        # Fetch current product
        product = db.query(ProductDBModel).filter(
            ProductDBModel.product_id == sale_item.product_id
        ).first()

        if not product:
            raise HTTPException(
                status_code=404,
                detail=(
                    f"Product '{sale_item.product_id}' "
                    f"not found"
                )
            )

        # Current inventory state
        current_stock = (
            product.product_stock_quantity
            if product.product_stock_quantity is not None
            else 0
        )

        current_avg_pp = (
            product.product_purchase_price
            if product.product_purchase_price is not None
            else 0.0
        )

        # Current inventory value
        current_inventory_value = (
            current_stock * current_avg_pp
        )

        # Returned products come back at
        # their original sale-time cost
        returned_inventory_value = (
            return_quantity * sale_item.cost_price
        )

        # New stock
        new_stock = current_stock + return_quantity

        # New inventory value
        new_inventory_value = (
            current_inventory_value
            + returned_inventory_value
        )

        # Recalculate weighted average PP
        new_avg_pp = (
            new_inventory_value / new_stock
            if new_stock > 0
            else 0.0
        )

        # Update product
        product.product_stock_quantity = new_stock
        product.product_purchase_price = new_avg_pp

        # Overwrite sold quantity
        sale_item.quantity -= return_quantity

        updated_items.append({
            "sale_item_id": sale_item.sale_item_id,
            "product_id": sale_item.product_id,
            "returned_quantity": return_quantity,
            "remaining_quantity": sale_item.quantity,
            "product_stock_quantity": new_stock,
            "product_purchase_price": round(new_avg_pp, 2),
        })

    # ---------------------------------------------------
    # Commit everything together
    # ---------------------------------------------------

    try:

        db.commit()
        db.refresh(sale)

    except Exception as e:

        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                "Failed to process return — "
                f"transaction rolled back: {str(e)}"
            )
        )

    # ---------------------------------------------------
    # Response
    # ---------------------------------------------------

    return {
        "message": "Return processed successfully",
        "sale_id": sale.sale_id,
        "total_return_amount": total_return_amount,
        "total_amount": round(
            sale.total_amount,
            2
        ),
        "outstanding_amount": round(
            sale.outstanding_amount,
            2
        ),
        "refund_amount": round(
            sale.refund_amount,
            2
        ),
        "items": updated_items
    }


def complete_refund_service(sale_id: str, db: Session):
    sale = db.query(SaleDBModel).filter(
        SaleDBModel.sale_id == sale_id
    ).first()

    if not sale:
        raise HTTPException(
            status_code=404,
            detail=f"Sale with id '{sale_id}' not found"
        )

    current_refund = sale.refund_amount or 0.0

    if current_refund <= 0:
        raise HTTPException(
            status_code=400,
            detail="No refund due for this sale"
        )

    sale.refund_amount = 0.0

    try:
        db.commit()
        db.refresh(sale)

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to complete refund — transaction rolled back: {str(e)}"
        )

    return {
        "message": "Refund marked as completed",
        "sale_id": sale.sale_id,
        "refund_amount": round(sale.refund_amount, 2),
    }
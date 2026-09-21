from fastapi import HTTPException
from app.schemas.product import TempProduct, Product, ProductUpdate
from sqlalchemy.orm import Session
from uuid import uuid4
from app.databases.product import add_product as add_product_db
from app.databases.product import update_product as update_product_db
from app.models.product import ProductDBModel
from app.utils.normalize_product import normalize
from app.models.purchase import PurchaseItemDBModel
from app.models.sale import SaleItemDBModel

def add_product(tempProduct: TempProduct, db: Session):

    # first we normalize the product name, brand and size to avoid duplicates
    tempProduct.name = normalize(tempProduct.name)
    tempProduct.brand = normalize(tempProduct.brand)
    tempProduct.size = normalize(tempProduct.size)

    # Check if the product already exists in the database
    existing_product = db.query(ProductDBModel).filter(
        ProductDBModel.product_name == tempProduct.name,
        ProductDBModel.product_brand == tempProduct.brand,
        ProductDBModel.product_size == tempProduct.size
    ).first()

    # If the product already exists, return an error message
    if existing_product:
        return {"message": "Product already exists"}

    # Now we can make an object of product and add it to the database
    product_obj = Product(
        id=str(uuid4()),
        name=tempProduct.name,
        brand=tempProduct.brand,
        size=tempProduct.size,
        selling_price=tempProduct.selling_price,
        stock_quantity=tempProduct.stock_quantity   
    )

    # Now we have Product object, we can add it to the database
    return add_product_db(product_obj, db)

def update_product(product_id: str, product_update: ProductUpdate, db: Session):
    # first we normalize the product name, brand and size to avoid duplicates

    if product_update.name:
        product_update.name = normalize(product_update.name)
    if product_update.brand:
        product_update.brand = normalize(product_update.brand)
    if product_update.size:
        product_update.size = normalize(product_update.size)

    return update_product_db(product_id, product_update, db)

def delete_product(product_id: str, db: Session):
    # Check if the product exists in the db
    existing_product = db.query(ProductDBModel).filter(
        ProductDBModel.product_id == product_id
    ).first()

    # If the product does not exist, return an error message
    if not existing_product:
        return {"message": "Product does not exist"}


    # Check purchase history
    purchase_exists = db.query(PurchaseItemDBModel).filter(
        PurchaseItemDBModel.product_id==product_id
    ).first()

    # Check sale history
    sale_exists =db.query(SaleItemDBModel).filter(
        SaleItemDBModel.product_id==product_id
    ).first()

    if purchase_exists or sale_exists:
        raise HTTPException(
            status_code=409,
            detail="Product cannot be deleted because it has transaction history."
        )

    # Safe to delete
    try:
        db.delete(existing_product)
        db.commit()

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to delete product"
        )

    return {
        "message": "Product deleted successfully"
    }
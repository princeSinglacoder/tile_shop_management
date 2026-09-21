
from app.schemas.product import Product
from sqlalchemy.orm import Session
from app.models.product import ProductDBModel

def add_product(product: Product, db: Session):
    # Now we can make an object of product and add it to the database
    new_product = ProductDBModel(
        product_id=product.id,
        product_name=product.name,
        product_brand=product.brand,
        product_size=product.size,
        product_purchase_price = product.purchase_price,
        product_stock_quantity=product.stock_quantity
    )

    # Add the new product to the database
    db.add(new_product)
    db.commit()
    db.refresh(new_product)
    return new_product

def update_product(product_id: str, product_update: Product, db: Session):
    # Check if the product exists in the db
    existing_product = db.query(ProductDBModel).filter(
        ProductDBModel.product_id == product_id
    ).first()

    # If the product does not exist, return an error message
    if not existing_product:
        return {"message": "Product does not exist"}

    # Update the existing product with the new values

    if product_update.name is not None:
        existing_product.product_name = product_update.name

    if product_update.brand is not None:
        existing_product.product_brand = product_update.brand

    if product_update.size is not None:
        existing_product.product_size = product_update.size

    # Commit the changes to the database
    db.commit()
    db.refresh(existing_product)
    return existing_product
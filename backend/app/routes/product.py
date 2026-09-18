from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.schemas.product import TempProduct, ProductUpdate
from app.databases.database import get_db
from app.utils.jwt import get_current_user
from app.services.product import add_product, update_product, delete_product as delete_product_service
from app.models.user import UserDBModel
from app.models.product import ProductDBModel

router = APIRouter(
    prefix="/product",
    tags=["product"]
)

@router.post("/add")
def create_product(tempProduct: TempProduct, current_user: UserDBModel = Depends(get_current_user), db: Session = Depends(get_db)):
    # check current user is admin or not
    if current_user.user_role != 'admin':
        return {"message": "You are not authorized to add a product"}
        
    return add_product(tempProduct, db)

@router.get("/all")
def get_all_products(current_user: UserDBModel = Depends(get_current_user), db: Session = Depends(get_db)):
    # check current user is admin or not
    if current_user.user_role != 'admin':
        return {"message": "You are not authorized to view all products"}

    return db.query(ProductDBModel).all()

@router.put("/edit/{product_id}")
def edit_product(product_id: str, product_update: ProductUpdate, current_user: UserDBModel = Depends(get_current_user), db: Session = Depends(get_db)):
    # check current user is admin or not
    if current_user.user_role != 'admin':
        return {"message": "You are not authorized to edit a product"}

    return update_product(product_id, product_update, db)

@router.delete("/delete/{product_id}")
def delete_product(product_id: str, current_user: UserDBModel = Depends(get_current_user), db: Session = Depends(get_db)):
    # check current user is admin or not
    if current_user.user_role != 'admin':
        return {"message": "You are not authorized to delete a product"}

    return delete_product_service(product_id, db)    
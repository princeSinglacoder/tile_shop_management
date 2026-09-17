
from fastapi import APIRouter, Response, Depends
from app.schemas.user import UserLogin
from app.databases.database import get_db
from sqlalchemy.orm import Session

from app.models.user import UserDBModel

router = APIRouter(
    prefix="/user",
    tags=["user"]
)

@router.post("/login")
def login_user(loginUser: UserLogin, response:Response, db: Session = Depends(get_db)):
    # Check user credentials and perform login logic here

    # first check the user email and password in the database
    user = db.query(UserDBModel).filter(UserDBModel.user_email == loginUser.email).first()
    if not user or user.user_pass!= loginUser.password:
        response.status_code = 401
        return {"message": "Invalid email or password"}

    # If the credentials are valid, return a token
    from app.utils.jwt import create_jwt_token
    token = create_jwt_token(user.user_id)

    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="lax"
    )

    return {"message": "Login successful", "token": token}
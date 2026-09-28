from fastapi import APIRouter, Response, Depends, HTTPException
from sqlalchemy.orm import Session
from app.schemas.user import UserLogin
from app.databases.database import get_db
from app.models.user import UserDBModel
from app.utils.hash_pass import pwd_context
from app.utils.jwt import create_jwt_token, get_current_user
from app.config import get_settings

settings = get_settings()

router = APIRouter(
    prefix="/user",
    tags=["user"]
)


@router.post("/login")
def login_user(loginUser: UserLogin, response: Response, db: Session = Depends(get_db)):
    # 1. Look up user by email
    user = db.query(UserDBModel).filter(UserDBModel.user_email == loginUser.email).first()

    # 2. Verify password against bcrypt hash
    if not user or not pwd_context.verify(loginUser.password, user.user_pass):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # 3. Create JWT token
    token = create_jwt_token(user.user_id)

    # 4. Set token in HttpOnly cookie only — NOT in response body
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,                          # JS cannot read this cookie
        secure=settings.IS_PRODUCTION,          # True in production (HTTPS only)
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )

    # 5. Return only success message — token is in the cookie
    return {"message": "Login successful"}


@router.get("/me")
def get_me(current_user: UserDBModel = Depends(get_current_user)):
    return {"message": "authenticated", "user_id": current_user.user_id}


@router.post("/logout")
def logout_user(response: Response, current_user: UserDBModel = Depends(get_current_user)):
    if current_user.user_role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can logout via this endpoint")

    response.delete_cookie(
        key="access_token",
        httponly=True,
        secure=settings.IS_PRODUCTION,
        samesite="lax",
    )
    return {"message": "Logged out successfully"}

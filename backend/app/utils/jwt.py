from fastapi import Request, Depends, HTTPException
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from app.databases.database import get_db
from app.models.user import UserDBModel
from app.config import get_settings

settings = get_settings()


def create_jwt_token(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def get_current_user(request: Request, db=Depends(get_db)):
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Not authenticated")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = db.query(UserDBModel).filter(UserDBModel.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user

from fastapi import Request, Depends, HTTPException
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from app.databases.database import get_db
from app.models.user import UserDBModel

SECRET_KEY = 'SECRET123'
ALGORITHM = 'HS256'
ACCESS_TOKEN_EXPIRE_MINUTES = 30

def create_jwt_token(user_id: str):
    payload = {
        "user_id": user_id,
        "exp": datetime.now(timezone.utc)+timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    }

    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return token

def get_current_user(request: Request, db = Depends(get_db)):
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Not authenticated")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    # Fetch the user from the database using the user_id
    user = db.query(UserDBModel).filter(UserDBModel.user_id == user_id).first()

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user

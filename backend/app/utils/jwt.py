from datetime import datetime, timedelta, timezone
from jose import jwt


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
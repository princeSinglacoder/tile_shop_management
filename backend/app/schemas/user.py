
from pydantic import BaseModel, Field, EmailStr
from typing import Optional


class UserLogin(BaseModel):
    email: EmailStr = Field(..., example="john.doe@example.com")
    password: str = Field(..., example="securepassword123")
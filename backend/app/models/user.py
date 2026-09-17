from app.databases.database import Base
from sqlalchemy import Column,String

class UserDBModel(Base):
    __tablename__ = "user_data"
    user_id = Column(String, primary_key= True, index = True)
    user_name = Column(String)
    user_email = Column(String)
    user_pass = Column(String)
    user_role = Column(String)
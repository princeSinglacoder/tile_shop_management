from fastapi import FastAPI
from app.routes.user import router as user_router
from app.routes.product import router as product_router
from fastapi.middleware.cors import CORSMiddleware
from app.databases.database import Base,engine
from app.models.user import UserDBModel
from app.models.product import ProductDBModel


app = FastAPI()

Base.metadata.create_all(bind = engine)

app.include_router(user_router)
app.include_router(product_router)

@app.get("/")
def read_root():
    return {"Hello": "World"}
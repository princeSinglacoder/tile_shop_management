from fastapi import FastAPI
from app.routes.user import router as user_router
from app.routes.product import router as product_router
from app.routes.purchase import router as purchase_router
from app.routes.sale import router as sale_router
from app.routes.rejection import router as rejection_router
from app.routes.expense import router as expense_router
from app.routes.report import router as report_router
from fastapi.middleware.cors import CORSMiddleware
from app.databases.database import Base,engine
from app.models.user import UserDBModel
from app.models.product import ProductDBModel
from app.models.purchase import PurchaseItemDBModel, PurchaseDBModel
from app.models.sale import SaleDBModel, SaleItemDBModel
from app.models.rejection import RejectionDBModel
from app.models.expense import ExpenseDBModel


app = FastAPI()

# CORS — required for browser fetch() with credentials: "include"
# allow_credentials=True is needed for the HttpOnly access_token cookie to be sent
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "null",          # for file:// protocol (open HTML directly)
    ],
    allow_credentials=True,   # required for cookies
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind = engine)

app.include_router(user_router)
app.include_router(product_router)
app.include_router(purchase_router)
app.include_router(sale_router)
app.include_router(rejection_router)
app.include_router(expense_router)
app.include_router(report_router)

@app.get("/")
def read_root():
    return {"Hello": "World"}

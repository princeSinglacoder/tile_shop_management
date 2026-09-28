from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.databases.database import Base, engine

from app.models.user import UserDBModel
from app.models.product import ProductDBModel
from app.models.purchase import PurchaseItemDBModel, PurchaseDBModel
from app.models.sale import SaleDBModel, SaleItemDBModel
from app.models.rejection import RejectionDBModel
from app.models.expense import ExpenseDBModel

from app.routes.user import router as user_router
from app.routes.product import router as product_router
from app.routes.purchase import router as purchase_router
from app.routes.sale import router as sale_router
from app.routes.rejection import router as rejection_router
from app.routes.expense import router as expense_router
from app.routes.report import router as report_router

settings = get_settings()

app = FastAPI(
    title="Pooja Tiles Hodal",
    # Disable docs in production
    docs_url=None if settings.IS_PRODUCTION else "/docs",
    redoc_url=None if settings.IS_PRODUCTION else "/redoc",
)

# CORS — origins loaded from .env
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,   # required for HttpOnly cookies
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create all tables
Base.metadata.create_all(bind=engine)

# Routers
app.include_router(user_router)
app.include_router(product_router)
app.include_router(purchase_router)
app.include_router(sale_router)
app.include_router(rejection_router)
app.include_router(expense_router)
app.include_router(report_router)


@app.get("/")
def read_root():
    return {"status": "ok", "app": "Pooja Tiles Hodal"}

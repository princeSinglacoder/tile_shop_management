"""
Reports & Business Summary — derived aggregations only.

Period metrics use optional inclusive date bounds on each domain's date column.
Current-snapshot metrics (inventory, receivables) ignore the date range.
"""

from datetime import date
from typing import Optional

from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.models.expense import ExpenseDBModel
from app.models.product import ProductDBModel
from app.models.purchase import PurchaseDBModel, PurchaseItemDBModel
from app.models.rejection import RejectionDBModel
from app.models.sale import SaleDBModel, SaleItemDBModel
from app.utils.date_range import apply_date_range_filter

# Matches products.js / dashboard.js low-stock rule
LOW_STOCK_MAX = 15


def _money(value) -> float:
    return round(float(value or 0), 2)


def _int(value) -> int:
    return int(value or 0)


def _scalar(query, default=0):
    result = query.scalar()
    return default if result is None else result


def _period_sales(db: Session, start_date: Optional[date], end_date: Optional[date]) -> dict:
    sales_q = db.query(
        func.coalesce(func.sum(SaleDBModel.total_amount), 0.0).label("revenue"),
        func.coalesce(
            func.sum(case((SaleDBModel.total_amount > 0, 1), else_=0)),
            0,
        ).label("orders"),
        func.coalesce(func.sum(SaleDBModel.cash_amount), 0.0).label("cash"),
        func.coalesce(func.sum(SaleDBModel.upi_amount), 0.0).label("upi"),
        func.coalesce(func.sum(SaleDBModel.refunded_amount), 0.0).label("refunded"),
    )
    sales_q = apply_date_range_filter(sales_q, SaleDBModel.date, start_date, end_date)
    row = sales_q.one()

    qty_q = (
        db.query(func.coalesce(func.sum(SaleItemDBModel.quantity), 0))
        .join(SaleDBModel, SaleItemDBModel.sale_id == SaleDBModel.sale_id)
    )
    qty_q = apply_date_range_filter(qty_q, SaleDBModel.date, start_date, end_date)

    cogs_q = (
        db.query(
            func.coalesce(
                func.sum(SaleItemDBModel.quantity * SaleItemDBModel.cost_price),
                0.0,
            )
        )
        .join(SaleDBModel, SaleItemDBModel.sale_id == SaleDBModel.sale_id)
    )
    cogs_q = apply_date_range_filter(cogs_q, SaleDBModel.date, start_date, end_date)

    revenue = _money(row.revenue)
    cogs = _money(_scalar(cogs_q))
    cash = _money(row.cash)
    upi = _money(row.upi)
    refunded = _money(row.refunded)
    total_collected = _money((cash + upi) - refunded)

    return {
        "revenue": revenue,
        "orders": _int(row.orders),
        "quantity_sold": _int(_scalar(qty_q)),
        "cash_received": cash,
        "upi_received": upi,
        "refunded_amount": refunded,
        "total_collected": total_collected,
        "total_collected_amount": total_collected,
        "cogs": cogs,
    }


def _period_purchases(db: Session, start_date: Optional[date], end_date: Optional[date]) -> dict:
    purchases_q = db.query(
        func.coalesce(func.sum(PurchaseDBModel.total_amount), 0.0).label("amount"),
        func.coalesce(func.count(PurchaseDBModel.purchase_id), 0).label("orders"),
    )
    purchases_q = apply_date_range_filter(
        purchases_q, PurchaseDBModel.date, start_date, end_date
    )
    row = purchases_q.one()

    qty_q = (
        db.query(func.coalesce(func.sum(PurchaseItemDBModel.quantity), 0))
        .join(PurchaseDBModel, PurchaseItemDBModel.purchase_id == PurchaseDBModel.purchase_id)
    )
    qty_q = apply_date_range_filter(qty_q, PurchaseDBModel.date, start_date, end_date)

    return {
        "amount": _money(row.amount),
        "orders": _int(row.orders),
        "quantity": _int(_scalar(qty_q)),
    }


def _period_rejections(db: Session, start_date: Optional[date], end_date: Optional[date]) -> dict:
    q = db.query(
        func.coalesce(func.sum(RejectionDBModel.quantity), 0).label("quantity"),
        func.coalesce(
            func.sum(RejectionDBModel.quantity * RejectionDBModel.cost_price),
            0.0,
        ).label("loss"),
    )
    q = apply_date_range_filter(q, RejectionDBModel.rejection_date, start_date, end_date)
    row = q.one()
    return {
        "quantity": _int(row.quantity),
        "loss": _money(row.loss),
    }


def _period_expenses(db: Session, start_date: Optional[date], end_date: Optional[date]) -> dict:
    q = db.query(func.coalesce(func.sum(ExpenseDBModel.amount), 0.0))
    q = apply_date_range_filter(q, ExpenseDBModel.expense_date, start_date, end_date)
    return {"total": _money(_scalar(q))}


def _current_inventory(db: Session) -> dict:
    stock = _int(
        _scalar(db.query(func.coalesce(func.sum(ProductDBModel.product_stock_quantity), 0)))
    )
    inventory_value = _money(
        _scalar(
            db.query(
                func.coalesce(
                    func.sum(
                        ProductDBModel.product_stock_quantity
                        * ProductDBModel.product_purchase_price
                    ),
                    0.0,
                )
            )
        )
    )
    total_designs = _int(
        _scalar(db.query(func.coalesce(func.count(ProductDBModel.product_id), 0)))
    )
    low_stock = _int(
        _scalar(
            db.query(func.count(ProductDBModel.product_id)).filter(
                ProductDBModel.product_stock_quantity > 0,
                ProductDBModel.product_stock_quantity <= LOW_STOCK_MAX,
            )
        )
    )
    out_of_stock = _int(
        _scalar(
            db.query(func.count(ProductDBModel.product_id)).filter(
                ProductDBModel.product_stock_quantity == 0
            )
        )
    )
    return {
        "stock": stock,
        "inventory_value": inventory_value,
        "total_designs": total_designs,
        "low_stock": low_stock,
        "out_of_stock": out_of_stock,
    }


def _current_receivables(db: Session) -> dict:
    row = db.query(
        func.coalesce(func.sum(SaleDBModel.outstanding_amount), 0.0).label("outstanding"),
        func.coalesce(func.sum(SaleDBModel.refund_amount), 0.0).label("refund_pending"),
        func.coalesce(func.sum(SaleDBModel.refunded_amount), 0.0).label("refund_completed"),
    ).one()
    return {
        "outstanding": _money(row.outstanding),
        "refund_pending": _money(row.refund_pending),
        "refund_completed": _money(row.refund_completed),
    }


def build_report(
    db: Session,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> dict:
    """
    Build the full report payload.

    When start_date/end_date are None, period metrics cover all history.
    Inventory and receivables always reflect current DB state.
    """
    sales = _period_sales(db, start_date, end_date)
    purchases = _period_purchases(db, start_date, end_date)
    rejections = _period_rejections(db, start_date, end_date)
    expenses = _period_expenses(db, start_date, end_date)

    revenue = sales["revenue"]
    cogs = sales.pop("cogs")
    gross_profit = _money(revenue - cogs)
    net_profit = _money(gross_profit - rejections["loss"] - expenses["total"])

    return {
        "sales": {
            "revenue": revenue,
            "orders": sales["orders"],
            "quantity_sold": sales["quantity_sold"],
            "cash_received": sales["cash_received"],
            "upi_received": sales["upi_received"],
            "refunded_amount": sales["refunded_amount"],
            "total_collected": sales["total_collected"],
            "total_collected_amount": sales["total_collected_amount"],
        },
        "purchases": purchases,
        "rejections": rejections,
        "expenses": expenses,
        "profit": {
            "cogs": cogs,
            "gross_profit": gross_profit,
            "net_profit": net_profit,
        },
        "inventory": _current_inventory(db),
        "receivables": _current_receivables(db),
    }


def get_report_summary(db: Session) -> dict:
    return build_report(db, start_date=None, end_date=None)


def get_filtered_report(
    db: Session,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> dict:
    return build_report(db, start_date=start_date, end_date=end_date)

/**
 * Application Configuration & API Endpoints
 * Maps exactly to the FastAPI backend at http://127.0.0.1:8000
 */

const CONFIG = {
  // Backend API Base URL
  API_BASE_URL: "https://pooja-tiles.onrender.com",

  // Exact Endpoint Mappings
  ENDPOINTS: {
    // User Authentication
    LOGIN: "/user/login",
    ME: "/user/me",
    LOGOUT: "/user/logout",

    // Product CRUD Operations
    PRODUCTS_ALL: "/product/all",
    PRODUCT_ADD: "/product/add",
    PRODUCT_EDIT: (productId) => `/product/edit/${encodeURIComponent(productId)}`,
    PRODUCT_DELETE: (productId) => `/product/delete/${encodeURIComponent(productId)}`,

    // Purchase Operations
    PURCHASE_CREATE: "/purchases/create",
    PURCHASES_ALL: "/purchases/all",
    PURCHASES_FILTER: "/purchases/filter",

    // Sales Operations
    SALE_CREATE: "/sales/create",
    SALES_ALL: "/sales/all",
    SALES_FILTER: "/sales/filter",
    SALES_OUTSTANDING: "/sales/outstanding",
    SALE_PAYMENT: (saleId) => `/sales/${encodeURIComponent(saleId)}/payment`,
    SALE_RETURN: (saleId) => `/sales/${encodeURIComponent(saleId)}/return`,
    SALE_REFUND_COMPLETE: (saleId) => `/sales/${encodeURIComponent(saleId)}/refund-complete`,

    // Rejection / Waste Operations
    REJECTION_CREATE: "/rejections/create",
    REJECTIONS_ALL: "/rejections/all",
    REJECTIONS_FILTER: "/rejections/filter",

    // Expense Operations
    EXPENSE_CREATE: "/expenses/create",
    EXPENSES_ALL: "/expenses/all",
    EXPENSES_FILTER: "/expenses/filter",

    // Reports & Business Summary
    REPORTS_SUMMARY: "/reports/summary",
    REPORTS_FILTER: "/reports/filter",
  },

};

// Freeze configuration to prevent accidental modification
Object.freeze(CONFIG);
Object.freeze(CONFIG.ENDPOINTS);

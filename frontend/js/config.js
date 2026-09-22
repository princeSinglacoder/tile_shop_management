/**
 * Application Configuration & API Endpoints
 * Maps exactly to the FastAPI backend at http://127.0.0.1:8000
 */

const CONFIG = {
  // Backend API Base URL
  API_BASE_URL: "http://127.0.0.1:8000",

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

    // Sales Operations
    SALE_CREATE: "/sales/create",
    SALES_ALL: "/sales/all",
    SALE_PAYMENT: (saleId) => `/sales/${encodeURIComponent(saleId)}/payment`,
  },

};

// Freeze configuration to prevent accidental modification
Object.freeze(CONFIG);
Object.freeze(CONFIG.ENDPOINTS);

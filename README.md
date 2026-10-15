# Retail Client — Tile Shop Management & POS System

A complete retail enterprise management, point-of-sale (POS), inventory tracking, and financial analytics platform tailored specifically for tile, marble, and ceramic retail shops.

Developed for **Pooja Tiles Hodal**, this platform automates the entire retail operations cycle: multi-item supplier shipments, weighted-average cost inventory tracking, multi-tender POS billing, customer credit accounts (Khata), product returns, transit/warehouse damage control, daily operating expenses, and real-time net profit intelligence.

---

## Key Features

### 1. Inventory & Catalog Management
- **Tile Specifications**: Categorize items by product name, manufacturer/brand, and tile dimensions (e.g., 12x18, 2x2, 2x4).
- **Weighted-Average Costing**: Automatically updates average purchase cost upon receiving new stock batches.
- **Stock Status Alerts**: Visual badges for In Stock, Low Stock (15 units or fewer), and Out of Stock.
- **Inventory Valuation**: Real-time calculation of total quantity and asset value based on purchase costs.

### 2. Point of Sale (POS) & Billing
- **Fast Multi-Item Invoicing**: Real-time product search with instant stock verification.
- **Split Payment Methods**: Accept payments split between Cash and UPI / Online transfers.
- **Credit & Outstanding (Khata)**: Automatically compute customer balances when invoices are partially paid.
- **Printable Invoices**: Built-in modal receipt rendering optimized for thermal bill printers and A4 prints.

### 3. Receivables & Customer Ledger
- **Outstanding Balance Tracker**: View and filter pending customer dues.
- **Installment Recording**: Add subsequent cash or UPI payments against past sales with automatic balance adjustments.

### 4. Sales Returns & Customer Refunds
- **Item-Level Returns**: Process returns for full or partial item quantities.
- **Automatic Restocking**: Immediately restores returned items into available inventory.
- **Margin & COGS Correction**: Automatically adjusts sales totals and cost of goods sold.
- **Refund Settlement Workflow**: Tracks pending refunds vs. disbursed payouts.

### 5. Supplier Purchases & Procurement
- **Inward Shipment Entries**: Record supplier purchases with item quantities and unit purchase costs.
- **Instant Stock Inward**: Adds incoming stock directly to warehouse counts.
- **Procurement History**: Search and filter purchase orders by date range.

### 6. Damage, Breakage & Wastage Tracking
- **Breakage Logging**: Record chipped, broken, or defective tiles during transit or unloading.
- **Reason Tracking**: Classify damage reasons for quality control and vendor accountability.
- **Automatic Shrinkage Loss**: Deducts damaged items from stock and records financial loss at unit purchase cost.

### 7. Operating Expenses
- **Store Expense Logging**: Track recurring overhead (rent, electricity, labor, transport, refreshments, maintenance).
- **Categorized Tracking**: Review costs by category and date range.

### 8. Financial Reports & Analytics
- **Live Business KPIs**:
  - Total Revenue & Order Volume
  - Cash vs. UPI collections
  - Cost of Goods Sold (COGS)
  - Gross Profit and Net Profit
  - Outstanding Receivables
  - Breakage Losses and Operating Expenses
- **Date Range Filters**: Filter metrics for Today, Yesterday, Last 7 Days, Month-to-Date, or any custom date bracket.

---

## System Architecture

The application is structured into a clean decoupled architecture:

```
+--------------------------------------------------------+
|            Frontend (HTML5 / Modern CSS3 / ES6+)       |
|  * Dashboard  * Products  * Sales POS  * Purchases     |
|  * Breakages  * Expenses  * Reports    * Login Portal  |
+---------------------------+----------------------------+
                            |
                 RESTful HTTP Requests
               (HttpOnly Cookie Session)
                            |
+---------------------------v----------------------------+
|                  FastAPI Backend Server                |
|  - CORS & Security Middleware                          |
|  - Routers (/user, /product, /sales, /purchases, etc.) |
|  - Business Logic Services & Financial Aggregators     |
|  - SQLAlchemy ORM & Pydantic Data Validation           |
+---------------------------+----------------------------+
                            |
                   PostgreSQL Database
```

---

## Technology Stack

### Backend
- **Framework**: FastAPI (Python 3.10+)
- **Server**: Uvicorn ASGI Server
- **ORM**: SQLAlchemy
- **Database Driver**: psycopg (psycopg3 PostgreSQL driver)
- **Validation & Settings**: Pydantic v2 and pydantic-settings
- **Security & Tokens**: python-jose (HS256 JWT), passlib, bcrypt

### Frontend
- **Structure**: Semantic HTML5
- **Styling**: Vanilla CSS3 custom design system (CSS variables, dark modern theme, responsive grids)
- **Scripting**: Modular Vanilla JavaScript (ES6+), native Fetch API, async/await
- **Session Handling**: Protected HttpOnly session cookies

### Database
- **Engine**: PostgreSQL (Local, Docker, Render, AWS, or Supabase)

---

## Financial & Accounting Calculations

The system uses standard retail financial formulas:

1. **Weighted Average Cost Price**:
   New Cost = ((Current Stock * Current Cost) + (Incoming Qty * Incoming Price)) / (Current Stock + Incoming Qty)

2. **Cost of Goods Sold (COGS)**:
   COGS = Sum of (Sold Quantity * Unit Cost Price at time of sale)

3. **Gross Profit**:
   Gross Profit = Total Revenue - COGS

4. **Net Profit**:
   Net Profit = Gross Profit - Damage Losses - Operating Expenses

5. **Customer Outstanding Balance**:
   Outstanding Balance = Total Invoice Amount - (Cash Paid + UPI Paid) + (Refund Completed - Refund Deductions)

---

## Project Structure

```text
tile_shop_manag/
├── backend/
│   ├── app/
│   │   ├── databases/
│   │   │   ├── database.py         # SQLAlchemy engine and session dependency
│   │   │   └── product.py          # Database helper utilities
│   │   ├── models/                 # SQLAlchemy database models
│   │   │   ├── expense.py          # Expenses table model
│   │   │   ├── product.py          # Products table model
│   │   │   ├── purchase.py         # Purchases and Purchase items models
│   │   │   ├── rejection.py        # Damage and breakage models
│   │   │   ├── sale.py             # Sales and Sale items models
│   │   │   └── user.py             # User accounts and roles model
│   │   ├── routes/                 # FastAPI REST API route handlers
│   │   │   ├── expense.py          # /expenses endpoints
│   │   │   ├── product.py          # /product endpoints
│   │   │   ├── purchase.py         # /purchases endpoints
│   │   │   ├── rejection.py        # /rejections endpoints
│   │   │   ├── report.py           # /reports summary and filtering
│   │   │   ├── sale.py             # /sales billing, payments, and returns
│   │   │   └── user.py             # /user login, auth, and logout
│   │   ├── schemas/                # Pydantic schemas for request/response validation
│   │   ├── services/               # Business logic, inventory, and calculations
│   │   │   ├── expense.py
│   │   │   ├── product.py
│   │   │   ├── purchase.py
│   │   │   ├── rejection.py
│   │   │   ├── report.py           # Financial summaries and KPI aggregations
│   │   │   └── sale.py             # Cart processing, stock deductions, returns
│   │   ├── utils/
│   │   │   ├── date_range.py       # Date range filters
│   │   │   ├── hash_pass.py        # Password helpers
│   │   │   ├── jwt.py              # JWT token generation and verification
│   │   │   └── normalize_product.py# String helpers
│   │   ├── config.py               # Pydantic configuration loader
│   │   └── main.py                 # Application entry point & router setup
│   ├── tests/                      # Test cases
│   ├── .env.example                # Sample environment file
│   └── requirement.txt             # Python dependencies
├── frontend/
│   ├── css/                        # CSS stylesheets
│   │   ├── base.css                # Base typography & resets
│   │   ├── components.css          # Cards, buttons, tables, forms, modals, badges
│   │   ├── dashboard.css           # Dashboard metrics layout
│   │   ├── expenses.css            # Expenses page styles
│   │   ├── login.css               # Login page styles
│   │   ├── products.css            # Products catalog styles
│   │   ├── purchases.css           # Purchases page styles
│   │   ├── rejections.css          # Rejections page styles
│   │   ├── reports.css             # Reports page styles
│   │   ├── sales.css               # POS cart & invoice styles
│   │   └── variables.css           # Global theme variables
│   ├── js/                         # JavaScript controllers
│   │   ├── auth.js                 # Session guard & authentication checks
│   │   ├── config.js               # API URL & endpoint constants
│   │   ├── dashboard.js            # Dashboard logic
│   │   ├── expenses.js             # Expenses controller
│   │   ├── products.js             # Products controller
│   │   ├── purchases.js            # Purchases controller
│   │   ├── rejections.js           # Rejections controller
│   │   ├── reports.js              # Reports controller
│   │   ├── sales.js                # POS cart, billing, returns, print receipt
│   │   └── ui.js                   # Notifications and modal helpers
│   ├── dashboard.html              # Dashboard page
│   ├── expenses.html               # Expenses page
│   ├── index.html                  # Root landing page (session router)
│   ├── login.html                  # Login page
│   ├── products.html               # Product & stock management page
│   ├── purchases.html              # Purchase orders page
│   ├── rejections.html             # Rejections & breakage page
│   ├── reports.html                # Financial reports page
│   ├── sales.html                  # Sales & POS billing page
│   ├── favicon.svg                 # Site icon
│   └── pooja_tiles_logo.jpeg       # Store logo
└── README.md                       # Project documentation
```

---

## API Reference

### Authentication (`/user`)
| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/user/login` | Public | Authenticates credentials and sets secure HttpOnly cookie |
| GET | `/user/me` | Logged In | Checks authentication status and gets user details |
| POST | `/user/logout` | Admin | Clears session cookie |

### Product Management (`/product`)
| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/product/all` | Admin | Fetches all products, prices, and stock counts |
| POST | `/product/add` | Admin | Creates a new product SKU |
| PUT | `/product/edit/{product_id}` | Admin | Modifies an existing product |
| DELETE | `/product/delete/{product_id}` | Admin | Deletes a product SKU |

### Purchases (`/purchases`)
| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/purchases/all` | Admin | Retrieves all purchase entries |
| POST | `/purchases/create` | Admin | Records inward stock order and updates cost average |
| GET | `/purchases/filter` | Admin | Filters purchases by start_date and end_date |

### Sales & POS (`/sales`)
| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/sales/all` | Admin | Retrieves all sales records |
| POST | `/sales/create` | Admin | Creates new sale, deducts stock, records payments |
| GET | `/sales/filter` | Admin | Filters sales by date range |
| GET | `/sales/outstanding` | Admin | Lists sales with unpaid balances |
| POST | `/sales/{sale_id}/payment` | Admin | Adds payment towards an outstanding balance |
| POST | `/sales/{sale_id}/return` | Admin | Returns item, adds back stock, recalculates profit |
| POST | `/sales/{sale_id}/refund-complete` | Admin | Marks pending customer refund as settled |

### Breakage & Rejections (`/rejections`)
| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/rejections/all` | Admin | Retrieves all breakage logs |
| POST | `/rejections/create` | Admin | Logs broken tiles, removes from stock, logs loss |
| GET | `/rejections/filter` | Admin | Filters breakage entries by date range |

### Operating Expenses (`/expenses`)
| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/expenses/all` | Admin | Retrieves all operating expenses |
| POST | `/expenses/create` | Admin | Records new operational cost entry |
| GET | `/expenses/filter` | Admin | Filters expenses by date range |

### Financial Reports (`/reports`)
| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/reports/summary` | Admin | Lifetime financial metrics (Revenue, COGS, Profit) |
| GET | `/reports/filter` | Admin | Date-filtered financial report |

---

## Database Schema

```mermaid
erDiagram
    user_data {
        string user_id PK
        string user_name
        string user_email
        string user_pass
        string user_role
    }

    product_data {
        string product_id PK
        string product_name
        string product_brand
        string product_size
        float product_purchase_price
        int product_stock_quantity
    }

    purchases {
        string purchase_id PK
        string supplier_name
        date date
        float total_amount
    }

    purchase_items {
        string purchase_item_id PK
        string purchase_id FK
        string product_id FK
        int quantity
        float purchase_price
    }

    sales {
        string sale_id PK
        string customer_name
        string phone_number
        date date
        float total_amount
        float cash_amount
        float upi_amount
        float outstanding_amount
        float refund_amount
        float refunded_amount
    }

    sale_items {
        string sale_item_id PK
        string sale_id FK
        string product_id FK
        int quantity
        float selling_price
        float cost_price
    }

    rejections {
        string rejection_id PK
        string product_id FK
        int quantity
        date rejection_date
        string reason
        float cost_price
    }

    expenses {
        string expense_id PK
        date expense_date
        string category
        float amount
        string description
    }

    purchases ||--|{ purchase_items : "contains"
    product_data ||--o{ purchase_items : "supplied in"
    sales ||--|{ sale_items : "contains"
    product_data ||--o{ sale_items : "sold in"
    product_data ||--o{ rejections : "damaged from"
```

---

## Local Installation & Setup

### Prerequisites
- Python 3.10 or higher
- PostgreSQL 14 or higher (local or cloud)
- Any modern web browser

---

### 1. Backend Setup

1. **Open terminal and enter the backend directory**:
   ```bash
   cd backend
   ```

2. **Create and activate a virtual environment**:
   - Windows (PowerShell):
     ```powershell
     python -m venv venv
     .\venv\Scripts\Activate.ps1
     ```
   - Linux / macOS:
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```

3. **Install dependencies**:
   ```bash
   pip install -r requirement.txt
   ```

4. **Setup environment variables**:
   Create a `.env` file from `.env.example`:
   ```bash
   cp .env.example .env
   ```
   Fill in your PostgreSQL database URL and secret key.

5. **Start backend development server**:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   The backend runs on `http://127.0.0.1:8000`.  
   Interactive API documentation is accessible at `http://127.0.0.1:8000/docs`.

---

### 2. Frontend Setup

1. **Enter the frontend directory**:
   ```bash
   cd ../frontend
   ```

2. **Set API URL in `js/config.js`**:
   The frontend is pre-configured with the live production backend URL, but can also point to local development:
   ```javascript
   const CONFIG = {
     // Production API URL:
     API_BASE_URL: "https://pooja-tiles.onrender.com",

     // Local Development API URL:
     // API_BASE_URL: "http://127.0.0.1:8000",
     // ...
   };
   ```

3. **Serve the frontend**:
   Run a local static server (cookies require an HTTP origin rather than direct `file://` access):
   - Using VS Code: Right-click `index.html` and select **Open with Live Server**.
   - Using Python:
     ```bash
     python -m http.server 5500
     ```
   - Using Node:
     ```bash
     npx serve . -l 5500
     ```

4. **Open in browser**:
   Navigate to `http://localhost:5500` or `http://127.0.0.1:5500`.

---

### 3. Creating the Initial Admin User

When the backend launches, all database tables are created automatically. To create an initial administrator account, run the following SQL command in your PostgreSQL database:

```sql
INSERT INTO user_data (user_id, user_name, user_email, user_pass, user_role)
VALUES ('USR-001', 'Admin', 'admin@poojatiles.com', 'admin123', 'admin');
```

Log in using:
- **Email**: `admin@poojatiles.com`
- **Password**: `admin123`

---

## Configuration & Environment Variables

Configure these settings in `backend/.env`:

| Variable | Description | Example / Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection URL | `postgresql://postgres:password@localhost:5432/tile_shop` |
| `SECRET_KEY` | Secret key for signing JWT tokens | 64-character random hex string |
| `ALGORITHM` | JWT signing algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Session validity duration | `60` |
| `IS_PRODUCTION` | Production mode switch | `false` (set `true` in production) |
| `ALLOWED_ORIGINS` | Permitted frontend origins for CORS | `http://localhost:5500,http://127.0.0.1:5500` |

---

## Security & Authentication

1. **HttpOnly Cookies**: JWT tokens are transmitted inside HttpOnly cookies, making them inaccessible to client-side scripts and preventing XSS token theft.
2. **SameSite & Secure Cookie Attributes**: Uses `Secure` and `SameSite` flags according to whether the environment is local development or HTTPS production.
3. **Role Enforcement**: Critical operations (product changes, purchases, sales, and report views) enforce admin privileges on the server side.
4. **CORS Control**: Access is restricted strictly to configured frontend domains.

---

## Deployment

### Live Production Endpoints
- **Production Backend API**: `https://pooja-tiles.onrender.com`
- **Root Status Probe**: `https://pooja-tiles.onrender.com/`

### Backend
- Deploy on cloud platforms such as Render, Railway, or AWS EC2.
- Set environment variables in the host dashboard:
  - `DATABASE_URL`: Hosted PostgreSQL connection URI
  - `SECRET_KEY`: High-entropy secret key
  - `IS_PRODUCTION`: `true`
  - `ALLOWED_ORIGINS`: Your production frontend domain URL(s)
- Start command:
  ```bash
  uvicorn app.main:app --host 0.0.0.0 --port $PORT
  ```

### Frontend
- Point `API_BASE_URL` in `frontend/js/config.js` to `https://pooja-tiles.onrender.com`.
- Deploy the `frontend/` directory to static hosting providers (Render Static Site, Netlify, Vercel, Cloudflare Pages, or Nginx).

---

## License

Developed for **Pooja Tiles Hodal**. All rights reserved.

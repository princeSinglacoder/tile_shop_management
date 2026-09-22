/**
 * Dashboard Module
 * Displays Overview Statistics, Low Stock Alerts, Recent Products,
 * and Outstanding Customers (Udhaari) from /sales/all.
 */

const Dashboard = (() => {

  // ─── Load Both Data Sources in Parallel ──────────────────────────────────────
  const loadDashboardData = async () => {
    try {
      const [productsRes, salesRes] = await Promise.all([
        fetch(`${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.PRODUCTS_ALL}`, {
          method: "GET",
          headers: { "Accept": "application/json" },
          credentials: "include",
        }),
        fetch(`${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.SALES_ALL}`, {
          method: "GET",
          headers: { "Accept": "application/json" },
          credentials: "include",
        }),
      ]);

      const products = productsRes.ok ? await productsRes.json() : [];
      const sales    = salesRes.ok    ? await salesRes.json()    : [];

      if (Array.isArray(products)) renderProductMetrics(products);
      if (Array.isArray(sales))    renderOutstandingCustomers(sales);

    } catch (err) {
      console.warn("[Dashboard] Failed to load data:", err);
      renderProductMetrics([
        { product_id: "1", product_name: "Carrara White Glossy Vitrified", product_brand: "Kajaria",    product_size: "600x1200 mm", product_purchase_price: "580",  product_stock_quantity: "85" },
        { product_id: "2", product_name: "Nero Marquina Matte Porcelain",  product_brand: "Somany",     product_size: "800x1600 mm", product_purchase_price: "1150", product_stock_quantity: "14" },
        { product_id: "3", product_name: "Travertine Beige Exterior Paver",product_brand: "Orientbell", product_size: "400x400 mm",  product_purchase_price: "340",  product_stock_quantity: "0"  },
        { product_id: "4", product_name: "Cementum Gris Rustic Floor Tile",product_brand: "Kajaria",    product_size: "600x600 mm",  product_purchase_price: "420",  product_stock_quantity: "8"  },
      ]);
      renderOutstandingCustomers([]);
    }
  };

  // ─── Render Product Metrics + Recent Table + Low Stock Alerts ────────────────
  const renderProductMetrics = (products) => {
    const totalTilesEl      = document.getElementById("dashTotalProducts");
    const totalBrandsEl     = document.getElementById("dashTotalBrands");
    const lowStockCountEl   = document.getElementById("dashLowStockCount");
    const outOfStockCountEl = document.getElementById("dashOutOfStockCount");
    const inventoryValEl    = document.getElementById("dashInventoryValue");

    const total        = products.length;
    const uniqueBrands = new Set(products.map(p => (p.product_brand || "").trim().toLowerCase())).size;
    const lowStock     = products.filter(p => {
      const q = parseInt(p.product_stock_quantity, 10) || 0;
      return q > 0 && q <= 15;
    });
    const outOfStock = products.filter(p => (parseInt(p.product_stock_quantity, 10) || 0) <= 0);
    const purchaseInventoryValue = products.reduce((acc, p) => {
      return acc + (parseInt(p.product_stock_quantity, 10) || 0) * (parseFloat(p.product_purchase_price) || 0);
    }, 0);

    if (totalTilesEl)      totalTilesEl.textContent      = total;
    if (totalBrandsEl)     totalBrandsEl.textContent     = uniqueBrands;
    if (lowStockCountEl)   lowStockCountEl.textContent   = lowStock.length;
    if (outOfStockCountEl) outOfStockCountEl.textContent = outOfStock.length;
    if (inventoryValEl)    inventoryValEl.textContent    = UI.formatCurrency(purchaseInventoryValue);

    // Recent Products Preview Table
    const recentTbody = document.getElementById("recentProductsTbody");
    if (recentTbody) {
      const recent = products.slice(0, 5);
      if (recent.length === 0) {
        recentTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">No products added yet.</td></tr>`;
      } else {
        recentTbody.innerHTML = recent.map(p => `
          <tr>
            <td>
              <div style="font-weight: 600; color: var(--text-main);">${UI.escapeHTML(p.product_name)}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${UI.escapeHTML(p.product_brand)}</div>
            </td>
            <td><span class="badge badge-neutral">${UI.escapeHTML(p.product_size)}</span></td>
            <td><strong style="color: var(--text-main);">${UI.formatCurrency(p.product_purchase_price)}</strong></td>
            <td>
              <span class="badge ${parseInt(p.product_stock_quantity, 10) > 15 ? 'badge-success' : parseInt(p.product_stock_quantity, 10) > 0 ? 'badge-warning' : 'badge-danger'}">
                ${p.product_stock_quantity} in stock
              </span>
            </td>
          </tr>
        `).join("");
      }
    }

    // Low Stock Alert List
    const alertList = document.getElementById("lowStockAlertList");
    if (alertList) {
      const critical = [...outOfStock, ...lowStock].slice(0, 4);
      if (critical.length === 0) {
        alertList.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 1.5rem;">All tiles have healthy inventory levels.</div>`;
      } else {
        alertList.innerHTML = critical.map(item => `
          <div class="quick-action-item" style="border-left: 3px solid ${parseInt(item.product_stock_quantity, 10) <= 0 ? 'var(--danger)' : 'var(--warning)'};">
            <div class="quick-action-left">
              <div class="quick-action-text">
                <span class="quick-action-title">${UI.escapeHTML(item.product_name)}</span>
                <span class="quick-action-subtitle">${UI.escapeHTML(item.product_brand)} &bull; ${UI.escapeHTML(item.product_size)}</span>
              </div>
            </div>
            <span class="badge ${parseInt(item.product_stock_quantity, 10) <= 0 ? 'badge-danger' : 'badge-warning'}">
              ${item.product_stock_quantity} left
            </span>
          </div>
        `).join("");
      }
    }
  };

  // ─── Render Outstanding Customers (Udhaari) ───────────────────────────────────
  const renderOutstandingCustomers = (sales) => {
    const container  = document.getElementById("outstandingCustomerList");
    const countBadge = document.getElementById("outstandingCount");
    if (!container) return;

    // Filter: only sales where outstanding_amount > 0; sort highest due first
    const outstanding = sales
      .filter(s => parseFloat(s.outstanding_amount || 0) > 0)
      .sort((a, b) => parseFloat(b.outstanding_amount) - parseFloat(a.outstanding_amount));

    if (countBadge) {
      if (outstanding.length > 0) {
        countBadge.textContent   = outstanding.length;
        countBadge.style.display = "";
      } else {
        countBadge.style.display = "none";
      }
    }

    if (outstanding.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 2rem 1rem;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
               style="opacity:0.35; margin-bottom:0.5rem; display:block; margin-left:auto; margin-right:auto;">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"></path>
          </svg>
          <div style="font-weight: 600; color: var(--text-main); margin-bottom: 4px;">All Clear!</div>
          <div style="font-size: var(--font-size-xs);">No outstanding dues. All customers are fully paid up.</div>
        </div>
      `;
      return;
    }

    const totalOutstanding = outstanding.reduce((sum, s) => sum + parseFloat(s.outstanding_amount || 0), 0);

    container.innerHTML = `
      <table class="outstanding-table">
        <thead>
          <tr>
            <th>Customer Name</th>
            <th>Phone Number</th>
            <th>Sale Date</th>
            <th style="text-align: right;">Outstanding Due</th>
            <th style="text-align: right;">Total Billed</th>
          </tr>
        </thead>
        <tbody>
          ${outstanding.map(s => `
            <tr class="outstanding-row">
              <td class="outstanding-customer-name">${UI.escapeHTML(s.customer_name || "—")}</td>
              <td class="outstanding-phone">${s.phone_number ? UI.escapeHTML(s.phone_number) : "<span style='color:var(--text-light);'>—</span>"}</td>
              <td class="outstanding-date">${formatDate(s.date)}</td>
              <td style="text-align: right;">
                <span class="outstanding-amount-badge">${UI.formatCurrency(s.outstanding_amount)}</span>
              </td>
              <td style="text-align: right; color: var(--text-muted); font-size: var(--font-size-xs);">
                ${UI.formatCurrency(s.total_amount)}
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
      <div style="text-align: right; margin-top: var(--space-3); padding-top: var(--space-3); border-top: 1px solid var(--border-light);">
        <span style="font-size: var(--font-size-xs); color: var(--text-muted);">Total Outstanding: </span>
        <strong style="color: #e11d48; font-feature-settings: 'tnum'; font-size: var(--font-size-sm);">
          ${UI.formatCurrency(totalOutstanding)}
        </strong>
      </div>
    `;
  };

  // ─── Date Helper ─────────────────────────────────────────────────────────────
  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    try {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        return d.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
      }
      return dateStr;
    } catch { return dateStr; }
  };

  // ─── Init ─────────────────────────────────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", () => {
    loadDashboardData();
  });

  return { loadDashboardData };
})();

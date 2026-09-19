/**
 * Dashboard Module
 * Displays Overview Statistics, Low Stock Alerts, and Recent Products
 */

const Dashboard = (() => {
  const loadDashboardData = async () => {
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.PRODUCTS_ALL}`, {
        method: "GET",
        headers: { "Accept": "application/json" },
        credentials: "include"
      });

      if (!response.ok) throw new Error("Failed to load products");
      const products = await response.json();
      if (Array.isArray(products)) {
        renderDashboard(products);
      }
    } catch (err) {
      console.warn("Using sample dashboard statistics:", err);
      // Demo metrics
      renderDashboard([
        { product_id: "1", product_name: "Carrara White Glossy Vitrified", product_brand: "Kajaria", product_size: "600x1200 mm", product_selling_price: "1250", product_stock_quantity: "85" },
        { product_id: "2", product_name: "Nero Marquina Matte Porcelain", product_brand: "Somany", product_size: "800x1600 mm", product_selling_price: "2450", product_stock_quantity: "14" },
        { product_id: "3", product_name: "Travertine Beige Exterior Paver", product_brand: "Orientbell", product_size: "400x400 mm", product_selling_price: "680", product_stock_quantity: "0" },
        { product_id: "4", product_name: "Cementum Gris Rustic Floor Tile", product_brand: "Kajaria", product_size: "600x600 mm", product_selling_price: "890", product_stock_quantity: "8" }
      ]);
    }
  };

  const renderDashboard = (products) => {
    const totalTilesEl = document.getElementById("dashTotalProducts");
    const totalBrandsEl = document.getElementById("dashTotalBrands");
    const lowStockCountEl = document.getElementById("dashLowStockCount");
    const outOfStockCountEl = document.getElementById("dashOutOfStockCount");

    const total = products.length;
    const uniqueBrands = new Set(products.map(p => (p.product_brand || "").trim().toLowerCase())).size;
    const lowStock = products.filter(p => {
      const q = parseInt(p.product_stock_quantity, 10) || 0;
      return q > 0 && q <= 15;
    });
    const outOfStock = products.filter(p => (parseInt(p.product_stock_quantity, 10) || 0) <= 0);

    if (totalTilesEl) totalTilesEl.textContent = total;
    if (totalBrandsEl) totalBrandsEl.textContent = uniqueBrands;
    if (lowStockCountEl) lowStockCountEl.textContent = lowStock.length;
    if (outOfStockCountEl) outOfStockCountEl.textContent = outOfStock.length;

    // Render Recent Products Preview Table
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
            <td><strong style="color: var(--text-main);">${UI.formatCurrency(p.product_selling_price)}</strong></td>
            <td>
              <span class="badge ${parseInt(p.product_stock_quantity, 10) > 15 ? 'badge-success' : parseInt(p.product_stock_quantity, 10) > 0 ? 'badge-warning' : 'badge-danger'}">
                ${p.product_stock_quantity} in stock
              </span>
            </td>
          </tr>
        `).join("");
      }
    }

    // Render Low Stock Alert List
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
                <span class="quick-action-subtitle">${UI.escapeHTML(item.product_brand)} • ${UI.escapeHTML(item.product_size)}</span>
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

  document.addEventListener("DOMContentLoaded", () => {
    loadDashboardData();
  });

  return { loadDashboardData };
})();

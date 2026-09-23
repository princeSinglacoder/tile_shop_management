/**
 * Sales Module — TilePro Management
 *
 * Handles customer sale order creation and sale history.
 *
 * Backend endpoints:
 *  GET    /product/all    — list all catalog products (dropdown & live stock)
 *  POST   /sales/create   — create sale { customer_name, phone_number, sale_date, items: [{ product_id, quantity, selling_price }], cash_amount, upi_amount, udhari_amount }
 *  GET    /sales/all      — list all sales with line items
 *  POST   /sales/{id}/payment — record a due payment { payment_method, amount }
 */

const Sales = (() => {
  // ─── State ───────────────────────────────────────────────────────────────────
  let productsList = [];       // Catalog products with live stock & price
  let salesList = [];          // Complete sales history from backend
  let filteredSalesList = [];  // Filtered sales for search
  let itemRowCounter = 0;      // Unique row ID counter

  // ─── DOM Helpers ─────────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);

  /** Show inline field error */
  const setFieldError = (errId, msg) => {
    const el = $(errId);
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle("visible", !!msg);
  };

  /** Clear all field errors in a form */
  const clearFormErrors = (errIds) => {
    errIds.forEach((id) => setFieldError(id, ""));
  };

  /** Set submit button loading state */
  const setButtonLoading = (btnId, loading) => {
    const btn = $(btnId);
    if (!btn) return;
    const label = btn.querySelector(".btn-label");
    const spinner = btn.querySelector(".btn-spinner");
    btn.disabled = loading;
    if (label) label.classList.toggle("hidden", loading);
    if (spinner) spinner.classList.toggle("hidden", !loading);
  };

  /** Show/hide server-level error inside modal */
  const showFormServerError = (containerId, msg) => {
    const el = $(containerId);
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle("hidden", !msg);
  };

  // ─── Load Products (for dropdown & inventory sync) ───────────────────────────
  const loadProducts = async () => {
    try {
      const response = await fetch(
        `${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.PRODUCTS_ALL}`,
        {
          method: "GET",
          headers: { "Accept": "application/json" },
          credentials: "include",
        }
      );

      if (response.status === 401) {
        UI.showToast("Session Expired", "Please log in again.", "error");
        setTimeout(() => { window.location.href = "login.html"; }, 1200);
        return;
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || errData.message || "Failed to load products");
      }

      const data = await response.json();
      if (Array.isArray(data)) {
        productsList = data;
      }
    } catch (err) {
      console.error("[Sales] loadProducts error:", err);
    }
  };

  // ─── Load Sale History ───────────────────────────────────────────────────────
  const loadSales = async () => {
    const container = $("saleHistoryContainer");
    const refreshBtn = $("refreshSalesBtn");
    const refreshIcon = refreshBtn?.querySelector("svg");

    if (refreshIcon) refreshIcon.classList.add("is-spinning");

    if (container && salesList.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 3rem 1rem;">
          <div class="spinner-sm" style="margin-bottom: 0.75rem; border-color: rgba(37,99,235,0.25); border-top-color: var(--primary); width: 24px; height: 24px;"></div>
          <div>Loading sales history...</div>
        </div>
      `;
    }

    try {
      const response = await fetch(
        `${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.SALES_ALL}`,
        {
          method: "GET",
          headers: { "Accept": "application/json" },
          credentials: "include",
        }
      );

      if (response.status === 401) {
        UI.showToast("Session Expired", "Please log in again.", "error");
        setTimeout(() => { window.location.href = "login.html"; }, 1200);
        return;
      }

      if (response.status === 403) {
        UI.showToast("Access Denied", "Only administrators can view sales records.", "error");
        salesList = [];
        filteredSalesList = [];
        renderSaleHistory();
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to load sales (HTTP ${response.status})`);
      }

      const data = await response.json();
      if (Array.isArray(data)) {
        salesList = data;
        applySearchFilter();
      }
    } catch (err) {
      console.error("[Sales] loadSales error:", err);
      salesList = [];
      filteredSalesList = [];
      renderSaleHistory();
    } finally {
      if (refreshIcon) refreshIcon.classList.remove("is-spinning");
      updateStats();
    }
  };

  // ─── Filter & Search ────────────────────────────────────────────────────────
  const applySearchFilter = () => {
    const query = ($("salesSearchInput")?.value || "").trim().toLowerCase();

    if (!query) {
      filteredSalesList = [...salesList];
    } else {
      filteredSalesList = salesList.filter((sale) => {
        const custMatch = (sale.customer_name || "").toLowerCase().includes(query);
        const phoneMatch = (sale.phone_number || "").toLowerCase().includes(query);
        const idMatch = (sale.sale_id || "").toLowerCase().includes(query);
        const itemMatch = (sale.items || []).some((item) =>
          (item.product_name || "").toLowerCase().includes(query)
        );
        return custMatch || phoneMatch || idMatch || itemMatch;
      });
    }

    renderSaleHistory();
  };

  // ─── Render Sale History ─────────────────────────────────────────────────────
  const renderSaleHistory = () => {
    const container = $("saleHistoryContainer");
    const countEl = $("salesCount");
    if (!container) return;

    if (countEl) {
      countEl.textContent = `${salesList.length} sale${salesList.length !== 1 ? "s" : ""}`;
    }

    if (filteredSalesList.length === 0) {
      const isFiltered = ($("salesSearchInput")?.value || "").trim().length > 0;
      container.innerHTML = `
        <div class="sales-empty-state">
          <div class="empty-icon-wrapper">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="9" cy="21" r="1"></circle>
              <circle cx="20" cy="21" r="1"></circle>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>
          </div>
          <h4 class="empty-title">${isFiltered ? "No Matching Sales" : "No Sales Recorded Yet"}</h4>
          <p class="empty-description">
            ${isFiltered
          ? "No sales matched your search query. Try clearing the search filter."
          : "Record your first customer sale order to track dispatched tile stock and revenue."}
          </p>
        </div>
      `;
      return;
    }

    // Sort descending by date (newest first)
    const sorted = [...filteredSalesList].sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime();
      const dateB = new Date(b.date || 0).getTime();
      return dateB - dateA;
    });

    container.innerHTML = sorted.map((sale) => {
      const dateStr = formatDate(sale.date);
      const itemCount = sale.items ? sale.items.length : 0;
      const totalBoxes = (sale.items || []).reduce((acc, it) => acc + (parseInt(it.quantity, 10) || 0), 0);
      const outstanding = parseFloat(sale.outstanding_amount || 0) || 0;
      const refundDue = parseFloat(sale.refund_amount || 0) || 0;
      const hasReturnable = (sale.items || []).some((it) => (parseInt(it.quantity, 10) || 0) > 0);
      const phoneStr = sale.phone_number ? ` • 📞 ${UI.escapeHTML(sale.phone_number)}` : "";

      const paymentBadge = outstanding > 0
        ? `<span class="badge-due">Due: ${UI.formatCurrency(outstanding)}</span>`
        : `<span class="badge-paid">✓ Fully Paid</span>`;

      const refundBadge = refundDue > 0
        ? `<span class="badge-refund">Refund: ${UI.formatCurrency(refundDue)}</span>`
        : "";

      const payDueBtn = outstanding > 0
        ? `
          <button
            type="button"
            class="btn-pay-due"
            onclick="event.stopPropagation(); Sales.openPaymentModal('${UI.escapeHTML(sale.sale_id)}')"
            title="Collect Due Payment"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
            <span>Pay Due</span>
          </button>
        `
        : "";

      const returnBtn = hasReturnable
        ? `
          <button
            type="button"
            class="btn-return"
            onclick="event.stopPropagation(); Sales.openReturnModal('${UI.escapeHTML(sale.sale_id)}')"
            title="Return sold items"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="1 4 1 10 7 10"></polyline>
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
            </svg>
            <span>Return</span>
          </button>
        `
        : "";

      const refundBtn = refundDue > 0
        ? `
          <button
            type="button"
            class="btn-refund-complete"
            onclick="event.stopPropagation(); Sales.confirmRefundComplete('${UI.escapeHTML(sale.sale_id)}')"
            title="Mark refund as given to customer"
          >
            <span>Refund Completed</span>
          </button>
        `
        : "";

      return `
        <div class="sale-history-card" data-sale-id="${UI.escapeHTML(sale.sale_id)}">
          <div class="sale-card-header" onclick="Sales.toggleCard('${UI.escapeHTML(sale.sale_id)}')" role="button" aria-expanded="false" tabindex="0">
            <div class="sale-customer-info">
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span class="sale-customer-name">${UI.escapeHTML(sale.customer_name)}</span>
                ${paymentBadge}
                ${refundBadge}
              </div>
              <span class="sale-date">${dateStr}${phoneStr} • ${itemCount} product${itemCount !== 1 ? "s" : ""} (${totalBoxes} box${totalBoxes !== 1 ? "es" : ""})</span>
            </div>
            <div class="sale-meta">
              ${returnBtn}
              ${payDueBtn}
              ${refundBtn}
              <span class="sale-amount">${UI.formatCurrency(sale.total_amount)}</span>
              <svg class="sale-toggle-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>
          <div class="sale-card-body" id="body_${UI.escapeHTML(sale.sale_id)}">
            <!-- Payment Settlement Summary Box -->
            <div class="sale-payment-summary">
              <div class="sale-payment-item">
                <span class="sale-payment-label">Billed Revenue</span>
                <span class="sale-payment-val">${UI.formatCurrency(sale.total_amount)}</span>
              </div>
              <div class="sale-payment-item">
                <span class="sale-payment-label">Cash Paid</span>
                <span class="sale-payment-val">${UI.formatCurrency(sale.cash_amount || 0)}</span>
              </div>
              <div class="sale-payment-item">
                <span class="sale-payment-label">UPI Paid</span>
                <span class="sale-payment-val">${UI.formatCurrency(sale.upi_amount || 0)}</span>
              </div>
              <div class="sale-payment-item">
                <span class="sale-payment-label">Outstanding Due (Udhaari)</span>
                <span class="sale-payment-val ${outstanding > 0 ? 'due' : ''}">${UI.formatCurrency(outstanding)}</span>
              </div>
              <div class="sale-payment-item">
                <span class="sale-payment-label">Refund Due</span>
                <span class="sale-payment-val ${refundDue > 0 ? 'refund' : ''}">${UI.formatCurrency(refundDue)}</span>
              </div>
            </div>

            <table class="sale-items-table">
              <thead>
                <tr>
                  <th>Tile Product</th>
                  <th style="text-align: center;">Quantity</th>
                  <th style="text-align: right;">Unit Selling Price</th>
                  <th style="text-align: right;">Line Total</th>
                </tr>
              </thead>
              <tbody>
                ${(sale.items || []).map((item) => {
        const qty = parseInt(item.quantity, 10) || 0;
        const price = parseFloat(item.selling_price) || 0;
        const lineTotal = qty * price;
        return `
                    <tr>
                      <td class="item-product-name">${UI.escapeHTML(item.product_name || item.product_id)}</td>
                      <td style="text-align: center;"><span class="badge badge-neutral">${qty} box${qty !== 1 ? "es" : ""}</span></td>
                      <td style="text-align: right;">${UI.formatCurrency(price)}</td>
                      <td style="text-align: right; font-weight: 700; color: var(--text-main);">${UI.formatCurrency(lineTotal)}</td>
                    </tr>
                  `;
      }).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }).join("");
  };

  /** Toggle card expand/collapse */
  const toggleCard = (saleId) => {
    const body = $(`body_${saleId}`);
    const card = body?.closest(".sale-history-card");
    const header = card?.querySelector(".sale-card-header");
    const icon = card?.querySelector(".sale-toggle-icon");

    if (body) {
      const isOpen = body.classList.toggle("open");
      if (icon) icon.classList.toggle("expanded", isOpen);
      if (header) header.setAttribute("aria-expanded", String(isOpen));
    }
  };

  // ─── Stats Calculation ───────────────────────────────────────────────────────
  const updateStats = () => {
    const totalSalesEl = $("statTotalSales");
    const totalRevenueEl = $("statTotalRevenue");
    const totalItemsEl = $("statTotalItemsSold");

    const totalSales = salesList.length;
    const totalRevenue = salesList.reduce((sum, s) => sum + (parseFloat(s.total_amount) || 0), 0);
    const totalBoxesSold = salesList.reduce((sum, s) => {
      if (!s.items) return sum;
      return sum + s.items.reduce((iSum, it) => iSum + (parseInt(it.quantity, 10) || 0), 0);
    }, 0);

    if (totalSalesEl) totalSalesEl.textContent = totalSales;
    if (totalRevenueEl) totalRevenueEl.textContent = UI.formatCurrency(totalRevenue);
    if (totalItemsEl) totalItemsEl.textContent = `${totalBoxesSold} boxes`;
  };

  // ─── Open Create Sale Modal ──────────────────────────────────────────────────
  const openCreateModal = async () => {
    // Reload catalog products so stock quantities are fresh
    await loadProducts();

    // Reset form
    const form = $("saleForm");
    if (form) form.reset();

    // Default to today's date
    const dateInput = $("saleDate");
    if (dateInput) {
      dateInput.value = new Date().toISOString().split("T")[0];
    }

    // Reset phone and payment breakdown fields
    const phoneInput = $("customerPhone");
    if (phoneInput) phoneInput.value = "";
    const cashInput = $("cashAmount");
    if (cashInput) cashInput.value = "0";
    const upiInput = $("upiAmount");
    if (upiInput) upiInput.value = "0";
    const udhariInput = $("udhariAmount");
    if (udhariInput) udhariInput.value = "0";

    // Clear previous errors
    clearFormErrors(["err_customer", "err_phone", "err_sale_date", "err_cash", "err_upi", "err_udhari"]);
    showFormServerError("saleServerError", "");

    // Reset rows
    const container = $("saleItemsContainer");
    if (container) container.innerHTML = "";
    itemRowCounter = 0;

    // Add initial item row
    addItemRow();

    // Update grand total display & payment balance
    updateGrandTotal();

    UI.openModal("createSaleModal");
  };

  // ─── Item Row Management ────────────────────────────────────────────────────
  const buildProductOptionsHtml = () => {
    return productsList.map((p) => {
      const stock = Math.floor(parseFloat(p.product_stock_quantity || "0")) || 0;
      const avgPP = parseFloat(p.product_purchase_price || "0") || 0;
      const stockText = stock > 0 ? `${stock} in stock` : "0 in stock (Out of Stock)";
      return `<option value="${UI.escapeHTML(p.product_id)}" data-stock="${stock}" data-avg-pp="${avgPP}">
        ${UI.escapeHTML(p.product_name)} — ${UI.escapeHTML(p.product_brand || "")} [${stockText}]
      </option>`;
    }).join("");
  };

  const addItemRow = () => {
    const container = $("saleItemsContainer");
    if (!container) return;

    itemRowCounter++;
    const rowId = `sale_item_row_${itemRowCounter}`;
    const currentRow = itemRowCounter;

    const row = document.createElement("div");
    row.className = "sale-item-row";
    row.id = rowId;
    row.dataset.rowId = String(currentRow);

    row.innerHTML = `
      <div>
        <select class="form-select row-product" data-row="${currentRow}" aria-label="Select product">
          <option value="">Select a tile product...</option>
          ${buildProductOptionsHtml()}
        </select>
      </div>
      <div class="row-info" id="rowStock_${currentRow}">—</div>
      <div class="row-info" id="rowAvgPP_${currentRow}">—</div>
      <div>
        <input
          type="number"
          class="form-control row-quantity"
          placeholder="Qty"
          min="1"
          step="1"
          data-row="${currentRow}"
          aria-label="Quantity in boxes"
        >
      </div>
      <div>
        <input
          type="number"
          class="form-control row-price"
          placeholder="₹ Price"
          min="0.01"
          step="0.01"
          data-row="${currentRow}"
          aria-label="Selling Price per box"
        >
      </div>
      <div class="row-total" id="rowTotal_${currentRow}">₹ 0.00</div>
      <button type="button" class="btn-remove-row" onclick="Sales.removeItemRow('${rowId}')" title="Remove line item" aria-label="Remove item">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;

    container.appendChild(row);

    // Event listeners
    const productSelect = row.querySelector(".row-product");
    const qtyInput = row.querySelector(".row-quantity");
    const priceInput = row.querySelector(".row-price");

    if (productSelect) {
      productSelect.addEventListener("change", () => {
        handleProductChange(row, currentRow);
      });
    }

    if (qtyInput) {
      qtyInput.addEventListener("input", () => {
        handleQuantityChange(row, currentRow);
      });
    }

    if (priceInput) {
      priceInput.addEventListener("input", () => {
        handlePriceChange(row, currentRow);
      });
    }
  };

  const removeItemRow = (rowId) => {
    const row = $(rowId);
    if (!row) return;

    const container = $("saleItemsContainer");
    if (container && container.children.length <= 1) {
      UI.showToast("Notice", "A sale must have at least one product row.", "warning");
      return;
    }

    row.style.animation = "rowFadeOut 0.2s ease forwards";
    setTimeout(() => {
      if (row.parentElement) {
        row.parentElement.removeChild(row);
      }
      updateGrandTotal();
    }, 200);
  };

  // ─── Real-Time Row Event Handlers ───────────────────────────────────────────
  const handleProductChange = (row, rowIndex) => {
    const productSelect = row.querySelector(".row-product");
    const qtyInput = row.querySelector(".row-quantity");
    if (!productSelect) return;

    productSelect.classList.remove("is-invalid");
    showFormServerError("saleServerError", "");

    const selectedId = productSelect.value;

    // Check duplicate products in the same sale
    if (selectedId) {
      const container = $("saleItemsContainer");
      const allRows = container ? container.querySelectorAll(".sale-item-row") : [];
      let duplicateFound = false;

      allRows.forEach((r) => {
        if (r !== row) {
          const otherSelect = r.querySelector(".row-product");
          if (otherSelect && otherSelect.value === selectedId) {
            duplicateFound = true;
          }
        }
      });

      if (duplicateFound) {
        productSelect.value = "";
        productSelect.classList.add("is-invalid");
        updateRowInfo(rowIndex);
        updateRowTotal(rowIndex);
        UI.showToast(
          "Duplicate Product",
          "This product is already selected in another line. Duplicate products are not allowed in the same sale.",
          "warning"
        );
        showFormServerError("saleServerError", "This product is already added. Adjust quantity on the existing row instead.");
        return;
      }
    }

    updateRowInfo(rowIndex);

    // Validate current quantity against new product stock
    const stock = getRowStock(row);
    if (qtyInput && qtyInput.value) {
      const qtyVal = parseInt(qtyInput.value, 10);
      if (qtyVal > stock) {
        qtyInput.classList.add("is-invalid");
        showFormServerError("saleServerError", `Selected product only has ${stock} box${stock !== 1 ? "es" : ""} in stock.`);
      } else {
        qtyInput.classList.remove("is-invalid");
      }
    }

    updateRowTotal(rowIndex);
  };

  const handleQuantityChange = (row, rowIndex) => {
    const qtyInput = row.querySelector(".row-quantity");
    if (!qtyInput) return;

    const rawVal = qtyInput.value.trim();
    const stock = getRowStock(row);
    const productSelect = row.querySelector(".row-product");
    const productId = productSelect?.value || "";

    showFormServerError("saleServerError", "");

    if (!rawVal) {
      qtyInput.classList.remove("is-invalid");
      updateRowTotal(rowIndex);
      return;
    }

    const qty = parseInt(rawVal, 10);

    if (isNaN(qty) || qty <= 0 || !Number.isInteger(Number(rawVal))) {
      qtyInput.classList.add("is-invalid");
      showFormServerError("saleServerError", "Quantity must be a positive whole number (e.g. 1, 2, 5 boxes).");
    } else if (productId && qty > stock) {
      qtyInput.classList.add("is-invalid");
      showFormServerError("saleServerError", `Quantity (${qty}) exceeds available inventory stock (${stock} boxes).`);
    } else {
      qtyInput.classList.remove("is-invalid");
    }

    updateRowTotal(rowIndex);
  };

  const handlePriceChange = (row, rowIndex) => {
    const priceInput = row.querySelector(".row-price");
    if (!priceInput) return;

    const rawVal = priceInput.value.trim();
    showFormServerError("saleServerError", "");

    if (!rawVal) {
      priceInput.classList.remove("is-invalid");
      updateRowTotal(rowIndex);
      return;
    }

    const price = parseFloat(rawVal);
    if (isNaN(price) || price <= 0) {
      priceInput.classList.add("is-invalid");
      showFormServerError("saleServerError", "Selling price must be greater than 0.");
    } else {
      priceInput.classList.remove("is-invalid");
    }

    updateRowTotal(rowIndex);
  };

  // ─── Row Info (Stock Badge & Avg Purchase Price) ───────────────────────────
  const updateRowInfo = (rowIndex) => {
    const row = document.querySelector(`[data-row-id="${rowIndex}"]`);
    if (!row) return;

    const productSelect = row.querySelector(".row-product");
    const stockEl = $(`rowStock_${rowIndex}`);
    const avgPPEl = $(`rowAvgPP_${rowIndex}`);

    if (!productSelect) return;

    const selectedId = productSelect.value;
    const prod = productsList.find((p) => p.product_id === selectedId);

    if (!prod) {
      if (stockEl) stockEl.textContent = "—";
      if (avgPPEl) avgPPEl.textContent = "—";
      return;
    }

    const stock = Math.floor(parseFloat(prod.product_stock_quantity || "0")) || 0;
    const avgPP = parseFloat(prod.product_purchase_price || "0") || 0;

    // Available Stock Badge
    if (stockEl) {
      let badgeClass = "in-stock";
      let text = `${stock} boxes`;

      if (stock <= 0) {
        badgeClass = "no-stock";
        text = "0 (Out of Stock)";
      } else if (stock <= 10) {
        badgeClass = "low-stock";
        text = `${stock} boxes (Low)`;
      }

      stockEl.innerHTML = `<span class="stock-info-badge ${badgeClass}">${text}</span>`;
    }

    // Current Average Purchase Price
    if (avgPPEl) {
      avgPPEl.innerHTML = `<span class="stock-info-badge" style="background: var(--bg-main); border: 1px solid var(--border-color); color: var(--text-main); font-weight: 700;">${UI.formatCurrency(avgPP)}</span>`;
    }
  };

  const getRowStock = (row) => {
    const productSelect = row.querySelector(".row-product");
    if (!productSelect || !productSelect.value) return 0;
    const prod = productsList.find((p) => p.product_id === productSelect.value);
    return prod ? (Math.floor(parseFloat(prod.product_stock_quantity || "0")) || 0) : 0;
  };

  // ─── Totals Calculation ──────────────────────────────────────────────────────
  const updateRowTotal = (rowIndex) => {
    const row = document.querySelector(`[data-row-id="${rowIndex}"]`);
    if (!row) {
      updateGrandTotal();
      return;
    }

    const qty = parseInt(row.querySelector(".row-quantity")?.value, 10) || 0;
    const price = parseFloat(row.querySelector(".row-price")?.value) || 0;
    const lineTotal = (qty > 0 && price > 0) ? (qty * price) : 0;

    const totalEl = $(`rowTotal_${rowIndex}`);
    if (totalEl) {
      totalEl.textContent = UI.formatCurrency(lineTotal);
    }

    updateGrandTotal();
  };

  const updateGrandTotal = () => {
    const container = $("saleItemsContainer");
    const grandTotalEl = $("saleGrandTotalValue");
    if (!container || !grandTotalEl) return;

    let total = 0;
    container.querySelectorAll(".sale-item-row").forEach((row) => {
      const qty = parseInt(row.querySelector(".row-quantity")?.value, 10) || 0;
      const price = parseFloat(row.querySelector(".row-price")?.value) || 0;
      if (qty > 0 && price > 0) {
        total += qty * price;
      }
    });

    grandTotalEl.textContent = UI.formatCurrency(total);
    updatePaymentBalance();
  };

  // ─── Payment Balance Bar ─────────────────────────────────────────────────────
  const updatePaymentBalance = () => {
    const settledEl = $("paymentSettledValue");
    const targetEl = $("paymentTargetValue");
    const diffBadge = $("paymentDiffBadge");

    const cash = parseFloat($("cashAmount")?.value) || 0;
    const upi = parseFloat($("upiAmount")?.value) || 0;
    const udhari = parseFloat($("udhariAmount")?.value) || 0;
    const settled = Math.round((cash + upi + udhari) * 100) / 100;

    const container = $("saleItemsContainer");
    let grandTotal = 0;
    if (container) {
      container.querySelectorAll(".sale-item-row").forEach((row) => {
        const qty = parseInt(row.querySelector(".row-quantity")?.value, 10) || 0;
        const price = parseFloat(row.querySelector(".row-price")?.value) || 0;
        if (qty > 0 && price > 0) grandTotal += qty * price;
      });
    }
    grandTotal = Math.round(grandTotal * 100) / 100;

    if (settledEl) settledEl.textContent = UI.formatCurrency(settled);
    if (targetEl) targetEl.textContent = UI.formatCurrency(grandTotal);

    if (!diffBadge) return;
    const diff = Math.round((settled - grandTotal) * 100) / 100;
    if (diff === 0) {
      diffBadge.textContent = "✓ Balanced";
      diffBadge.className = "payment-diff-badge balanced";
    } else if (diff > 0) {
      diffBadge.textContent = `+${UI.formatCurrency(diff)} Over`;
      diffBadge.className = "payment-diff-badge over";
    } else {
      diffBadge.textContent = `${UI.formatCurrency(Math.abs(diff))} Under`;
      diffBadge.className = "payment-diff-badge under";
    }
  };

  // ─── Quick-Fill Payment ───────────────────────────────────────────────────────
  const quickFillPayment = (method) => {
    const container = $("saleItemsContainer");
    let grandTotal = 0;
    if (container) {
      container.querySelectorAll(".sale-item-row").forEach((row) => {
        const qty = parseInt(row.querySelector(".row-quantity")?.value, 10) || 0;
        const price = parseFloat(row.querySelector(".row-price")?.value) || 0;
        if (qty > 0 && price > 0) grandTotal += qty * price;
      });
    }
    grandTotal = Math.round(grandTotal * 100) / 100;

    const cashInput = $("cashAmount");
    const upiInput = $("upiAmount");
    const udhariInput = $("udhariAmount");
    if (cashInput) cashInput.value = "0";
    if (upiInput) upiInput.value = "0";
    if (udhariInput) udhariInput.value = "0";

    if (method === "cash" && cashInput) cashInput.value = grandTotal;
    else if (method === "upi" && upiInput) upiInput.value = grandTotal;
    else if (method === "udhari" && udhariInput) udhariInput.value = grandTotal;

    updatePaymentBalance();
  };

  // ─── Form Submission & Validation ───────────────────────────────────────────
  const handleSaleSubmit = async (e) => {
    e.preventDefault();
    showFormServerError("saleServerError", "");

    const customerName = ($("customerName")?.value || "").trim();
    const phoneNumber = ($("customerPhone")?.value || "").trim();
    const saleDate = ($("saleDate")?.value || "").trim();

    let valid = true;
    clearFormErrors(["err_customer", "err_phone", "err_sale_date", "err_cash", "err_upi", "err_udhari"]);

    // Customer Name Validation
    if (!customerName) {
      setFieldError("err_customer", "Customer name is required.");
      valid = false;
    } else if (customerName.length > 100) {
      setFieldError("err_customer", "Customer name cannot exceed 100 characters.");
      valid = false;
    }

    // Phone Number Validation
    if (!phoneNumber) {
      setFieldError("err_phone", "Phone number is required.");
      valid = false;
    } else if (!/^\d{10}$/.test(phoneNumber)) {
      setFieldError("err_phone", "Phone number must be exactly 10 digits.");
      valid = false;
    }

    // Sale Date Validation
    if (!saleDate) {
      setFieldError("err_sale_date", "Sale date is required.");
      valid = false;
    }

    // Line Items Validation
    const container = $("saleItemsContainer");
    const rows = container ? container.querySelectorAll(".sale-item-row") : [];

    if (rows.length === 0) {
      showFormServerError("saleServerError", "At least one product item is required for a sale.");
      return;
    }

    const items = [];
    const seenProductIds = new Set();
    let rowErrorMsg = "";

    rows.forEach((row, idx) => {
      const rowNum = idx + 1;
      const productSelect = row.querySelector(".row-product");
      const qtyInput = row.querySelector(".row-quantity");
      const priceInput = row.querySelector(".row-price");

      const productId = productSelect?.value || "";
      const rawQty = (qtyInput?.value || "").trim();
      const rawPrice = (priceInput?.value || "").trim();
      const quantity = parseInt(rawQty, 10);
      const sellingPrice = parseFloat(rawPrice);
      const stock = getRowStock(row);

      // Reset state
      productSelect?.classList.remove("is-invalid");
      qtyInput?.classList.remove("is-invalid");
      priceInput?.classList.remove("is-invalid");

      // 1. Check empty product
      if (!productId) {
        productSelect?.classList.add("is-invalid");
        if (!rowErrorMsg) rowErrorMsg = `Row ${rowNum}: Please select a product.`;
        valid = false;
      }

      // 2. Check duplicate product
      if (productId && seenProductIds.has(productId)) {
        productSelect?.classList.add("is-invalid");
        if (!rowErrorMsg) rowErrorMsg = `Row ${rowNum}: Duplicate product selected. Each product can only be added once.`;
        valid = false;
      } else if (productId) {
        seenProductIds.add(productId);
      }

      // 3. Check quantity value
      if (!rawQty || isNaN(quantity) || quantity <= 0 || !Number.isInteger(Number(rawQty))) {
        qtyInput?.classList.add("is-invalid");
        if (!rowErrorMsg) rowErrorMsg = `Row ${rowNum}: Please enter a valid quantity greater than 0.`;
        valid = false;
      } else if (productId) {
        // 4. Check stock availability
        if (stock <= 0) {
          qtyInput?.classList.add("is-invalid");
          if (!rowErrorMsg) rowErrorMsg = `Row ${rowNum}: Product is out of stock (0 available).`;
          valid = false;
        } else if (quantity > stock) {
          qtyInput?.classList.add("is-invalid");
          if (!rowErrorMsg) rowErrorMsg = `Row ${rowNum}: Quantity (${quantity}) exceeds available stock (${stock}).`;
          valid = false;
        }
      }

      // 5. Check selling price
      if (!rawPrice || isNaN(sellingPrice) || sellingPrice <= 0) {
        priceInput?.classList.add("is-invalid");
        if (!rowErrorMsg) rowErrorMsg = `Row ${rowNum}: Please enter a valid selling price greater than 0.`;
        valid = false;
      }

      if (productId && quantity > 0 && quantity <= stock && sellingPrice > 0) {
        items.push({
          product_id: productId,
          quantity: quantity,
          selling_price: sellingPrice,
        });
      }
    });

    if (!valid) {
      if (rowErrorMsg) {
        showFormServerError("saleServerError", rowErrorMsg);
      }
      return;
    }

    if (items.length === 0) {
      showFormServerError("saleServerError", "Add at least one valid product line item.");
      return;
    }

    // Payment amounts
    const cashAmount = Math.round((parseFloat($("cashAmount")?.value) || 0) * 100) / 100;
    const upiAmount = Math.round((parseFloat($("upiAmount")?.value) || 0) * 100) / 100;
    const udhariAmount = Math.round((parseFloat($("udhariAmount")?.value) || 0) * 100) / 100;

    // Validate that payment total equals sale total (also enforced by backend)
    const grandTotal = Math.round(items.reduce((sum, it) => sum + it.quantity * it.selling_price, 0) * 100) / 100;
    const paymentTotal = Math.round((cashAmount + upiAmount + udhariAmount) * 100) / 100;

    if (paymentTotal !== grandTotal) {
      showFormServerError(
        "saleServerError",
        `Payment total (${UI.formatCurrency(paymentTotal)}) must equal sale total (${UI.formatCurrency(grandTotal)}). ` +
        `Adjust Cash, UPI, or Udhaari amounts so they balance.`
      );
      return;
    }

    // Submit payload — matches FastAPI TempSale schema
    const payload = {
      customer_name: customerName,
      phone_number: phoneNumber,
      sale_date: saleDate,
      items: items,
      cash_amount: cashAmount,
      upi_amount: upiAmount,
      udhari_amount: udhariAmount,
    };

    setButtonLoading("saleSubmitBtn", true);

    try {
      const response = await fetch(
        `${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.SALE_CREATE}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json().catch(() => ({}));

      // HTTP Error Handling
      if (response.status === 401) {
        UI.showToast("Session Expired", "Please log in again.", "error");
        setTimeout(() => { window.location.href = "login.html"; }, 1200);
        return;
      }

      if (response.status === 403) {
        showFormServerError("saleServerError", "Permission denied. Only administrators can record sales.");
        UI.showToast("Forbidden", "Only admins can record sales.", "error");
        return;
      }

      if (response.status === 422) {
        const detail = result.detail;
        const msg = Array.isArray(detail)
          ? detail.map((d) => `${d.loc?.slice(1)?.join(".")}: ${d.msg}`).join("; ")
          : String(detail || "Validation error occurred.");
        showFormServerError("saleServerError", msg);
        return;
      }

      if (response.status === 400 || response.status === 404) {
        showFormServerError("saleServerError", result.detail || result.message || "Invalid sale request.");
        return;
      }

      if (!response.ok) {
        showFormServerError("saleServerError", result.detail || result.message || `Server error (${response.status})`);
        return;
      }

      // Success — add created sale to local list (no /sales/all or /product/all refetch)
      UI.showToast(
        "Sale Recorded",
        `Sale to "${customerName}" recorded successfully. Total: ${UI.formatCurrency(result.total_amount)}`,
        "success"
      );
      UI.closeModal("createSaleModal");
      applyCreatedSale(result);

    } catch (err) {
      console.error("[Sales] handleSaleSubmit error:", err);
      showFormServerError("saleServerError", "Could not reach the backend server. Please verify connection.");
    } finally {
      setButtonLoading("saleSubmitBtn", false);
    }
  };

  /**
   * Prepend a newly created sale from POST /sales/create response into local state.
   */
  const applyCreatedSale = (result) => {
    if (!result || !result.sale_id) return;

    const sale = {
      sale_id: result.sale_id,
      customer_name: result.customer_name || "",
      phone_number: result.phone_number || "",
      date: result.date || "",
      total_amount: result.total_amount || 0,
      cash_amount: result.cash_amount || 0,
      upi_amount: result.upi_amount || 0,
      outstanding_amount: result.outstanding_amount || 0,
      refund_amount: result.refund_amount || 0,
      items: Array.isArray(result.items) ? result.items : [],
    };

    salesList.unshift(sale);
    applySearchFilter();
    updateStats();
  };

  // ─── Date Formatting ────────────────────────────────────────────────────────
  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    try {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        return d.toLocaleDateString("en-IN", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      }
      return new Date(dateStr).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  // ─── Setup Event Listeners ──────────────────────────────────────────────────
  const setupEventListeners = () => {
    // Open Create Modal
    $("openCreateSaleBtn")?.addEventListener("click", openCreateModal);

    // Add Item Row
    $("addSaleItemRowBtn")?.addEventListener("click", addItemRow);

    // Sale Form Submit
    $("saleForm")?.addEventListener("submit", handleSaleSubmit);

    // Payment Form Submit
    $("paymentForm")?.addEventListener("submit", handlePaymentSubmit);

    // Return Form Submit
    $("returnSaleForm")?.addEventListener("submit", handleReturnSubmit);

    // Payment inputs — live balance bar update
    ["cashAmount", "upiAmount", "udhariAmount"].forEach((id) => {
      $(id)?.addEventListener("input", updatePaymentBalance);
    });

    // Search / Filter Input
    $("salesSearchInput")?.addEventListener("input", applySearchFilter);
  };

  // ─── Payment Modal ───────────────────────────────────────────────────────────
  const openPaymentModal = (saleId) => {
    const sale = salesList.find((s) => s.sale_id === saleId);
    if (!sale) return;

    // Populate sale summary
    const summaryEl = $("payModalSummary");
    if (summaryEl) {
      summaryEl.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:6px;">
          <div><strong>${UI.escapeHTML(sale.customer_name)}</strong>&nbsp;&nbsp;${sale.phone_number ? "📞 " + UI.escapeHTML(sale.phone_number) : ""}</div>
          <div style="font-size:var(--font-size-xs); color:var(--text-muted);">
            Sale ID: ${UI.escapeHTML(sale.sale_id.slice(0, 8))}…
            &nbsp;·&nbsp; Total: <strong>${UI.formatCurrency(sale.total_amount)}</strong>
          </div>
          <div style="margin-top:4px; display:flex; gap:16px; font-size:var(--font-size-xs);">
            <span>Cash: ${UI.formatCurrency(sale.cash_amount || 0)}</span>
            <span>UPI: ${UI.formatCurrency(sale.upi_amount || 0)}</span>
            <span style="color:#dc2626; font-weight:700;">Outstanding: ${UI.formatCurrency(sale.outstanding_amount || 0)}</span>
          </div>
        </div>
      `;
    }

    // Store sale_id in hidden field
    const hiddenId = $("paySaleId");
    if (hiddenId) hiddenId.value = saleId;

    // Reset form
    const payForm = $("paymentForm");
    if (payForm) payForm.reset();
    const payMethod = $("payMethod");
    if (payMethod) payMethod.value = "cash";
    const payAmount = $("payAmount");
    if (payAmount) payAmount.value = "";

    // Wire "Pay Full Due" shortcut button
    const btnFull = $("btnPayFullDue");
    if (btnFull) {
      btnFull.onclick = () => {
        if (payAmount) payAmount.value = parseFloat(sale.outstanding_amount || 0).toFixed(2);
      };
    }

    showFormServerError("paymentServerError", "");
    UI.openModal("makePaymentModal");
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    showFormServerError("paymentServerError", "");

    const saleId = $("paySaleId")?.value || "";
    const payMethod = $("payMethod")?.value || "";
    const rawAmount = ($("payAmount")?.value || "").trim();
    const amount = parseFloat(rawAmount);

    if (!saleId) {
      showFormServerError("paymentServerError", "Sale ID missing. Please close and reopen the modal.");
      return;
    }
    if (!rawAmount || isNaN(amount) || amount <= 0) {
      setFieldError("err_pay_amount", "Please enter a valid payment amount greater than 0.");
      return;
    }

    // Client-side: amount must not exceed outstanding
    const sale = salesList.find((s) => s.sale_id === saleId);
    if (sale && amount > parseFloat(sale.outstanding_amount || 0)) {
      setFieldError("err_pay_amount",
        `Amount (${UI.formatCurrency(amount)}) cannot exceed outstanding due (${UI.formatCurrency(sale.outstanding_amount)}).`
      );
      return;
    }

    setButtonLoading("paymentSubmitBtn", true);

    try {
      const response = await fetch(
        `${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.SALE_PAYMENT(saleId)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ payment_method: payMethod, amount: amount }),
        }
      );

      const result = await response.json().catch(() => ({}));

      if (response.status === 401) {
        UI.showToast("Session Expired", "Please log in again.", "error");
        setTimeout(() => { window.location.href = "login.html"; }, 1200);
        return;
      }
      if (response.status === 403) {
        showFormServerError("paymentServerError", "Permission denied. Only administrators can record payments.");
        return;
      }
      if (response.status === 422) {
        const detail = result.detail;
        const msg = Array.isArray(detail)
          ? detail.map((d) => `${d.loc?.slice(1)?.join(".")}: ${d.msg}`).join("; ")
          : String(detail || "Validation error.");
        showFormServerError("paymentServerError", msg);
        return;
      }
      if (!response.ok) {
        showFormServerError("paymentServerError", result.detail || result.message || `Error (${response.status})`);
        return;
      }

      // Success — patch only this sale from the payment response (no /sales/all refetch)
      UI.showToast(
        "Payment Recorded",
        `Payment of ${UI.formatCurrency(amount)} recorded. Outstanding: ${UI.formatCurrency(result.outstanding_amount)}`,
        "success"
      );
      UI.closeModal("makePaymentModal");
      applyPaymentResult(result.sale_id || saleId, result);

    } catch (err) {
      console.error("[Sales] handlePaymentSubmit error:", err);
      showFormServerError("paymentServerError", "Could not reach the backend server. Please verify connection.");
    } finally {
      setButtonLoading("paymentSubmitBtn", false);
    }
  };

  /**
   * Update a single sale in local state from POST /sales/{id}/payment response.
   * Recalculates Cash / UPI / Udhaari on that card and hides Pay Due when outstanding is 0.
   */
  const applyPaymentResult = (saleId, result) => {
    const idx = salesList.findIndex((s) => s.sale_id === saleId);
    if (idx === -1) return;

    const updated = { ...salesList[idx] };
    if (result.cash_amount !== undefined && result.cash_amount !== null) {
      updated.cash_amount = result.cash_amount;
    }
    if (result.upi_amount !== undefined && result.upi_amount !== null) {
      updated.upi_amount = result.upi_amount;
    }
    if (result.outstanding_amount !== undefined && result.outstanding_amount !== null) {
      updated.outstanding_amount = result.outstanding_amount;
    }

    salesList[idx] = updated;
    applySearchFilter();
    updateStats();
  };

  // ─── Return Modal ────────────────────────────────────────────────────────────
  const openReturnModal = (saleId) => {
    const sale = salesList.find((s) => s.sale_id === saleId);
    if (!sale) {
      UI.showToast("Error", "Sale not found in current list.", "error");
      return;
    }

    const returnable = (sale.items || []).filter((it) => (parseInt(it.quantity, 10) || 0) > 0);
    if (returnable.length === 0) {
      UI.showToast("Nothing to Return", "All items from this sale have already been returned.", "warning");
      return;
    }

    const summary = $("returnModalSummary");
    if (summary) {
      summary.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:4px;">
          <strong>${UI.escapeHTML(sale.customer_name || "")}</strong>
          <span style="font-size:var(--font-size-xs); color:var(--text-muted);">
            ${sale.phone_number ? UI.escapeHTML(sale.phone_number) + " • " : ""}
            Sale Date: ${formatDate(sale.date)} • Billed: ${UI.formatCurrency(sale.total_amount)}
          </span>
          <span style="font-size:var(--font-size-xs);">
            Outstanding: <strong style="color:#dc2626;">${UI.formatCurrency(sale.outstanding_amount || 0)}</strong>
            &nbsp;|&nbsp;
            Refund Due: <strong style="color:#c2410c;">${UI.formatCurrency(sale.refund_amount || 0)}</strong>
          </span>
        </div>
      `;
    }

    if ($("returnSaleId")) $("returnSaleId").value = sale.sale_id;
    showFormServerError("returnServerError", "");

    const container = $("returnItemsContainer");
    if (container) {
      container.innerHTML = returnable.map((item) => {
        const qty = parseInt(item.quantity, 10) || 0;
        const price = parseFloat(item.selling_price) || 0;
        return `
          <div class="return-item-row" data-sale-item-id="${UI.escapeHTML(item.sale_item_id)}" data-max-qty="${qty}">
            <div>
              <div class="form-label">Product</div>
              <div class="return-item-meta">${UI.escapeHTML(item.product_name || item.product_id)}</div>
              <div class="return-item-sub">Remaining sold: ${qty} box${qty !== 1 ? "es" : ""}</div>
            </div>
            <div>
              <div class="form-label">Selling Price</div>
              <div class="return-item-meta">${UI.formatCurrency(price)}</div>
            </div>
            <div>
              <label class="form-label">Return Qty</label>
              <input
                type="number"
                class="form-control return-qty-input"
                min="0"
                max="${qty}"
                step="1"
                value="0"
                inputmode="numeric"
              >
            </div>
            <div>
              <div class="form-label">Max Returnable</div>
              <div class="return-item-meta">${qty}</div>
            </div>
          </div>
        `;
      }).join("");
    }

    UI.openModal("returnSaleModal");
  };

  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    showFormServerError("returnServerError", "");

    const saleId = $("returnSaleId")?.value || "";
    if (!saleId) {
      showFormServerError("returnServerError", "Sale ID missing. Please close and reopen the modal.");
      return;
    }

    const rows = document.querySelectorAll("#returnItemsContainer .return-item-row");
    const items = [];
    let rowError = "";

    rows.forEach((row) => {
      const saleItemId = row.getAttribute("data-sale-item-id") || "";
      const maxQty = parseInt(row.getAttribute("data-max-qty"), 10) || 0;
      const qtyInput = row.querySelector(".return-qty-input");
      const rawQty = (qtyInput?.value || "").trim();
      const quantity = parseInt(rawQty, 10);

      qtyInput?.classList.remove("is-invalid");

      if (!rawQty || isNaN(quantity) || quantity < 0 || !Number.isInteger(Number(rawQty))) {
        qtyInput?.classList.add("is-invalid");
        if (!rowError) rowError = "Enter a valid whole-number return quantity.";
        return;
      }

      if (quantity === 0) return;

      if (quantity > maxQty) {
        qtyInput?.classList.add("is-invalid");
        if (!rowError) rowError = `Return quantity cannot exceed remaining sold quantity (${maxQty}).`;
        return;
      }

      items.push({ sale_item_id: saleItemId, quantity });
    });

    if (rowError) {
      showFormServerError("returnServerError", rowError);
      return;
    }

    if (items.length === 0) {
      showFormServerError("returnServerError", "Enter a return quantity greater than 0 for at least one item.");
      return;
    }

    setButtonLoading("returnSubmitBtn", true);

    try {
      const response = await fetch(
        `${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.SALE_RETURN(saleId)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ items }),
        }
      );

      const result = await response.json().catch(() => ({}));

      if (response.status === 401) {
        UI.showToast("Session Expired", "Please log in again.", "error");
        setTimeout(() => { window.location.href = "login.html"; }, 1200);
        return;
      }
      if (response.status === 403) {
        showFormServerError("returnServerError", "Permission denied. Only administrators can process returns.");
        return;
      }
      if (response.status === 422) {
        const detail = result.detail;
        const msg = Array.isArray(detail)
          ? detail.map((d) => `${d.loc?.slice(1)?.join(".")}: ${d.msg}`).join("; ")
          : String(detail || "Validation error.");
        showFormServerError("returnServerError", msg);
        return;
      }
      if (!response.ok) {
        showFormServerError("returnServerError", result.detail || result.message || `Error (${response.status})`);
        return;
      }

      UI.showToast(
        "Return Processed",
        `Return amount ${UI.formatCurrency(result.total_return_amount)}. Refund due: ${UI.formatCurrency(result.refund_amount)}`,
        "success"
      );
      UI.closeModal("returnSaleModal");
      applyReturnResult(result.sale_id || saleId, result);

    } catch (err) {
      console.error("[Sales] handleReturnSubmit error:", err);
      showFormServerError("returnServerError", "Could not reach the backend server. Please verify connection.");
    } finally {
      setButtonLoading("returnSubmitBtn", false);
    }
  };

  /**
   * Patch one sale + local product stock from POST /sales/{id}/return response.
   * Does NOT call /sales/all.
   */
  const applyReturnResult = (saleId, result) => {
    const idx = salesList.findIndex((s) => s.sale_id === saleId);
    if (idx === -1) return;

    const updated = {
      ...salesList[idx],
      items: (salesList[idx].items || []).map((it) => ({ ...it })),
    };

    if (result.total_amount !== undefined && result.total_amount !== null) {
      updated.total_amount = result.total_amount;
    }
    if (result.outstanding_amount !== undefined && result.outstanding_amount !== null) {
      updated.outstanding_amount = result.outstanding_amount;
    }
    if (result.refund_amount !== undefined && result.refund_amount !== null) {
      updated.refund_amount = result.refund_amount;
    }

    (result.items || []).forEach((retItem) => {
      const itemIdx = updated.items.findIndex((it) => it.sale_item_id === retItem.sale_item_id);
      if (itemIdx !== -1) {
        updated.items[itemIdx].quantity = retItem.remaining_quantity;
      }

      // Sync product stock / avg PP if catalog is already loaded on this page
      if (retItem.product_id && productsList.length > 0) {
        const pIdx = productsList.findIndex((p) => p.product_id === retItem.product_id);
        if (pIdx !== -1) {
          const prod = { ...productsList[pIdx] };
          if (retItem.product_stock_quantity !== undefined) {
            prod.product_stock_quantity = retItem.product_stock_quantity;
          }
          if (retItem.product_purchase_price !== undefined) {
            prod.product_purchase_price = retItem.product_purchase_price;
          }
          productsList[pIdx] = prod;
        }
      }
    });

    salesList[idx] = updated;
    applySearchFilter();
    updateStats();
  };

  // ─── Refund Completed ────────────────────────────────────────────────────────
  const confirmRefundComplete = (saleId) => {
    const sale = salesList.find((s) => s.sale_id === saleId);
    if (!sale) {
      UI.showToast("Error", "Sale not found in current list.", "error");
      return;
    }

    const refundDue = parseFloat(sale.refund_amount || 0) || 0;
    if (refundDue <= 0) {
      UI.showToast("No Refund Due", "This sale has no pending refund.", "warning");
      return;
    }

    UI.showConfirm({
      title: "Confirm Refund Completed",
      message: `Are you sure the full refund has been given to the customer? Refund amount: ${UI.formatCurrency(refundDue)}`,
      confirmText: "Yes, Refund Given",
      cancelText: "Cancel",
      onConfirm: async () => {
        await completeRefund(saleId);
      },
    });
  };

  const completeRefund = async (saleId) => {
    try {
      const response = await fetch(
        `${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.SALE_REFUND_COMPLETE(saleId)}`,
        {
          method: "POST",
          headers: { "Accept": "application/json" },
          credentials: "include",
        }
      );

      const result = await response.json().catch(() => ({}));

      if (response.status === 401) {
        UI.showToast("Session Expired", "Please log in again.", "error");
        setTimeout(() => { window.location.href = "login.html"; }, 1200);
        return;
      }

      if (!response.ok) {
        UI.showToast("Refund Failed", result.detail || result.message || "Could not complete refund.", "error");
        return;
      }

      UI.showToast("Refund Completed", "Refund marked as given to the customer.", "success");
      applyRefundCompleteResult(result.sale_id || saleId, result);

    } catch (err) {
      console.error("[Sales] completeRefund error:", err);
      UI.showToast("Connection Error", "Could not reach the backend server.", "error");
    }
  };

  const applyRefundCompleteResult = (saleId, result) => {
    const idx = salesList.findIndex((s) => s.sale_id === saleId);
    if (idx === -1) return;

    salesList[idx] = {
      ...salesList[idx],
      refund_amount: result.refund_amount !== undefined ? result.refund_amount : 0,
    };
    applySearchFilter();
    updateStats();
  };

  // ─── Initialization ─────────────────────────────────────────────────────────
  const init = async () => {
    setupEventListeners();
    // Only load sales history on page load/refresh.
    // product/all is fetched when Create Sale is opened.
    await loadSales();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // ─── Public Interface ───────────────────────────────────────────────────────
  return {
    loadSales,
    loadProducts,
    openCreateModal,
    toggleCard,
    addItemRow,
    removeItemRow,
    openPaymentModal,
    quickFillPayment,
    openReturnModal,
    confirmRefundComplete,
  };
})();

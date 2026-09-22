/**
 * Sales Module — TilePro Management
 *
 * Handles customer sale order creation and sale history.
 *
 * Backend endpoints:
 *  GET    /product/all    — list all catalog products (dropdown & live stock)
 *  POST   /sales/create   — create sale { customer_name, sale_date, items: [{ product_id, quantity }] }
 *  GET    /sales/all      — list all sales with line items
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
        const idMatch = (sale.sale_id || "").toLowerCase().includes(query);
        const itemMatch = (sale.items || []).some((item) =>
          (item.product_name || "").toLowerCase().includes(query)
        );
        return custMatch || idMatch || itemMatch;
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

      return `
        <div class="sale-history-card" data-sale-id="${UI.escapeHTML(sale.sale_id)}">
          <div class="sale-card-header" onclick="Sales.toggleCard('${UI.escapeHTML(sale.sale_id)}')" role="button" aria-expanded="false" tabindex="0">
            <div class="sale-customer-info">
              <span class="sale-customer-name">${UI.escapeHTML(sale.customer_name)}</span>
              <span class="sale-date">${dateStr} • ${itemCount} product${itemCount !== 1 ? "s" : ""} (${totalBoxes} box${totalBoxes !== 1 ? "es" : ""})</span>
            </div>
            <div class="sale-meta">
              <span class="sale-amount">${UI.formatCurrency(sale.total_amount)}</span>
              <svg class="sale-toggle-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>
          <div class="sale-card-body" id="body_${UI.escapeHTML(sale.sale_id)}">
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

    // Clear previous errors
    clearFormErrors(["err_customer", "err_sale_date"]);
    showFormServerError("saleServerError", "");

    // Reset rows
    const container = $("saleItemsContainer");
    if (container) container.innerHTML = "";
    itemRowCounter = 0;

    // Add initial item row
    addItemRow();

    // Update grand total display
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
  };

  // ─── Form Submission & Validation ───────────────────────────────────────────
  const handleSaleSubmit = async (e) => {
    e.preventDefault();
    showFormServerError("saleServerError", "");

    const customerName = ($("customerName")?.value || "").trim();
    const saleDate = ($("saleDate")?.value || "").trim();

    let valid = true;
    clearFormErrors(["err_customer", "err_sale_date"]);

    // Customer Name Validation
    if (!customerName) {
      setFieldError("err_customer", "Customer name is required.");
      valid = false;
    } else if (customerName.length > 100) {
      setFieldError("err_customer", "Customer name cannot exceed 100 characters.");
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

    // Submit payload — matches FastAPI TempSale schema: { customer_name, sale_date, items }
    const payload = {
      customer_name: customerName,
      sale_date: saleDate,
      items: items,
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

      // Success
      UI.showToast(
        "Sale Recorded",
        `Sale to "${customerName}" recorded successfully. Total: ${UI.formatCurrency(result.total_amount)}`,
        "success"
      );
      UI.closeModal("createSaleModal");

      // Simultaneously refresh sales history and product catalog (for stock sync)
      await Promise.all([loadSales(), loadProducts()]);

    } catch (err) {
      console.error("[Sales] handleSaleSubmit error:", err);
      showFormServerError("saleServerError", "Could not reach the backend server. Please verify connection.");
    } finally {
      setButtonLoading("saleSubmitBtn", false);
    }
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

    // Form Submit
    $("saleForm")?.addEventListener("submit", handleSaleSubmit);

    // Search / Filter Input
    $("salesSearchInput")?.addEventListener("input", applySearchFilter);
  };

  // ─── Initialization ─────────────────────────────────────────────────────────
  const init = async () => {
    setupEventListeners();
    await Promise.all([loadProducts(), loadSales()]);
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
  };
})();

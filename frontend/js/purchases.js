/**
 * Purchases Module — TilePro Management
 *
 * Handles purchase order creation and purchase history.
 *
 * Backend endpoints:
 *  GET    /product/all           — list all products (for dropdown)
 *  POST   /purchases/create      — create purchase { supplier_name, purchase_date, items[] }
 *  GET    /purchases/all         — list all purchases with items
 *  POST   /product/add           — add new product (inline create)
 */

const Purchases = (() => {
  // ─── State ───────────────────────────────────────────────────────────────────
  let productsList = [];       // Products for dropdown
  let purchasesList = [];      // Purchase history
  let itemRowCounter = 0;      // Unique row IDs
  let activeStartDate = null;
  let activeEndDate = null;

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

  /** Show server-level error inside modal */
  const showFormServerError = (containerId, msg) => {
    const el = $(containerId);
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle("hidden", !msg);
  };

  // ─── Load Products (for dropdown) ────────────────────────────────────────────
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

      if (!response.ok) throw new Error("Failed to load products");

      const data = await response.json();
      if (Array.isArray(data)) {
        productsList = data;
      }
    } catch (err) {
      console.error("[Purchases] loadProducts failed:", err);
    }
  };

  // ─── Date range filter (dedicated /purchases/filter API) ─────────────────────
  const isDateFilterActive = () => !!(activeStartDate || activeEndDate);

  const isDateInActiveFilter = (dateStr) => {
    if (!isDateFilterActive()) return true;
    if (!dateStr) return false;
    if (activeStartDate && dateStr < activeStartDate) return false;
    if (activeEndDate && dateStr > activeEndDate) return false;
    return true;
  };

  const buildFilterUrl = (start, end) => {
    const url = new URL(`${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.PURCHASES_FILTER}`);
    if (start) url.searchParams.set("start_date", start);
    if (end) url.searchParams.set("end_date", end);
    return url.toString();
  };

  const fetchPurchasesFromUrl = async (requestUrl) => {
    const container = $("purchaseHistoryContainer");
    if (container) {
      container.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 2rem;">
          Loading purchase history...
        </div>
      `;
    }

    try {
      const response = await fetch(requestUrl, {
        method: "GET",
        headers: { "Accept": "application/json" },
        credentials: "include",
      });

      if (response.status === 401) {
        UI.showToast("Session Expired", "Please log in again.", "error");
        setTimeout(() => { window.location.href = "login.html"; }, 1200);
        return;
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const detail = errData.detail || "Failed to load purchases";
        throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
      }

      const data = await response.json();
      if (Array.isArray(data)) {
        purchasesList = data;
      }
    } catch (err) {
      console.error("[Purchases] fetchPurchases failed:", err);
      UI.showToast("Load Failed", err.message || "Could not load purchases.", "error");
      purchasesList = [];
    }

    renderPurchaseHistory();
    updateStats();
  };

  /** Initial load / clear: GET /purchases/all only */
  const loadPurchases = async () => {
    await fetchPurchasesFromUrl(`${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.PURCHASES_ALL}`);
  };

  /** Apply Filter: GET /purchases/filter only */
  const applyDateFilter = async () => {
    const start = ($("purchasesStartDate")?.value || "").trim() || null;
    const end = ($("purchasesEndDate")?.value || "").trim() || null;

    if (!start && !end) {
      UI.showToast("Date Required", "Select From date, To date, or both.", "error");
      return;
    }
    if (start && end && start > end) {
      UI.showToast("Invalid Date Range", "From date cannot be after To date.", "error");
      return;
    }

    activeStartDate = start;
    activeEndDate = end;
    await fetchPurchasesFromUrl(buildFilterUrl(start, end));
  };

  const clearDateFilter = async () => {
    const startInput = $("purchasesStartDate");
    const endInput = $("purchasesEndDate");
    if (startInput) startInput.value = "";
    if (endInput) endInput.value = "";
    activeStartDate = null;
    activeEndDate = null;
    await loadPurchases();
  };

  const refreshPurchases = async () => {
    if (isDateFilterActive()) {
      await fetchPurchasesFromUrl(buildFilterUrl(activeStartDate, activeEndDate));
    } else {
      await loadPurchases();
    }
  };

  // ─── Load Purchase History ───────────────────────────────────────────────────

  // ─── Render Purchase History ─────────────────────────────────────────────────
  const renderPurchaseHistory = () => {
    const container = $("purchaseHistoryContainer");
    const countEl = $("purchasesCount");
    if (!container) return;

    if (countEl) {
      countEl.textContent = `${purchasesList.length} purchase${purchasesList.length !== 1 ? "s" : ""}`;
    }

    if (purchasesList.length === 0) {
      container.innerHTML = `
        <div class="purchases-empty-state">
          <div class="empty-icon-wrapper">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-2z"></path>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <path d="M16 10a4 4 0 0 1-8 0"></path>
            </svg>
          </div>
          <h4 class="empty-title">No Purchase Orders Yet</h4>
          <p class="empty-description">Record your first vendor purchase to start tracking stock inward and supplier transactions.</p>
        </div>
      `;
      return;
    }

    // Sort by date descending
    const sorted = [...purchasesList].sort((a, b) => {
      return new Date(b.date) - new Date(a.date);
    });

    container.innerHTML = sorted.map((purchase) => {
      const dateStr = formatDate(purchase.date);
      const itemCount = purchase.items ? purchase.items.length : 0;

      return `
        <div class="purchase-history-card" data-purchase-id="${UI.escapeHTML(purchase.purchase_id)}">
          <div class="purchase-card-header" onclick="Purchases.toggleCard('${UI.escapeHTML(purchase.purchase_id)}')">
            <div class="purchase-supplier-info">
              <span class="purchase-supplier-name">${UI.escapeHTML(purchase.supplier_name)}</span>
              <span class="purchase-date">${dateStr} • ${itemCount} item${itemCount !== 1 ? "s" : ""}</span>
            </div>
            <div class="purchase-meta">
              <span class="purchase-amount">${UI.formatCurrency(purchase.total_amount)}</span>
              <svg class="purchase-toggle-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>
          <div class="purchase-card-body" id="body_${UI.escapeHTML(purchase.purchase_id)}">
            <table class="purchase-items-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th style="text-align: right;">Line Total</th>
                </tr>
              </thead>
              <tbody>
                ${(purchase.items || []).map(item => `
                  <tr>
                    <td class="item-product-name">${UI.escapeHTML(item.product_name || item.product_id)}</td>
                    <td>${item.quantity}</td>
                    <td>${UI.formatCurrency(item.purchase_price)}</td>
                    <td style="text-align: right; font-weight: 700;">${UI.formatCurrency(item.quantity * item.purchase_price)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }).join("");
  };

  /** Toggle card expand/collapse */
  const toggleCard = (purchaseId) => {
    const body = $(`body_${purchaseId}`);
    const card = body?.closest(".purchase-history-card");
    const icon = card?.querySelector(".purchase-toggle-icon");

    if (body) body.classList.toggle("open");
    if (icon) icon.classList.toggle("expanded");
  };

  // ─── Stats ───────────────────────────────────────────────────────────────────
  const updateStats = () => {
    const totalPurchasesEl = $("statTotalPurchases");
    const totalSpendEl = $("statTotalSpend");
    const totalItemsEl = $("statTotalItems");

    const totalPurchases = purchasesList.length;
    const totalSpend = purchasesList.reduce((sum, p) => sum + (p.total_amount || 0), 0);
    const totalItems = purchasesList.reduce((sum, p) => sum + (p.items ? p.items.length : 0), 0);

    if (totalPurchasesEl) totalPurchasesEl.textContent = totalPurchases;
    if (totalSpendEl) totalSpendEl.textContent = UI.formatCurrency(totalSpend);
    if (totalItemsEl) totalItemsEl.textContent = totalItems;
  };

  // ─── Create Purchase Modal ───────────────────────────────────────────────────
  const openCreateModal = async () => {
    // Reload products to get fresh list
    await loadProducts();

    // Reset form
    const form = $("purchaseForm");
    if (form) form.reset();

    // Set today's date
    const dateInput = $("purchaseDate");
    if (dateInput) {
      dateInput.value = new Date().toISOString().split("T")[0];
    }

    // Clear errors
    clearFormErrors(["err_supplier", "err_date"]);
    showFormServerError("purchaseServerError", "");

    // Reset item rows
    const container = $("purchaseItemsContainer");
    if (container) container.innerHTML = "";
    itemRowCounter = 0;

    // Add one empty row
    addItemRow();

    // Update total
    updateGrandTotal();

    UI.openModal("createPurchaseModal");
  };

  // ─── Item Row Management ─────────────────────────────────────────────────────
  const addItemRow = () => {
    const container = $("purchaseItemsContainer");
    if (!container) return;

    itemRowCounter++;
    const rowId = `item_row_${itemRowCounter}`;

    const row = document.createElement("div");
    row.className = "purchase-item-row";
    row.id = rowId;
    row.dataset.rowId = String(itemRowCounter);

    const productOptions = productsList.map(p =>
      `<option value="${UI.escapeHTML(p.product_id)}">${UI.escapeHTML(p.product_name)} — ${UI.escapeHTML(p.product_brand)} (${UI.escapeHTML(p.product_size)})</option>`
    ).join("");

    row.innerHTML = `
      <div>
        <select class="form-select row-product" data-row="${itemRowCounter}">
          <option value="">Select a product...</option>
          ${productOptions}
        </select>
        <button type="button" class="create-product-link" onclick="Purchases.openInlineAddProduct(${itemRowCounter})">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Create new product
        </button>
      </div>
      <div>
        <input type="number" class="form-control row-quantity" placeholder="Qty" min="1" step="1" data-row="${itemRowCounter}">
      </div>
      <div>
        <input type="number" class="form-control row-price" placeholder="₹ Price" min="0.01" step="0.01" data-row="${itemRowCounter}">
      </div>
      <div class="row-total" id="rowTotal_${itemRowCounter}">₹ 0.00</div>
      <button type="button" class="btn-remove-row" onclick="Purchases.removeItemRow('${rowId}')" title="Remove row">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;

    container.appendChild(row);

    // Wire change events for live total with proper closure binding
    const currentRow = itemRowCounter;
    const productSelect = row.querySelector(".row-product");
    const qtyInput = row.querySelector(".row-quantity");
    const priceInput = row.querySelector(".row-price");

    if (productSelect) {
      productSelect.addEventListener("change", () => {
        productSelect.classList.remove("is-invalid");
      });
    }

    if (qtyInput) {
      qtyInput.addEventListener("input", () => {
        qtyInput.classList.remove("is-invalid");
        updateRowTotal(currentRow);
      });
    }

    if (priceInput) {
      priceInput.addEventListener("input", () => {
        priceInput.classList.remove("is-invalid");
        updateRowTotal(currentRow);
      });
    }
  };


  const removeItemRow = (rowId) => {
    const row = $(rowId);
    if (!row) return;

    const container = $("purchaseItemsContainer");
    // Don't remove if it's the last row
    if (container && container.children.length <= 1) {
      UI.showToast("Required", "At least one item row is required.", "warning");
      return;
    }

    row.style.animation = "rowFadeOut 0.2s ease forwards";
    setTimeout(() => {
      if (row.parentElement) row.parentElement.removeChild(row);
      updateGrandTotal();
    }, 200);
  };

  // ─── Totals ──────────────────────────────────────────────────────────────────
  const updateRowTotal = (rowIndex) => {
    const row = document.querySelector(`[data-row-id="${rowIndex}"]`);
    if (!row) { updateGrandTotal(); return; }

    const qty = parseFloat(row.querySelector(".row-quantity")?.value) || 0;
    const price = parseFloat(row.querySelector(".row-price")?.value) || 0;
    const total = qty * price;

    const totalEl = $(`rowTotal_${rowIndex}`);
    if (totalEl) totalEl.textContent = UI.formatCurrency(total);

    updateGrandTotal();
  };

  const updateGrandTotal = () => {
    const container = $("purchaseItemsContainer");
    const grandTotalEl = $("grandTotalValue");
    if (!container || !grandTotalEl) return;

    let total = 0;
    container.querySelectorAll(".purchase-item-row").forEach(row => {
      const qty = parseFloat(row.querySelector(".row-quantity")?.value) || 0;
      const price = parseFloat(row.querySelector(".row-price")?.value) || 0;
      total += qty * price;
    });

    grandTotalEl.textContent = UI.formatCurrency(total);
  };

  // ─── Form Validation & Submit ────────────────────────────────────────────────
  const handlePurchaseSubmit = async (e) => {
    e.preventDefault();
    showFormServerError("purchaseServerError", "");

    // Validate header fields
    const supplierName = ($("supplierName")?.value || "").trim();
    const purchaseDate = ($("purchaseDate")?.value || "").trim();

    let valid = true;
    clearFormErrors(["err_supplier", "err_date"]);

    if (!supplierName) {
      setFieldError("err_supplier", "Supplier name is required.");
      valid = false;
    }
    if (!purchaseDate) {
      setFieldError("err_date", "Purchase date is required.");
      valid = false;
    }

    // Validate item rows
    const container = $("purchaseItemsContainer");
    if (!container) return;

    const rows = container.querySelectorAll(".purchase-item-row");
    const items = [];
    const selectedProductIds = new Set();
    let rowErrors = false;

    rows.forEach((row, index) => {
      const productSelect = row.querySelector(".row-product");
      const qtyInput = row.querySelector(".row-quantity");
      const priceInput = row.querySelector(".row-price");

      const productId = productSelect?.value || "";
      const quantity = parseInt(qtyInput?.value, 10);
      const price = parseFloat(priceInput?.value);

      // Highlight invalid fields
      if (!productId) {
        productSelect?.classList.add("is-invalid");
        rowErrors = true;
      } else {
        productSelect?.classList.remove("is-invalid");
      }

      if (isNaN(quantity) || quantity <= 0) {
        qtyInput?.classList.add("is-invalid");
        rowErrors = true;
      } else {
        qtyInput?.classList.remove("is-invalid");
      }

      if (isNaN(price) || price <= 0) {
        priceInput?.classList.add("is-invalid");
        rowErrors = true;
      } else {
        priceInput?.classList.remove("is-invalid");
      }

      // Check duplicate product in same purchase
      if (productId && selectedProductIds.has(productId)) {
        productSelect?.classList.add("is-invalid");
        showFormServerError("purchaseServerError", `Duplicate product in row ${index + 1}. Each product can only appear once per purchase.`);
        rowErrors = true;
      }

      if (productId) selectedProductIds.add(productId);

      if (productId && !isNaN(quantity) && quantity > 0 && !isNaN(price) && price > 0) {
        items.push({
          product_id: productId,
          quantity: quantity,
          purchase_price: price,
        });
      }
    });

    if (rowErrors) {
      if (!document.querySelector(".form-server-error:not(.hidden)")?.textContent) {
        showFormServerError("purchaseServerError", "Please fill in all item rows completely.");
      }
      return;
    }

    if (!valid) return;

    if (items.length === 0) {
      showFormServerError("purchaseServerError", "Add at least one item to the purchase.");
      return;
    }

    // Submit
    const payload = {
      supplier_name: supplierName,
      purchase_date: purchaseDate,
      items: items,
    };

    setButtonLoading("purchaseSubmitBtn", true);

    try {
      const response = await fetch(
        `${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.PURCHASE_CREATE}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();

      if (response.status === 422) {
        const detail = result.detail;
        const msg = Array.isArray(detail)
          ? detail.map((d) => d.msg).join("; ")
          : String(detail || "Validation error.");
        showFormServerError("purchaseServerError", msg);
        return;
      }

      if (response.status === 401) {
        UI.showToast("Session Expired", "Please log in again.", "error");
        setTimeout(() => { window.location.href = "login.html"; }, 1200);
        return;
      }

      if (response.status === 403) {
        UI.showToast("Forbidden", "Only admins can create purchases.", "error");
        return;
      }

      if (response.status === 400) {
        showFormServerError("purchaseServerError", result.detail || "Invalid purchase data.");
        return;
      }

      if (response.status === 404) {
        showFormServerError("purchaseServerError", result.detail || "Product not found.");
        return;
      }

      if (!response.ok) {
        const msg = result.message || result.detail || `Server error (${response.status})`;
        showFormServerError("purchaseServerError", msg);
        return;
      }

      // Success — add created purchase to local list (no /purchases/all or /product/all refetch)
      UI.showToast(
        "Purchase Recorded",
        `Order from "${supplierName}" saved. Total: ${UI.formatCurrency(result.total_amount)}`,
        "success"
      );
      UI.closeModal("createPurchaseModal");
      applyCreatedPurchase(result);

    } catch (err) {
      console.error("[Purchases] handlePurchaseSubmit error:", err);
      showFormServerError("purchaseServerError", "Could not reach the server. Please check your connection.");
    } finally {
      setButtonLoading("purchaseSubmitBtn", false);
    }
  };

  /**
   * Prepend a newly created purchase from POST /purchases/create response into local state.
   */
  const applyCreatedPurchase = (result) => {
    if (!result || !result.purchase_id) return;

    const purchase = {
      purchase_id: result.purchase_id,
      supplier_name: result.supplier_name || "",
      date: result.date || "",
      total_amount: result.total_amount || 0,
      items: Array.isArray(result.items) ? result.items : [],
    };

    if (!isDateInActiveFilter(purchase.date)) {
      updateStats();
      return;
    }

    purchasesList.unshift(purchase);
    renderPurchaseHistory();
    updateStats();
  };

  // ─── Inline Add Product ──────────────────────────────────────────────────────
  let pendingRowIndex = null;

  const openInlineAddProduct = (rowIndex) => {
    pendingRowIndex = rowIndex;

    // Reset form
    const form = $("inlineAddProductForm");
    if (form) form.reset();

    clearFormErrors(["err_inline_name", "err_inline_brand", "err_inline_size", "err_inline_price", "err_inline_stock"]);
    showFormServerError("inlineAddServerError", "");

    ["inline_name", "inline_brand", "inline_size", "inline_price", "inline_stock"].forEach(id => {
      const el = $(id);
      if (el) el.classList.remove("is-invalid");
    });

    UI.openModal("inlineAddProductModal");
  };

  const handleInlineAddProduct = async (e) => {
    e.preventDefault();
    showFormServerError("inlineAddServerError", "");

    const name = ($("inline_name")?.value || "").trim();
    const brand = ($("inline_brand")?.value || "").trim();
    const size = ($("inline_size")?.value || "").trim();
    const price = parseFloat($("inline_price")?.value);
    const stock = parseInt($("inline_stock")?.value, 10);

    let valid = true;
    clearFormErrors(["err_inline_name", "err_inline_brand", "err_inline_size", "err_inline_price", "err_inline_stock"]);

    if (!name) { setFieldError("err_inline_name", "Tile name is required."); valid = false; }
    if (!brand) { setFieldError("err_inline_brand", "Brand is required."); valid = false; }
    if (!size) { setFieldError("err_inline_size", "Size is required."); valid = false; }
    if (isNaN(price) || price <= 0) { setFieldError("err_inline_price", "Purchase price must be > ₹ 0."); valid = false; }
    if (isNaN(stock) || stock < 0) { setFieldError("err_inline_stock", "Stock cannot be negative."); valid = false; }

    if (!valid) return;

    const payload = { name, brand, size, purchase_price: price, stock_quantity: stock };

    setButtonLoading("inlineAddSubmitBtn", true);

    try {
      const response = await fetch(
        `${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.PRODUCT_ADD}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();

      if (response.status === 422) {
        const detail = result.detail;
        const msg = Array.isArray(detail) ? detail.map(d => d.msg).join("; ") : String(detail || "Validation error.");
        showFormServerError("inlineAddServerError", msg);
        return;
      }

      if (!response.ok) {
        showFormServerError("inlineAddServerError", result.message || result.detail || "Failed to add product.");
        return;
      }

      if (result.message === "Product already exists") {
        showFormServerError("inlineAddServerError", "A product with this name, brand, and size already exists.");
        return;
      }

      // Success — reload products
      UI.showToast("Product Added", `"${name}" added to catalog.`, "success");
      UI.closeModal("inlineAddProductModal");

      await loadProducts();

      // Auto-select in the pending row
      if (pendingRowIndex !== null && result.product_id) {
        const row = document.querySelector(`[data-row-id="${pendingRowIndex}"]`);
        if (row) {
          const select = row.querySelector(".row-product");
          if (select) {
            // Refresh options
            refreshProductDropdowns();
            select.value = result.product_id;
          }
        }
      }

      pendingRowIndex = null;

    } catch (err) {
      console.error("[Purchases] handleInlineAddProduct error:", err);
      showFormServerError("inlineAddServerError", "Could not reach the server.");
    } finally {
      setButtonLoading("inlineAddSubmitBtn", false);
    }
  };

  /** Refresh all product dropdowns with current productsList */
  const refreshProductDropdowns = () => {
    const selects = document.querySelectorAll(".row-product");
    selects.forEach(select => {
      const currentVal = select.value;
      const options = productsList.map(p =>
        `<option value="${UI.escapeHTML(p.product_id)}">${UI.escapeHTML(p.product_name)} — ${UI.escapeHTML(p.product_brand)} (${UI.escapeHTML(p.product_size)})</option>`
      ).join("");
      select.innerHTML = `<option value="">Select a product...</option>${options}`;
      if (currentVal) select.value = currentVal;
    });
  };

  // ─── Date Formatting ─────────────────────────────────────────────────────────
  const formatDate = (dateStr) => {
    try {
      const d = new Date(dateStr + "T00:00:00");
      return d.toLocaleDateString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  // ─── Event Listeners ─────────────────────────────────────────────────────────
  const setupEventListeners = () => {
    // Open create modal
    $("openCreatePurchaseBtn")?.addEventListener("click", openCreateModal);

    // Add item row
    $("addItemRowBtn")?.addEventListener("click", addItemRow);

    // Purchase form submit
    $("purchaseForm")?.addEventListener("submit", handlePurchaseSubmit);

    // Inline add product form
    $("inlineAddProductForm")?.addEventListener("submit", handleInlineAddProduct);

    $("applyPurchasesDateFilterBtn")?.addEventListener("click", applyDateFilter);
    $("clearPurchasesDateFilterBtn")?.addEventListener("click", clearDateFilter);
  };

  // ─── Init ────────────────────────────────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", async () => {
    setupEventListeners();
    // Only load purchases on page load/refresh.
    // product/all is fetched when Create Purchase is opened.
    await loadPurchases();
  });

  // ─── Public API ──────────────────────────────────────────────────────────────
  return {
    loadPurchases,
    refreshPurchases,
    openCreateModal,
    toggleCard,
    addItemRow,
    removeItemRow,
    openInlineAddProduct,
    refreshProductDropdowns,
  };
})();

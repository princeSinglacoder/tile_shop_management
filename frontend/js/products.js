/**
 * Products Module — TilePro Management
 *
 * Handles all CRUD operations for the Products page.
 *
 * Backend endpoints:
 *  GET    /product/all              — list all products
 *  POST   /product/add              — add product { name, brand, size, selling_price, stock_quantity }
 *  PUT    /product/edit/{id}        — update product { name?, brand?, size?, selling_price? }
 *  DELETE /product/delete/{id}      — delete product
 *
 * Design rules:
 *  - product_id is NEVER shown visually; stored in JS state + data-product-id attr only
 *  - stock_quantity is read-only in Edit form; not sent in PUT request
 *  - No offline/demo fallback for mutations (only real API calls)
 */

const Products = (() => {
  // ─── State ───────────────────────────────────────────────────────────────────
  let productsList = [];       // Full list from API
  let currentEditingId = null; // product_id being edited

  // ─── DOM Helpers ─────────────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);

  /** Show inline field error */
  const setFieldError = (errId, msg) => {
    const el = $(errId);
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle("visible", !!msg);
    // Mark input invalid
    const fieldId = errId.replace(/^err_/, "");
    const input = $(fieldId);
    if (input) input.classList.toggle("is-invalid", !!msg);
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

  // ─── Connection Status ────────────────────────────────────────────────────────
  const setConnectionStatus = (state) => {
    const dot = $("statusDot");
    const text = $("statusText");
    if (!dot || !text) return;
    const states = {
      online:  { color: "var(--success)", label: "API Online" },
      offline: { color: "var(--danger)",  label: "API Offline" },
      loading: { color: "var(--warning)", label: "Connecting..." },
    };
    const s = states[state] || states.loading;
    dot.style.background = s.color;
    dot.style.boxShadow  = `0 0 0 2px ${s.color}22`;
    text.textContent = s.label;
  };

  // ─── API Error Banner ─────────────────────────────────────────────────────────
  const showApiBanner = (msg) => {
    const banner = $("apiErrorBanner");
    const msgEl  = $("apiErrorMsg");
    if (banner) banner.classList.remove("hidden");
    if (msgEl)  msgEl.textContent = msg || "Could not connect to the server.";
  };

  const hideApiBanner = () => {
    const banner = $("apiErrorBanner");
    if (banner) banner.classList.add("hidden");
  };

  // ─── Load Products (GET /product/all) ────────────────────────────────────────
  const loadProducts = async () => {
    hideApiBanner();
    showLoadingState();
    setConnectionStatus("loading");

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
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (Array.isArray(data)) {
        productsList = data;
        setConnectionStatus("online");
      } else if (data && data.message) {
        // Backend authorization message
        productsList = [];
        UI.showToast("Notice", data.message, "warning");
        setConnectionStatus("online");
      } else {
        productsList = [];
        setConnectionStatus("online");
      }

    } catch (error) {
      console.error("[Products] loadProducts failed:", error);
      productsList = [];
      setConnectionStatus("offline");
      showApiBanner(error.message);
    }

    populateFilters();
    renderTable();
    updateStatsSummary();
  };

  // ─── Filter / Sort Logic ──────────────────────────────────────────────────────
  const populateFilters = () => {
    const brandFilter = $("filterBrand");
    const sizeFilter  = $("filterSize");

    if (brandFilter) {
      const prev = brandFilter.value;
      const brands = [...new Set(productsList.map((p) => (p.product_brand || "").trim()))].filter(Boolean).sort();
      brandFilter.innerHTML =
        `<option value="">All Brands (${brands.length})</option>` +
        brands.map((b) => `<option value="${UI.escapeHTML(b)}">${UI.escapeHTML(b)}</option>`).join("");
      brandFilter.value = prev;
    }

    if (sizeFilter) {
      const prev = sizeFilter.value;
      const sizes = [...new Set(productsList.map((p) => (p.product_size || "").trim()))].filter(Boolean).sort();
      sizeFilter.innerHTML =
        `<option value="">All Sizes (${sizes.length})</option>` +
        sizes.map((s) => `<option value="${UI.escapeHTML(s)}">${UI.escapeHTML(s)}</option>`).join("");
      sizeFilter.value = prev;
    }
  };

  const getFilteredProducts = () => {
    const query  = (($("productSearch") || {}).value || "").trim().toLowerCase();
    const brand  = (($("filterBrand") || {}).value || "");
    const size   = (($("filterSize")  || {}).value || "");
    const sortBy = (($("sortBy")      || {}).value || "name-asc");

    let result = productsList.filter((item) => {
      const name  = (item.product_name  || "").toLowerCase();
      const bName = (item.product_brand || "").toLowerCase();
      const sName = (item.product_size  || "").toLowerCase();

      const matchesQuery = !query || name.includes(query) || bName.includes(query) || sName.includes(query);
      const matchesBrand = !brand || item.product_brand === brand;
      const matchesSize  = !size  || item.product_size  === size;

      return matchesQuery && matchesBrand && matchesSize;
    });

    result.sort((a, b) => {
      const priceA = parseFloat(a.product_selling_price)  || 0;
      const priceB = parseFloat(b.product_selling_price)  || 0;
      const stockA = parseInt(a.product_stock_quantity, 10) || 0;
      const stockB = parseInt(b.product_stock_quantity, 10) || 0;
      const nameA  = (a.product_name || "").toLowerCase();
      const nameB  = (b.product_name || "").toLowerCase();

      switch (sortBy) {
        case "name-desc":   return nameB.localeCompare(nameA);
        case "price-asc":   return priceA - priceB;
        case "price-desc":  return priceB - priceA;
        case "stock-asc":   return stockA - stockB;
        case "stock-desc":  return stockB - stockA;
        default:            return nameA.localeCompare(nameB); // name-asc
      }
    });

    return result;
  };

  // ─── Render Table ─────────────────────────────────────────────────────────────
  const renderTable = () => {
    const tbody   = $("productsTableBody");
    const countEl = $("productsCount");
    if (!tbody) return;

    const filtered = getFilteredProducts();
    const total    = productsList.length;
    const showing  = filtered.length;

    if (countEl) {
      countEl.textContent = total === showing
        ? `${total} product${total !== 1 ? "s" : ""}`
        : `${showing} of ${total} products`;
    }

    if (filtered.length === 0) {
      const isSearching = ($("productSearch") || {}).value || $("filterBrand")?.value || $("filterSize")?.value;
      tbody.innerHTML = isSearching
        ? renderEmptyFiltered()
        : renderEmptyAll();
      return;
    }

    tbody.innerHTML = filtered.map(renderProductRow).join("");
  };

  const renderProductRow = (product) => {
    const stock = parseInt(product.product_stock_quantity, 10) || 0;
    const name  = UI.escapeHTML(product.product_name  || "—");
    const brand = UI.escapeHTML(product.product_brand || "—");
    const size  = UI.escapeHTML(product.product_size  || "—");
    const id    = UI.escapeHTML(product.product_id    || "");

    let stockBadgeClass = "badge-success";
    let stockLabel      = `${stock} boxes`;
    let stockDot        = "dot-green";

    if (stock <= 0) {
      stockBadgeClass = "badge-danger";
      stockLabel      = "Out of stock";
      stockDot        = "dot-red";
    } else if (stock <= 15) {
      stockBadgeClass = "badge-warning";
      stockLabel      = `${stock} (Low)`;
      stockDot        = "dot-amber";
    }

    return `
      <tr data-product-id="${id}" class="product-row">
        <td>
          <div class="product-name-cell">
            <span class="product-name-text">${name}</span>
          </div>
        </td>
        <td>
          <span class="badge badge-brand">${brand}</span>
        </td>
        <td>
          <span class="tile-size-pill">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2"></rect></svg>
            ${size}
          </span>
        </td>
        <td>
          <span class="price-tag">${UI.formatCurrency(product.product_selling_price)}</span>
        </td>
        <td>
          <div class="stock-cell">
            <span class="stock-dot ${stockDot}"></span>
            <span class="badge ${stockBadgeClass}">${stockLabel}</span>
          </div>
        </td>
        <td>
          <div class="table-actions">
            <button
              type="button"
              class="btn btn-icon edit"
              title="Edit Product"
              data-action="edit"
              data-id="${id}"
              aria-label="Edit ${name}"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button
              type="button"
              class="btn btn-icon delete"
              title="Delete Product"
              data-action="delete"
              data-id="${id}"
              data-name="${name}"
              aria-label="Delete ${name}"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  };

  const renderEmptyFiltered = () => `
    <tr>
      <td colspan="6">
        <div class="empty-state">
          <div class="empty-icon-wrapper">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
          <h4 class="empty-title">No Tiles Match Your Search</h4>
          <p class="empty-description">No products match the active filters. Try clearing your search or adjusting the filters.</p>
          <button type="button" class="btn btn-secondary" id="clearSearchBtn">Clear Filters</button>
        </div>
      </td>
    </tr>
  `;

  const renderEmptyAll = () => `
    <tr>
      <td colspan="6">
        <div class="empty-state">
          <div class="empty-icon-wrapper">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
          </div>
          <h4 class="empty-title">No Tiles in Catalog</h4>
          <p class="empty-description">Your inventory is empty. Add your first tile product to get started.</p>
          <button type="button" class="btn btn-primary" id="emptyAddBtn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add New Tile
          </button>
        </div>
      </td>
    </tr>
  `;

  // ─── Skeleton Loading State ───────────────────────────────────────────────────
  const showLoadingState = () => {
    const tbody   = $("productsTableBody");
    const countEl = $("productsCount");
    if (!tbody) return;

    if (countEl) countEl.textContent = "Loading...";

    tbody.innerHTML = Array.from({ length: 5 }).map(() => `
      <tr class="skeleton-row">
        <td><div class="skeleton" style="height:18px;width:65%;margin-bottom:5px;"></div></td>
        <td><div class="skeleton" style="height:22px;width:80px;border-radius:9999px;"></div></td>
        <td><div class="skeleton" style="height:22px;width:100px;border-radius:6px;"></div></td>
        <td><div class="skeleton" style="height:18px;width:72px;"></div></td>
        <td><div class="skeleton" style="height:22px;width:90px;border-radius:9999px;"></div></td>
        <td><div class="skeleton" style="height:32px;width:72px;margin-left:auto;border-radius:8px;"></div></td>
      </tr>
    `).join("");
  };

  // ─── Stats Summary ────────────────────────────────────────────────────────────
  const updateStatsSummary = () => {
    const totalEl   = $("statTotalProducts");
    const brandsEl  = $("statTotalBrands");
    const lowStEl   = $("statLowStock");
    const valEl     = $("statInventoryValue");

    const total       = productsList.length;
    const uniqueBrands = new Set(productsList.map((p) => (p.product_brand || "").toLowerCase().trim())).size;
    // Low stock: > 0 but <= 15 (truly low, not out-of-stock)
    const lowStockCount = productsList.filter((p) => {
      const q = parseInt(p.product_stock_quantity, 10) || 0;
      return q > 0 && q <= 15;
    }).length;
    const totalValue = productsList.reduce((acc, p) => {
      const price = parseFloat(p.product_selling_price)   || 0;
      const stock = parseInt(p.product_stock_quantity, 10) || 0;
      return acc + price * stock;
    }, 0);

    if (totalEl)  totalEl.textContent  = total;
    if (brandsEl) brandsEl.textContent = uniqueBrands;
    if (lowStEl)  lowStEl.textContent  = lowStockCount;
    if (valEl)    valEl.textContent    = UI.formatCurrency(totalValue);
  };

  // ─── Add Product ─────────────────────────────────────────────────────────────
  const openAddModal = () => {
    const form = $("addProductForm");
    if (form) form.reset();

    clearFormErrors(["err_add_name", "err_add_brand", "err_add_size", "err_add_price", "err_add_stock"]);
    showFormServerError("addServerError", "");

    // Clear invalid states
    ["add_name", "add_brand", "add_size", "add_price", "add_stock"].forEach((id) => {
      const el = $(id);
      if (el) el.classList.remove("is-invalid");
    });

    UI.openModal("addProductModal");
  };

  const validateAddForm = () => {
    const name  = ($("add_name")  || {}).value?.trim() || "";
    const brand = ($("add_brand") || {}).value?.trim() || "";
    const size  = ($("add_size")  || {}).value?.trim() || "";
    const price = parseFloat(($("add_price") || {}).value);
    const stock = parseInt(($("add_stock")   || {}).value, 10);

    let valid = true;
    clearFormErrors(["err_add_name", "err_add_brand", "err_add_size", "err_add_price", "err_add_stock"]);

    if (!name)                     { setFieldError("err_add_name",  "Tile name is required."); valid = false; }
    if (!brand)                    { setFieldError("err_add_brand", "Brand is required.");       valid = false; }
    if (!size)                     { setFieldError("err_add_size",  "Size is required.");        valid = false; }
    if (isNaN(price) || price <= 0){ setFieldError("err_add_price", "Price must be greater than ₹ 0."); valid = false; }
    if (isNaN(stock) || stock < 0) { setFieldError("err_add_stock", "Stock cannot be negative."); valid = false; }

    return valid ? { name, brand, size, selling_price: price, stock_quantity: stock } : null;
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    showFormServerError("addServerError", "");

    const payload = validateAddForm();
    if (!payload) return;

    setButtonLoading("addSubmitBtn", true);

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

      // Handle FastAPI validation errors (422)
      if (response.status === 422) {
        const detail = result.detail;
        const msg = Array.isArray(detail)
          ? detail.map((d) => d.msg).join("; ")
          : String(detail || "Validation error.");
        showFormServerError("addServerError", msg);
        return;
      }

      if (response.status === 401) {
        UI.showToast("Session Expired", "Please log in again.", "error");
        setTimeout(() => { window.location.href = "login.html"; }, 1200);
        return;
      }

      if (!response.ok) {
        const msg = result.message || result.detail || `Server error (${response.status})`;
        showFormServerError("addServerError", msg);
        return;
      }

      // Backend returns { message: "Product already exists" } with 200
      if (result.message === "Product already exists") {
        showFormServerError("addServerError", "A tile with this name, brand, and size already exists.");
        return;
      }

      if (result.message && result.message.toLowerCase().includes("not authorized")) {
        UI.showToast("Unauthorized", result.message, "error");
        return;
      }

      // Success
      UI.showToast("Product Added", `"${payload.name}" added to inventory.`, "success");
      UI.closeModal("addProductModal");

      // Optimistic: add to local list or reload
      if (result.product_id) {
        productsList.unshift(result);
        populateFilters();
        renderTable();
        updateStatsSummary();
      } else {
        await loadProducts();
      }

    } catch (err) {
      console.error("[Products] handleAddSubmit error:", err);
      showFormServerError("addServerError", "Could not reach the server. Please check your connection.");
    } finally {
      setButtonLoading("addSubmitBtn", false);
    }
  };

  // ─── Edit Product ─────────────────────────────────────────────────────────────
  const openEditModal = (productId) => {
    const product = productsList.find((p) => p.product_id === productId);
    if (!product) {
      UI.showToast("Error", "Product not found in local state.", "error");
      return;
    }

    currentEditingId = productId;

    // Populate fields
    const setVal = (id, val) => { const el = $(id); if (el) el.value = val != null ? val : ""; };
    setVal("edit_name",  product.product_name  || "");
    setVal("edit_brand", product.product_brand || "");
    setVal("edit_size",  product.product_size  || "");
    setVal("edit_price", parseFloat(product.product_selling_price) || "");

    const stockEl = $("editStockDisplay");
    if (stockEl) stockEl.textContent = product.product_stock_quantity ?? "0";

    // Clear errors
    clearFormErrors(["err_edit_name", "err_edit_brand", "err_edit_size", "err_edit_price"]);
    showFormServerError("editServerError", "");
    ["edit_name", "edit_brand", "edit_size", "edit_price"].forEach((id) => {
      const el = $(id);
      if (el) el.classList.remove("is-invalid");
    });

    UI.openModal("editProductModal");
  };

  const validateEditForm = () => {
    const name  = ($("edit_name")  || {}).value?.trim() || "";
    const brand = ($("edit_brand") || {}).value?.trim() || "";
    const size  = ($("edit_size")  || {}).value?.trim() || "";
    const price = parseFloat(($("edit_price") || {}).value);

    let valid = true;
    clearFormErrors(["err_edit_name", "err_edit_brand", "err_edit_size", "err_edit_price"]);

    // At least one field should be filled for an update
    if (!name && !brand && !size && isNaN(price)) {
      showFormServerError("editServerError", "Please update at least one field.");
      return null;
    }

    if (name.length > 100)  { setFieldError("err_edit_name",  "Name too long (max 100 chars)."); valid = false; }
    if (brand.length > 100) { setFieldError("err_edit_brand", "Brand too long (max 100 chars)."); valid = false; }
    if (size.length > 30)   { setFieldError("err_edit_size",  "Size too long (max 30 chars)."); valid = false; }
    if (!isNaN(price) && price <= 0) { setFieldError("err_edit_price", "Price must be greater than ₹ 0."); valid = false; }

    if (!valid) return null;

    // Build partial payload (only changed/filled fields)
    const payload = {};
    if (name)               payload.name          = name;
    if (brand)              payload.brand         = brand;
    if (size)               payload.size          = size;
    if (!isNaN(price) && price > 0) payload.selling_price = price;

    return payload;
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!currentEditingId) return;

    showFormServerError("editServerError", "");

    const payload = validateEditForm();
    if (!payload) return;

    setButtonLoading("editSubmitBtn", true);

    try {
      const response = await fetch(
        `${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.PRODUCT_EDIT(currentEditingId)}`,
        {
          method: "PUT",
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
        showFormServerError("editServerError", msg);
        return;
      }

      if (response.status === 401) {
        UI.showToast("Session Expired", "Please log in again.", "error");
        setTimeout(() => { window.location.href = "login.html"; }, 1200);
        return;
      }

      if (!response.ok) {
        const msg = result.message || result.detail || `Server error (${response.status})`;
        showFormServerError("editServerError", msg);
        return;
      }

      if (result.message && result.message.toLowerCase().includes("not authorized")) {
        UI.showToast("Unauthorized", result.message, "error");
        return;
      }

      if (result.message === "Product not found") {
        showFormServerError("editServerError", "Product not found. It may have been deleted.");
        return;
      }

      // Duplicate check
      if (result.message && result.message.toLowerCase().includes("already exists")) {
        showFormServerError("editServerError", "A tile with this name, brand, and size already exists.");
        return;
      }

      UI.showToast("Product Updated", "Tile details updated successfully.", "success");
      UI.closeModal("editProductModal");

      // Update local state
      const idx = productsList.findIndex((p) => p.product_id === currentEditingId);
      if (idx !== -1) {
        const orig = productsList[idx];
        productsList[idx] = {
          ...orig,
          product_name:          payload.name          ?? orig.product_name,
          product_brand:         payload.brand         ?? orig.product_brand,
          product_size:          payload.size          ?? orig.product_size,
          product_selling_price: payload.selling_price != null ? String(payload.selling_price) : orig.product_selling_price,
        };
      }

      populateFilters();
      renderTable();
      updateStatsSummary();

    } catch (err) {
      console.error("[Products] handleEditSubmit error:", err);
      showFormServerError("editServerError", "Could not reach the server. Please check your connection.");
    } finally {
      setButtonLoading("editSubmitBtn", false);
      currentEditingId = null;
    }
  };

  // ─── Delete Product ───────────────────────────────────────────────────────────
  const confirmDelete = (productId, productName) => {
    const displayName = productName || "this tile";

    UI.showConfirm({
      title: "Delete Tile?",
      message: `Are you sure you want to permanently remove "${displayName}" from inventory? This cannot be undone.`,
      confirmText: "Delete Tile",
      cancelText: "Keep It",
      onConfirm: () => executeDelete(productId, displayName),
    });
  };

  const executeDelete = async (productId, displayName) => {
    try {
      const response = await fetch(
        `${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.PRODUCT_DELETE(productId)}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      const result = await response.json();

      if (response.status === 401) {
        UI.showToast("Session Expired", "Please log in again.", "error");
        setTimeout(() => { window.location.href = "login.html"; }, 1200);
        return;
      }

      if (response.status === 403) {
        UI.showToast("Forbidden", "You do not have permission to delete products.", "error");
        return;
      }

      if (result.message && result.message.toLowerCase().includes("not authorized")) {
        UI.showToast("Unauthorized", result.message, "error");
        return;
      }

      if (result.message === "Product does not exist") {
        UI.showToast("Not Found", "This product no longer exists.", "warning");
        // Remove from local state anyway
        productsList = productsList.filter((p) => p.product_id !== productId);
        populateFilters();
        renderTable();
        updateStatsSummary();
        return;
      }

      if (!response.ok) {
        const msg = result.message || result.detail || `Server error (${response.status})`;
        UI.showToast("Delete Failed", msg, "error");
        return;
      }

      UI.showToast("Deleted", `"${displayName}" removed from inventory.`, "success");

      // Animate row removal then update state
      const row = document.querySelector(`[data-product-id="${CSS.escape(productId)}"]`);
      if (row) {
        row.classList.add("row-removing");
        setTimeout(() => {
          productsList = productsList.filter((p) => p.product_id !== productId);
          populateFilters();
          renderTable();
          updateStatsSummary();
        }, 300);
      } else {
        productsList = productsList.filter((p) => p.product_id !== productId);
        populateFilters();
        renderTable();
        updateStatsSummary();
      }

    } catch (err) {
      console.error("[Products] executeDelete error:", err);
      UI.showToast("Delete Failed", "Could not reach the server. Please check your connection.", "error");
    }
  };

  // ─── Event Listeners ──────────────────────────────────────────────────────────
  const setupEventListeners = () => {
    // Search & filters — re-render on every change
    const reRender = () => renderTable();
    $("productSearch")?.addEventListener("input", reRender);
    $("filterBrand")?.addEventListener("change", reRender);
    $("filterSize")?.addEventListener("change", reRender);
    $("sortBy")?.addEventListener("change", reRender);

    // Reset filters
    $("resetFiltersBtn")?.addEventListener("click", () => {
      const s = $("productSearch"); if (s) s.value = "";
      const b = $("filterBrand");   if (b) b.value = "";
      const z = $("filterSize");    if (z) z.value = "";
      const o = $("sortBy");        if (o) o.value = "name-asc";
      renderTable();
    });

    // Refresh & retry
    $("refreshBtn")?.addEventListener("click", loadProducts);
    $("retryLoadBtn")?.addEventListener("click", loadProducts);

    // Open Add Modal button in header
    $("openAddModalBtn")?.addEventListener("click", openAddModal);

    // Form submissions
    $("addProductForm")?.addEventListener("submit", handleAddSubmit);
    $("editProductForm")?.addEventListener("submit", handleEditSubmit);

    // Table delegation — edit / delete / empty-state buttons
    $("productsTableBody")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;

      const action = btn.dataset.action;
      const id     = btn.dataset.id;
      const name   = btn.dataset.name;

      if (action === "edit")   openEditModal(id);
      if (action === "delete") confirmDelete(id, name);

      // Empty state buttons
      const clear = e.target.closest("#clearSearchBtn");
      if (clear) {
        const s = $("productSearch"); if (s) s.value = "";
        const b = $("filterBrand");   if (b) b.value = "";
        const z = $("filterSize");    if (z) z.value = "";
        renderTable();
      }

      const emptyAdd = e.target.closest("#emptyAddBtn");
      if (emptyAdd) openAddModal();
    });
  };

  // ─── Init ─────────────────────────────────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", () => {
    setupEventListeners();
    loadProducts();
  });

  // ─── Public API ───────────────────────────────────────────────────────────────
  return {
    loadProducts,
    openAddModal,
    openEditModal,
    confirmDelete,
    renderTable,
  };
})();

/**
 * Rejections Module — TilePro Management
 *
 * Rejection / waste history and create form.
 *
 * Backend endpoints:
 *  GET  /rejections/all
 *  POST /rejections/create  { product_id, quantity, reason }
 *  GET  /product/all        — for product dropdown only (page load / modal open)
 */

const Rejections = (() => {
  let rejectionsList = [];
  let productsList = [];
  let activeStartDate = null;
  let activeEndDate = null;

  const $ = (id) => document.getElementById(id);

  const setFieldError = (errId, msg) => {
    const el = $(errId);
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle("visible", !!msg);
    const fieldId = errId.replace(/^err_/, "");
    const input = $(fieldId);
    if (input) input.classList.toggle("is-invalid", !!msg);
  };

  const clearFormErrors = (errIds) => {
    errIds.forEach((id) => setFieldError(id, ""));
  };

  const setButtonLoading = (btnId, loading) => {
    const btn = $(btnId);
    if (!btn) return;
    const label = btn.querySelector(".btn-label");
    const spinner = btn.querySelector(".btn-spinner");
    btn.disabled = loading;
    if (label) label.classList.toggle("hidden", loading);
    if (spinner) spinner.classList.toggle("hidden", !loading);
  };

  const showFormServerError = (containerId, msg) => {
    const el = $(containerId);
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle("hidden", !msg);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr + (String(dateStr).includes("T") ? "" : "T00:00:00"));
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return String(dateStr);
    }
  };

  const showApiBanner = (msg) => {
    const banner = $("apiErrorBanner");
    const msgEl = $("apiErrorMsg");
    if (banner) banner.classList.remove("hidden");
    if (msgEl) msgEl.textContent = msg || "Could not connect to the server.";
  };

  const hideApiBanner = () => {
    const banner = $("apiErrorBanner");
    if (banner) banner.classList.add("hidden");
  };

  // ─── Load products (dropdown only) ───────────────────────────────────────────
  const loadProducts = async () => {
    try {
      const response = await fetch(
        `${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.PRODUCTS_ALL}`,
        {
          method: "GET",
          headers: { Accept: "application/json" },
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
      if (Array.isArray(data)) productsList = data;
    } catch (err) {
      console.error("[Rejections] loadProducts failed:", err);
    }
  };

  // ─── Load rejection history ──────────────────────────────────────────────────
  const isDateFilterActive = () => !!(activeStartDate || activeEndDate);

  const isDateInActiveFilter = (dateStr) => {
    if (!isDateFilterActive()) return true;
    if (!dateStr) return false;
    if (activeStartDate && dateStr < activeStartDate) return false;
    if (activeEndDate && dateStr > activeEndDate) return false;
    return true;
  };

  const buildFilterUrl = (start, end) => {
    const url = new URL(`${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.REJECTIONS_FILTER}`);
    if (start) url.searchParams.set("start_date", start);
    if (end) url.searchParams.set("end_date", end);
    return url.toString();
  };

  const fetchRejectionsFromUrl = async (requestUrl) => {
    hideApiBanner();
    showLoadingState();

    try {
      const response = await fetch(requestUrl, {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "include",
      });

      if (response.status === 401) {
        UI.showToast("Session Expired", "Please log in again.", "error");
        setTimeout(() => { window.location.href = "login.html"; }, 1200);
        return;
      }

      if (response.status === 403) {
        rejectionsList = [];
        UI.showToast("Forbidden", "Only admins can view rejections.", "error");
        renderTable();
        updateStats();
        return;
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const detail = errData.detail || `Server error: ${response.status}`;
        throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
      }

      const data = await response.json();
      rejectionsList = Array.isArray(data) ? data : [];
    } catch (err) {
      console.error("[Rejections] fetchRejections failed:", err);
      rejectionsList = [];
      showApiBanner(err.message);
    }

    renderTable();
    updateStats();
  };

  /** Initial load / clear: GET /rejections/all only */
  const loadRejections = async () => {
    await fetchRejectionsFromUrl(`${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.REJECTIONS_ALL}`);
  };

  /** Apply Filter: GET /rejections/filter only */
  const applyDateFilter = async () => {
    const start = ($("rejectionsStartDate")?.value || "").trim() || null;
    const end = ($("rejectionsEndDate")?.value || "").trim() || null;

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
    await fetchRejectionsFromUrl(buildFilterUrl(start, end));
  };

  const clearDateFilter = async () => {
    const startInput = $("rejectionsStartDate");
    const endInput = $("rejectionsEndDate");
    if (startInput) startInput.value = "";
    if (endInput) endInput.value = "";
    activeStartDate = null;
    activeEndDate = null;
    await loadRejections();
  };

  const refreshRejections = async () => {
    if (isDateFilterActive()) {
      await fetchRejectionsFromUrl(buildFilterUrl(activeStartDate, activeEndDate));
    } else {
      await loadRejections();
    }
  };

  const showLoadingState = () => {
    const tbody = $("rejectionsTableBody");
    const countEl = $("rejectionsCount");
    if (countEl) countEl.textContent = "Loading...";
    if (!tbody) return;
    tbody.innerHTML = Array.from({ length: 4 }).map(() => `
      <tr class="skeleton-row">
        <td><div class="skeleton" style="height:18px;width:90px;"></div></td>
        <td><div class="skeleton" style="height:18px;width:55%;"></div></td>
        <td><div class="skeleton" style="height:18px;width:40px;"></div></td>
        <td><div class="skeleton" style="height:22px;width:80px;border-radius:9999px;"></div></td>
        <td><div class="skeleton" style="height:18px;width:70px;"></div></td>
        <td><div class="skeleton" style="height:18px;width:80px;margin-left:auto;"></div></td>
      </tr>
    `).join("");
  };

  const updateStats = () => {
    const total = rejectionsList.length;
    const boxes = rejectionsList.reduce((sum, r) => sum + (parseInt(r.quantity, 10) || 0), 0);
    const loss = rejectionsList.reduce((sum, r) => sum + (parseFloat(r.rejection_loss) || 0), 0);

    const totalEl = $("statTotalRejections");
    const boxesEl = $("statTotalBoxes");
    const lossEl = $("statTotalLoss");
    const countEl = $("rejectionsCount");

    if (totalEl) totalEl.textContent = total;
    if (boxesEl) boxesEl.textContent = boxes;
    if (lossEl) lossEl.textContent = UI.formatCurrency(loss);
    if (countEl) {
      countEl.textContent = `${total} record${total !== 1 ? "s" : ""}`;
    }
  };

  const renderTable = () => {
    const tbody = $("rejectionsTableBody");
    if (!tbody) return;

    if (rejectionsList.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="empty-state">
              <div class="empty-icon-wrapper">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="15" y1="9" x2="9" y2="15"></line>
                  <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
              </div>
              <h4 class="empty-title">No Rejections Yet</h4>
              <p class="empty-description">Record damaged or wasted showroom stock to see history here.</p>
              <button type="button" class="btn btn-outline-danger" id="emptyRejectBtn">Record Rejection</button>
            </div>
          </td>
        </tr>
      `;
      $("emptyRejectBtn")?.addEventListener("click", () => openRejectModal());
      return;
    }

    tbody.innerHTML = rejectionsList.map((r) => `
      <tr>
        <td>${UI.escapeHTML(formatDate(r.rejection_date))}</td>
        <td>
          <span class="product-name-text">${UI.escapeHTML(r.product_name || "Unknown")}</span>
        </td>
        <td>
          <span class="badge badge-warning">${parseInt(r.quantity, 10) || 0} boxes</span>
        </td>
        <td>
          <span class="badge badge-neutral">${UI.escapeHTML(r.reason || "—")}</span>
        </td>
        <td>${UI.formatCurrency(r.cost_price)}</td>
        <td style="text-align: right;">
          <span class="rejection-loss-cell">${UI.formatCurrency(r.rejection_loss)}</span>
        </td>
      </tr>
    `).join("");
  };

  // ─── Create modal ────────────────────────────────────────────────────────────
  const buildProductOptions = () => {
    const options = productsList
      .slice()
      .sort((a, b) => (a.product_name || "").localeCompare(b.product_name || ""))
      .map((p) => {
        const stock = parseInt(p.product_stock_quantity, 10) || 0;
        const label = `${p.product_name || ""} — ${p.product_brand || ""} (${p.product_size || ""}) [${stock} boxes]`;
        return `<option value="${UI.escapeHTML(p.product_id)}">${UI.escapeHTML(label)}</option>`;
      })
      .join("");
    return `<option value="">Select a product...</option>${options}`;
  };

  const updateRejectStockDisplay = () => {
    const select = $("reject_product");
    const stockEl = $("rejectStockDisplay");
    if (!select || !stockEl) return;
    const product = productsList.find((p) => p.product_id === select.value);
    stockEl.textContent = product
      ? String(parseInt(product.product_stock_quantity, 10) || 0)
      : "—";
  };

  const syncRejectReasonOther = () => {
    const reasonSelect = $("reject_reason");
    const otherInput = $("reject_reason_other");
    if (!reasonSelect || !otherInput) return;
    const isOther = reasonSelect.value === "Other";
    otherInput.classList.toggle("hidden", !isOther);
    if (!isOther) otherInput.value = "";
  };

  const openRejectModal = async () => {
    await loadProducts();

    const form = $("rejectProductForm");
    if (form) form.reset();

    clearFormErrors(["err_reject_product", "err_reject_quantity", "err_reject_reason"]);
    showFormServerError("rejectServerError", "");
    ["reject_product", "reject_quantity", "reject_reason", "reject_reason_other"].forEach((id) => {
      const el = $(id);
      if (el) el.classList.remove("is-invalid");
    });

    const lossBox = $("rejectLossBox");
    if (lossBox) lossBox.classList.add("hidden");

    const select = $("reject_product");
    if (select) select.innerHTML = buildProductOptions();

    const otherInput = $("reject_reason_other");
    if (otherInput) {
      otherInput.classList.add("hidden");
      otherInput.value = "";
    }

    updateRejectStockDisplay();
    UI.openModal("rejectProductModal");
  };

  const validateRejectForm = () => {
    const productId = ($("reject_product") || {}).value?.trim() || "";
    const quantityRaw = ($("reject_quantity") || {}).value;
    const quantity = parseInt(quantityRaw, 10);
    const reasonSelect = ($("reject_reason") || {}).value || "";
    const reasonOther = ($("reject_reason_other") || {}).value?.trim() || "";

    let valid = true;
    clearFormErrors(["err_reject_product", "err_reject_quantity", "err_reject_reason"]);

    if (!productId) {
      setFieldError("err_reject_product", "Please select a product.");
      valid = false;
    }

    const product = productsList.find((p) => p.product_id === productId);
    const currentStock = product ? (parseInt(product.product_stock_quantity, 10) || 0) : 0;

    if (quantityRaw === "" || isNaN(quantity) || quantity <= 0) {
      setFieldError("err_reject_quantity", "Quantity must be greater than 0.");
      valid = false;
    } else if (product && quantity > currentStock) {
      setFieldError(
        "err_reject_quantity",
        `Cannot reject more than current stock (${currentStock} boxes).`
      );
      valid = false;
    }

    let reason = "";
    if (!reasonSelect) {
      setFieldError("err_reject_reason", "Please select a reason.");
      valid = false;
    } else if (reasonSelect === "Other") {
      if (!reasonOther) {
        setFieldError("err_reject_reason", "Please describe the reason.");
        valid = false;
      } else {
        reason = reasonOther;
      }
    } else {
      reason = reasonSelect;
    }

    if (!valid) return null;
    return { product_id: productId, quantity, reason };
  };

  /**
   * Prepend new rejection to local list from create response.
   * Does NOT call /rejections/all or /product/all again.
   */
  const applyRejectionResult = (result, reason) => {
    if (!result || !result.rejection_id) return;

    const product = productsList.find((p) => p.product_id === result.product_id);
    if (product && result.remaining_stock !== undefined) {
      product.product_stock_quantity = result.remaining_stock;
    }

    const rejectionDate = new Date().toISOString().split("T")[0];

    if (!isDateInActiveFilter(rejectionDate)) {
      renderTable();
      updateStats();
      return;
    }

    rejectionsList.unshift({
      rejection_id: result.rejection_id,
      product_id: result.product_id,
      product_name: product ? product.product_name : "Unknown",
      quantity: result.rejected_quantity,
      rejection_date: rejectionDate,
      reason: reason || "",
      cost_price: result.cost_price,
      rejection_loss: result.rejection_loss,
    });

    renderTable();
    updateStats();
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    showFormServerError("rejectServerError", "");

    const lossBox = $("rejectLossBox");
    if (lossBox) lossBox.classList.add("hidden");

    const payload = validateRejectForm();
    if (!payload) return;

    setButtonLoading("rejectSubmitBtn", true);

    try {
      const response = await fetch(
        `${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.REJECTION_CREATE}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          credentials: "include",
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();

      if (response.status === 422) {
        const detail = result.detail;
        const msg = Array.isArray(detail)
          ? detail.map((d) => d.msg || d.message || JSON.stringify(d)).join("; ")
          : String(detail || "Validation error.");
        showFormServerError("rejectServerError", msg);
        return;
      }

      if (response.status === 401) {
        UI.showToast("Session Expired", "Please log in again.", "error");
        setTimeout(() => { window.location.href = "login.html"; }, 1200);
        return;
      }

      if (response.status === 403) {
        showFormServerError("rejectServerError", result.detail || "Only admins can record rejections.");
        return;
      }

      if (!response.ok) {
        const msg = result.detail || result.message || `Server error (${response.status})`;
        showFormServerError("rejectServerError", typeof msg === "string" ? msg : JSON.stringify(msg));
        return;
      }

      const lossValue = $("rejectLossValue");
      if (lossBox && lossValue && result.rejection_loss !== undefined) {
        lossValue.textContent = UI.formatCurrency(result.rejection_loss);
        lossBox.classList.remove("hidden");
      }

      UI.showToast(
        "Rejection Recorded",
        `${result.rejected_quantity} box(es) rejected. Loss: ${UI.formatCurrency(result.rejection_loss)}.`,
        "success"
      );

      applyRejectionResult(result, payload.reason);

      setTimeout(() => {
        UI.closeModal("rejectProductModal");
      }, 900);
    } catch (err) {
      console.error("[Rejections] handleRejectSubmit error:", err);
      showFormServerError("rejectServerError", "Could not reach the server. Please check your connection.");
    } finally {
      setButtonLoading("rejectSubmitBtn", false);
    }
  };

  const setupEventListeners = () => {
    $("openRejectModalBtn")?.addEventListener("click", () => openRejectModal());
    $("refreshRejectionsBtn")?.addEventListener("click", refreshRejections);
    $("retryLoadBtn")?.addEventListener("click", refreshRejections);
    $("rejectProductForm")?.addEventListener("submit", handleRejectSubmit);
    $("reject_product")?.addEventListener("change", updateRejectStockDisplay);
    $("reject_reason")?.addEventListener("change", syncRejectReasonOther);
    $("applyRejectionsDateFilterBtn")?.addEventListener("click", applyDateFilter);
    $("clearRejectionsDateFilterBtn")?.addEventListener("click", clearDateFilter);
  };

  document.addEventListener("DOMContentLoaded", () => {
    setupEventListeners();
    loadRejections();
  });

  return {
    loadRejections,
    openRejectModal,
  };
})();

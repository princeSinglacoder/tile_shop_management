/**
 * Expenses Module — TilePro Management
 *
 * Backend endpoints:
 *  GET  /expenses/all
 *  POST /expenses/create  { expense_date, category, amount, description? }
 *
 * After create: patch local expensesList from response — do NOT call /expenses/all.
 */

const Expenses = (() => {
  let expensesList = [];
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

  const isDateFilterActive = () => !!(activeStartDate || activeEndDate);

  const isDateInActiveFilter = (dateStr) => {
    if (!isDateFilterActive()) return true;
    if (!dateStr) return false;
    if (activeStartDate && dateStr < activeStartDate) return false;
    if (activeEndDate && dateStr > activeEndDate) return false;
    return true;
  };

  const buildFilterUrl = (start, end) => {
    const url = new URL(`${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.EXPENSES_FILTER}`);
    if (start) url.searchParams.set("start_date", start);
    if (end) url.searchParams.set("end_date", end);
    return url.toString();
  };

  const fetchExpensesFromUrl = async (requestUrl) => {
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
        expensesList = [];
        UI.showToast("Forbidden", "Only admins can view expenses.", "error");
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
      expensesList = Array.isArray(data) ? data : [];
    } catch (err) {
      console.error("[Expenses] fetchExpenses failed:", err);
      expensesList = [];
      showApiBanner(err.message);
    }

    renderTable();
    updateStats();
  };

  /** Initial load / clear: GET /expenses/all only */
  const loadExpenses = async () => {
    await fetchExpensesFromUrl(`${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.EXPENSES_ALL}`);
  };

  /** Apply Filter: GET /expenses/filter only */
  const applyDateFilter = async () => {
    const start = ($("expensesStartDate")?.value || "").trim() || null;
    const end = ($("expensesEndDate")?.value || "").trim() || null;

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
    await fetchExpensesFromUrl(buildFilterUrl(start, end));
  };

  const clearDateFilter = async () => {
    const startInput = $("expensesStartDate");
    const endInput = $("expensesEndDate");
    if (startInput) startInput.value = "";
    if (endInput) endInput.value = "";
    activeStartDate = null;
    activeEndDate = null;
    await loadExpenses();
  };

  const refreshExpenses = async () => {
    if (isDateFilterActive()) {
      await fetchExpensesFromUrl(buildFilterUrl(activeStartDate, activeEndDate));
    } else {
      await loadExpenses();
    }
  };

  const showLoadingState = () => {
    const tbody = $("expensesTableBody");
    const countEl = $("expensesCount");
    if (countEl) countEl.textContent = "Loading...";
    if (!tbody) return;
    tbody.innerHTML = Array.from({ length: 4 }).map(() => `
      <tr class="skeleton-row">
        <td><div class="skeleton" style="height:18px;width:90px;"></div></td>
        <td><div class="skeleton" style="height:22px;width:90px;border-radius:9999px;"></div></td>
        <td><div class="skeleton" style="height:18px;width:55%;"></div></td>
        <td><div class="skeleton" style="height:18px;width:80px;margin-left:auto;"></div></td>
      </tr>
    `).join("");
  };

  const updateStats = () => {
    const total = expensesList.length;
    const amount = expensesList.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const categories = new Set(
      expensesList.map((e) => (e.category || "").trim().toLowerCase()).filter(Boolean)
    ).size;

    const countEl = $("statTotalCount");
    const amountEl = $("statTotalAmount");
    const catEl = $("statCategories");
    const badgeEl = $("expensesCount");

    if (countEl) countEl.textContent = total;
    if (amountEl) amountEl.textContent = UI.formatCurrency(amount);
    if (catEl) catEl.textContent = categories;
    if (badgeEl) badgeEl.textContent = `${total} record${total !== 1 ? "s" : ""}`;
  };

  const renderTable = () => {
    const tbody = $("expensesTableBody");
    if (!tbody) return;

    if (expensesList.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4">
            <div class="empty-state">
              <div class="empty-icon-wrapper">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <line x1="12" y1="1" x2="12" y2="23"></line>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
              </div>
              <h4 class="empty-title">No Expenses Yet</h4>
              <p class="empty-description">Record electricity, transport, salary, rent, and other shop costs here.</p>
              <button type="button" class="btn btn-primary" id="emptyExpenseBtn">Add Expense</button>
            </div>
          </td>
        </tr>
      `;
      $("emptyExpenseBtn")?.addEventListener("click", openCreateModal);
      return;
    }

    tbody.innerHTML = expensesList.map((e) => `
      <tr data-expense-id="${UI.escapeHTML(e.expense_id || "")}">
        <td>${UI.escapeHTML(formatDate(e.expense_date))}</td>
        <td><span class="badge badge-brand">${UI.escapeHTML(e.category || "—")}</span></td>
        <td>
          <span class="expense-desc">${UI.escapeHTML(e.description || "—")}</span>
        </td>
        <td style="text-align: right;">
          <span class="expense-amount">${UI.formatCurrency(e.amount)}</span>
        </td>
      </tr>
    `).join("");
  };

  const syncCategoryOther = () => {
    const select = $("expense_category");
    const other = $("expense_category_other");
    if (!select || !other) return;
    const isOther = select.value === "Other";
    other.classList.toggle("hidden", !isOther);
    if (!isOther) other.value = "";
  };

  const openCreateModal = () => {
    const form = $("expenseForm");
    if (form) form.reset();

    clearFormErrors([
      "err_expense_date",
      "err_expense_category",
      "err_expense_amount",
      "err_expense_description",
    ]);
    showFormServerError("expenseServerError", "");
    ["expense_date", "expense_category", "expense_amount", "expense_description", "expense_category_other"].forEach((id) => {
      const el = $(id);
      if (el) el.classList.remove("is-invalid");
    });

    const dateInput = $("expense_date");
    if (dateInput) dateInput.value = new Date().toISOString().split("T")[0];

    const other = $("expense_category_other");
    if (other) {
      other.classList.add("hidden");
      other.value = "";
    }

    UI.openModal("createExpenseModal");
  };

  const validateForm = () => {
    const dateVal = ($("expense_date") || {}).value || "";
    const categorySelect = ($("expense_category") || {}).value || "";
    const categoryOther = ($("expense_category_other") || {}).value?.trim() || "";
    const amountRaw = ($("expense_amount") || {}).value;
    const amount = parseFloat(amountRaw);
    const descriptionRaw = ($("expense_description") || {}).value;
    const descriptionTrimmed = (descriptionRaw || "").trim();

    let valid = true;
    clearFormErrors([
      "err_expense_date",
      "err_expense_category",
      "err_expense_amount",
      "err_expense_description",
    ]);

    if (!dateVal) {
      setFieldError("err_expense_date", "Date is required.");
      valid = false;
    }

    let category = "";
    if (!categorySelect) {
      setFieldError("err_expense_category", "Please select a category.");
      valid = false;
    } else if (categorySelect === "Other") {
      if (!categoryOther) {
        setFieldError("err_expense_category", "Please enter a category name.");
        valid = false;
      } else {
        category = categoryOther;
      }
    } else {
      category = categorySelect;
    }

    if (amountRaw === "" || isNaN(amount) || amount <= 0) {
      setFieldError("err_expense_amount", "Amount must be greater than 0.");
      valid = false;
    }

    // If user typed only spaces in description, treat as invalid (backend also rejects)
    if (descriptionRaw != null && descriptionRaw.length > 0 && !descriptionTrimmed) {
      setFieldError("err_expense_description", "Description cannot be blank if entered.");
      valid = false;
    }

    if (!valid) return null;

    const payload = {
      expense_date: dateVal,
      category,
      amount,
    };
    if (descriptionTrimmed) payload.description = descriptionTrimmed;
    return payload;
  };

  /**
   * Prepend created expense from POST response.
   * Does NOT call /expenses/all.
   */
  const applyCreatedExpense = (result) => {
    if (!result || !result.expense_id) return;

    if (!isDateInActiveFilter(result.expense_date)) {
      updateStats();
      return;
    }

    expensesList.unshift({
      expense_id: result.expense_id,
      expense_date: result.expense_date,
      category: result.category,
      amount: result.amount,
      description: result.description || "",
    });

    renderTable();
    updateStats();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    showFormServerError("expenseServerError", "");

    const payload = validateForm();
    if (!payload) return;

    setButtonLoading("expenseSubmitBtn", true);

    try {
      const response = await fetch(
        `${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.EXPENSE_CREATE}`,
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
        showFormServerError("expenseServerError", msg);
        return;
      }

      if (response.status === 401) {
        UI.showToast("Session Expired", "Please log in again.", "error");
        setTimeout(() => { window.location.href = "login.html"; }, 1200);
        return;
      }

      if (response.status === 403) {
        showFormServerError("expenseServerError", result.detail || "Only admins can create expenses.");
        return;
      }

      if (!response.ok) {
        const msg = result.detail || result.message || `Server error (${response.status})`;
        showFormServerError("expenseServerError", typeof msg === "string" ? msg : JSON.stringify(msg));
        return;
      }

      UI.showToast(
        "Expense Saved",
        `${result.category}: ${UI.formatCurrency(result.amount)}`,
        "success"
      );
      UI.closeModal("createExpenseModal");
      applyCreatedExpense(result);
    } catch (err) {
      console.error("[Expenses] handleSubmit error:", err);
      showFormServerError("expenseServerError", "Could not reach the server. Please check your connection.");
    } finally {
      setButtonLoading("expenseSubmitBtn", false);
    }
  };

  const setupEventListeners = () => {
    $("openExpenseModalBtn")?.addEventListener("click", openCreateModal);
    $("refreshExpensesBtn")?.addEventListener("click", refreshExpenses);
    $("retryLoadBtn")?.addEventListener("click", refreshExpenses);
    $("expenseForm")?.addEventListener("submit", handleSubmit);
    $("expense_category")?.addEventListener("change", syncCategoryOther);
    $("applyExpensesDateFilterBtn")?.addEventListener("click", applyDateFilter);
    $("clearExpensesDateFilterBtn")?.addEventListener("click", clearDateFilter);
  };

  document.addEventListener("DOMContentLoaded", () => {
    setupEventListeners();
    loadExpenses();
  });

  return {
    loadExpenses,
    openCreateModal,
  };
})();

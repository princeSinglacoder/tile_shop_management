/**
 * Reports Module — TilePro Management
 *
 * Backend endpoints (ONLY these — never section /all for calculations):
 *  GET /reports/summary
 *  GET /reports/filter?start_date=&end_date=
 */

const Reports = (() => {
  let reportData = null;
  let activeStartDate = null;
  let activeEndDate = null;
  let loading = false;

  const $ = (id) => document.getElementById(id);

  const EMPTY_REPORT = {
    sales: {
      revenue: 0,
      orders: 0,
      quantity_sold: 0,
      cash_received: 0,
      upi_received: 0,
    },
    purchases: { amount: 0, orders: 0, quantity: 0 },
    rejections: { quantity: 0, loss: 0 },
    expenses: { total: 0 },
    profit: { cogs: 0, gross_profit: 0, net_profit: 0 },
    inventory: {
      stock: 0,
      inventory_value: 0,
      total_designs: 0,
      low_stock: 0,
      out_of_stock: 0,
    },
    receivables: { outstanding: 0, refund_pending: 0 },
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

  const setLoadingUI = (isLoading) => {
    loading = isLoading;
    const overlay = $("reportLoadingOverlay");
    if (overlay) overlay.classList.toggle("hidden", !isLoading);
    const applyBtn = $("applyReportsDateFilterBtn");
    const clearBtn = $("clearReportsDateFilterBtn");
    if (applyBtn) applyBtn.disabled = isLoading;
    if (clearBtn) clearBtn.disabled = isLoading;
  };

  const setText = (id, value) => {
    const el = $(id);
    if (el) el.textContent = value;
  };

  const money = (n) => UI.formatCurrency(n ?? 0);

  const qty = (n) => {
    const v = Number(n) || 0;
    return v.toLocaleString("en-IN");
  };

  const updateFilterBadge = () => {
    const badge = $("reportsFilterBadge");
    if (!badge) return;
    if (activeStartDate || activeEndDate) {
      const from = activeStartDate || "…";
      const to = activeEndDate || "…";
      badge.textContent = `Filtered: ${from} → ${to}`;
      badge.classList.remove("badge-neutral");
      badge.classList.add("badge-brand");
    } else {
      badge.textContent = "Overall summary";
      badge.classList.remove("badge-brand");
      badge.classList.add("badge-neutral");
    }
  };

  const renderReport = (data) => {
    const r = data || EMPTY_REPORT;
    const s = r.sales || EMPTY_REPORT.sales;
    const p = r.purchases || EMPTY_REPORT.purchases;
    const rej = r.rejections || EMPTY_REPORT.rejections;
    const e = r.expenses || EMPTY_REPORT.expenses;
    const profit = r.profit || EMPTY_REPORT.profit;
    const inv = r.inventory || EMPTY_REPORT.inventory;
    const recv = r.receivables || EMPTY_REPORT.receivables;

    setText("statRevenue", money(s.revenue));
    setText("statOrders", qty(s.orders));
    setText("statQtySold", qty(s.quantity_sold));
    setText("statCash", money(s.cash_received));
    setText("statUpi", money(s.upi_received));

    setText("statPurchaseAmount", money(p.amount));
    setText("statPurchaseOrders", qty(p.orders));
    setText("statPurchaseQty", qty(p.quantity));

    setText("statRejectedQty", qty(rej.quantity));
    setText("statRejectionLoss", money(rej.loss));

    setText("statExpensesTotal", money(e.total));

    setText("statCogs", money(profit.cogs));
    setText("statGrossProfit", money(profit.gross_profit));
    setText("statNetProfit", money(profit.net_profit));

    const netEl = $("statNetProfit");
    if (netEl) {
      netEl.classList.remove("profit-positive", "profit-negative");
      const net = Number(profit.net_profit) || 0;
      if (net > 0) netEl.classList.add("profit-positive");
      else if (net < 0) netEl.classList.add("profit-negative");
    }

    setText("statTotalStock", qty(inv.stock));
    setText("statInventoryValue", money(inv.inventory_value));
    setText("statTotalDesigns", qty(inv.total_designs));
    setText("statLowStock", qty(inv.low_stock));
    setText("statOutOfStock", qty(inv.out_of_stock));

    setText("statOutstanding", money(recv.outstanding));
    setText("statRefundPending", money(recv.refund_pending));

    updateFilterBadge();
  };

  const clearReportDisplay = () => {
    const placeholders = [
      "statRevenue", "statOrders", "statQtySold", "statCash", "statUpi",
      "statPurchaseAmount", "statPurchaseOrders", "statPurchaseQty",
      "statRejectedQty", "statRejectionLoss", "statExpensesTotal",
      "statCogs", "statGrossProfit", "statNetProfit",
      "statTotalStock", "statInventoryValue", "statTotalDesigns",
      "statLowStock", "statOutOfStock",
      "statOutstanding", "statRefundPending",
    ];
    placeholders.forEach((id) => setText(id, "—"));
    const netEl = $("statNetProfit");
    if (netEl) netEl.classList.remove("profit-positive", "profit-negative");
  };

  const buildFilterUrl = (start, end) => {
    const url = new URL(`${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.REPORTS_FILTER}`);
    if (start) url.searchParams.set("start_date", start);
    if (end) url.searchParams.set("end_date", end);
    return url.toString();
  };

  const fetchReportFromUrl = async (requestUrl) => {
    hideApiBanner();
    setLoadingUI(true);
    clearReportDisplay();

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
        reportData = null;
        UI.showToast("Forbidden", "Only admins can view reports.", "error");
        renderReport(EMPTY_REPORT);
        return;
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const detail = errData.detail || `Server error: ${response.status}`;
        throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
      }

      const data = await response.json();
      reportData = data && typeof data === "object" ? data : EMPTY_REPORT;
      renderReport(reportData);
    } catch (err) {
      console.error("[Reports] fetch failed:", err);
      reportData = null;
      showApiBanner(err.message);
      renderReport(EMPTY_REPORT);
    } finally {
      setLoadingUI(false);
    }
  };

  /** Initial load / clear: GET /reports/summary only */
  const loadSummary = async () => {
    activeStartDate = null;
    activeEndDate = null;
    await fetchReportFromUrl(
      `${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.REPORTS_SUMMARY}`
    );
  };

  /** Apply Filter: GET /reports/filter only */
  const applyDateFilter = async () => {
    const start = ($("reportsStartDate")?.value || "").trim() || null;
    const end = ($("reportsEndDate")?.value || "").trim() || null;

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
    await fetchReportFromUrl(buildFilterUrl(start, end));
  };

  /** Clear Filter: GET /reports/summary only */
  const clearDateFilter = async () => {
    const startEl = $("reportsStartDate");
    const endEl = $("reportsEndDate");
    if (startEl) startEl.value = "";
    if (endEl) endEl.value = "";
    await loadSummary();
  };

  const init = () => {
    $("applyReportsDateFilterBtn")?.addEventListener("click", applyDateFilter);
    $("clearReportsDateFilterBtn")?.addEventListener("click", clearDateFilter);
    $("retryLoadBtn")?.addEventListener("click", () => {
      if (activeStartDate || activeEndDate) {
        fetchReportFromUrl(buildFilterUrl(activeStartDate, activeEndDate));
      } else {
        loadSummary();
      }
    });

    loadSummary();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  return {
    loadSummary,
    applyDateFilter,
    clearDateFilter,
  };
})();

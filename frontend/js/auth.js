/**
 * auth.js — Shared Authentication Module
 * Tile Shop Management System
 *
 * Rules:
 *  - Login submits to POST /user/login using fetch() with credentials: "include"
 *  - The HttpOnly cookie "access_token" is set by the backend automatically
 *  - We never read or store the JWT in JavaScript
 *  - We never put the token in localStorage or sessionStorage
 *  - Protected pages call requireAuth() on load which probes GET /user/me
 *    and redirects to login.html on 401
 *  - The login page calls checkIfAlreadyLoggedIn() to skip the form when a
 *    valid session cookie already exists
 */

const Auth = (() => {

  let currentUser = null;
  let authPromise = null;

  /* ---------------------------------------------------------------
     Helpers
  --------------------------------------------------------------- */

  const getPageFile = () => {
    const path = window.location.pathname;
    return (path.split("/").pop() || "").toLowerCase();
  };

  /**
   * Silently probe the backend to see if the current session cookie is valid.
   * Uses GET /user/me — which validates the HttpOnly JWT cookie and returns user_id & user_role.
   * Returns authenticated user object or null.
   * NEVER redirects by itself — callers decide what to do.
   */
  const probe = async () => {
    try {
      const res = await fetch(
        `${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.ME}`,
        {
          method: "GET",
          headers: { "Accept": "application/json" },
          credentials: "include",   // sends the HttpOnly access_token cookie
        }
      );

      if (res.ok && res.status !== 401) {
        const data = await res.json().catch(() => null);
        if (data && data.user_id) {
          currentUser = {
            user_id: data.user_id,
            user_role: (data.user_role || "staff").trim().toLowerCase(),
          };
          return currentUser;
        }
      }

      currentUser = null;
      return null;
    } catch {
      // Network error — backend is down; treat as unauthenticated
      currentUser = null;
      return null;
    }
  };

  /**
   * Returns the cached user object or probes /user/me if not yet cached.
   * Deduplicates concurrent in-flight requests.
   */
  const getUser = async () => {
    if (currentUser) return currentUser;
    if (!authPromise) {
      authPromise = probe().finally(() => {
        authPromise = null;
      });
    }
    return await authPromise;
  };

  const getRole = () => (currentUser ? currentUser.user_role : null);
  const isAdmin = () => (currentUser ? currentUser.user_role === "admin" : false);
  const isStaff = () => (currentUser ? currentUser.user_role === "staff" : false);

  /**
   * Adjust shared UI elements (sidebar name, badge, and navigation links)
   * according to the authenticated user's role.
   */
  const applyRoleUI = () => {
    if (!currentUser) return;

    const page = getPageFile();
    const isUserStaff = currentUser.user_role === "staff";

    // Set body role classes for CSS selectors
    document.body.classList.toggle("role-staff", isUserStaff);
    document.body.classList.toggle("role-admin", !isUserStaff);

    // Update avatar and username/badge in sidebar
    const avatars = document.querySelectorAll(".user-avatar");
    avatars.forEach((el) => {
      el.textContent = isUserStaff ? "S" : "A";
    });

    const userNames = document.querySelectorAll(".user-name");
    userNames.forEach((el) => {
      el.textContent = isUserStaff ? "Store Staff" : "Administrator";
    });

    const roleBadges = document.querySelectorAll(".user-role-badge");
    roleBadges.forEach((el) => {
      el.textContent = isUserStaff ? "Staff" : "Admin";
    });

    // Hide admin-only links (Products, Purchases & Reports) for Staff
    const restrictedLinks = document.querySelectorAll(
      'a[href*="products.html"], a[href*="purchases.html"], a[href*="reports.html"]'
    );
    restrictedLinks.forEach((link) => {
      const parentLi = link.closest(".sidebar li");
      if (parentLi) {
        parentLi.style.display = isUserStaff ? "none" : "";
      } else {
        link.style.display = isUserStaff ? "none" : "";
      }
    });

    // Hide "Insights" category header if Reports is hidden
    const categoryHeaders = document.querySelectorAll(".sidebar .menu-category");
    categoryHeaders.forEach((header) => {
      if ((header.textContent || "").trim().toLowerCase().includes("insights")) {
        header.style.display = isUserStaff ? "none" : "";
      }
    });

    // Date-filter controls: hide on Sales, Rejections, Expenses for Staff; visible for Admin
    const dateFilters = document.querySelectorAll(".date-range-filter");
    dateFilters.forEach((df) => {
      df.style.display = isUserStaff ? "none" : "";
    });

    // Top summary cards: hide on Sales, Rejections, Expenses for Staff; visible for Admin
    const summaryCardGrids = document.querySelectorAll(
      '.summary-cards-grid, #salesStatsGrid, #rejectionsStatsGrid, #expensesStatsGrid'
    );
    summaryCardGrids.forEach((el) => {
      el.style.display = isUserStaff ? "none" : "";
    });

    // Hide Vendor Purchases and Product shortcuts on Dashboard for Staff
    const restrictedDashboardLinks = document.querySelectorAll(
      '.quick-action-list a[href*="purchases.html"], .quick-action-list a[href*="products.html"], header a[href*="products.html"], .dashboard-hero a[href*="products.html"], .table-card .card-header a[href*="products.html"]'
    );
    restrictedDashboardLinks.forEach((sc) => {
      sc.style.display = isUserStaff ? "none" : "";
    });

    // Route guard: Redirect Staff from Admin-only pages to dashboard
    if (isUserStaff && (page === "purchases.html" || page === "reports.html" || page === "products.html")) {
      window.location.replace("dashboard.html");
      return;
    }
  };

  /* ---------------------------------------------------------------
     Login
  --------------------------------------------------------------- */

  /**
   * Submit credentials to POST /user/login.
   * On success the backend sets the HttpOnly "access_token" cookie.
   * We do NOT read or store the token — the browser handles it.
   *
   * @param {string} email
   * @param {string} password
   * @throws {Error} if login fails or network is unreachable
   */
  const login = async (email, password) => {
    let res;
    try {
      res = await fetch(
        `${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.LOGIN}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          credentials: "include",   // required so browser stores the HttpOnly cookie
          body: JSON.stringify({ email: email.trim(), password }),
        }
      );
    } catch (networkErr) {
      throw new Error(
        `Cannot reach the backend at ${CONFIG.API_BASE_URL}. ` +
        `Make sure uvicorn is running: uvicorn app.main:app --reload`
      );
    }

    let data = null;
    try { data = await res.json(); } catch { /* empty body */ }

    if (!res.ok || res.status === 401) {
      // 401 comes with {"message": "Invalid email or password"}
      const msg =
        (data && (data.message || data.detail)) ||
        "Invalid email or password";
      throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    }

    // Success: Clear any cached user so next check fetches freshly
    currentUser = null;
    return data;
  };

  /* ---------------------------------------------------------------
     Route guards
  --------------------------------------------------------------- */

  /**
   * Call this at the top of every protected page (dashboard, products, sales…).
   * If the backend returns 401, immediately redirect to login.html.
   */
  const requireAuth = async () => {
    const user = await getUser();
    if (!user) {
      window.location.replace("login.html");
      return null;
    }
    applyRoleUI();
    return user;
  };

  /**
   * Call this on login.html only.
   * If the user already has a valid session, skip the form and go to dashboard.
   */
  const checkIfAlreadyLoggedIn = async () => {
    const user = await getUser();
    if (user) {
      window.location.replace("dashboard.html");
    }
  };

  /* ---------------------------------------------------------------
     Logout
  --------------------------------------------------------------- */

  /**
   * Clear the session cookie via backend POST /user/logout and redirect to login.html.
   */
  const logout = async () => {
    currentUser = null;
    try {
      await fetch(`${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.LOGOUT}`, {
        method: "POST",
        credentials: "include", // sends the HttpOnly cookie so backend can clear it
      });
    } catch {
      // Proceed to login redirect even if network drops
    }
    window.location.replace("login.html");
  };

  /* ---------------------------------------------------------------
     Sidebar logout button wiring (shared across all dashboard pages)
  --------------------------------------------------------------- */

  const wireLogoutButtons = () => {
    const btns = document.querySelectorAll(".btn-logout, #logoutBtn");
    btns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        if (typeof UI !== "undefined" && UI.showConfirm) {
          UI.showConfirm({
            title: "Sign Out",
            message: "Are you sure you want to end your session?",
            confirmText: "Sign Out",
            cancelText: "Stay",
            onConfirm: logout,
          });
        } else {
          logout();
        }
      });
    });
  };

  /* ---------------------------------------------------------------
     Auto-init based on which page we are on
  --------------------------------------------------------------- */

  const init = async () => {
    const page = getPageFile();

    if (page === "login.html") {
      // Non-blocking — page renders immediately; redirect happens if already authed
      checkIfAlreadyLoggedIn();
    } else if (page !== "index.html" && page !== "") {
      // Every other page is protected
      await requireAuth();
      wireLogoutButtons();
    }
  };

  // Run after DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  /* ---------------------------------------------------------------
     Public API
  --------------------------------------------------------------- */

  return {
    login,
    requireAuth,
    checkIfAlreadyLoggedIn,
    logout,
    getUser,
    getRole,
    isAdmin,
    isStaff,
    applyRoleUI,
  };

})();

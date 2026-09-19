/**
 * auth.js — Shared Authentication Module
 * Tile Shop Management System
 *
 * Rules:
 *  - Login submits to POST /user/login using fetch() with credentials: "include"
 *  - The HttpOnly cookie "access_token" is set by the backend automatically
 *  - We never read or store the JWT in JavaScript
 *  - We never put the token in localStorage or sessionStorage
 *  - Protected pages call verifyAuth() on load which probes GET /product/all
 *    (the only existing authenticated endpoint) and redirects to login.html on 401
 *  - The login page calls checkIfAlreadyLoggedIn() to skip the form when a
 *    valid session cookie already exists
 */

const Auth = (() => {

  /* ---------------------------------------------------------------
     Helpers
  --------------------------------------------------------------- */

  const getPageFile = () => {
    const path = window.location.pathname;
    return (path.split("/").pop() || "").toLowerCase();
  };

  /**
   * Silently probe the backend to see if the current session cookie is valid.
   * Uses GET /user/me — which validates the HttpOnly JWT cookie.
   * Returns true if authenticated, false otherwise.
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
      return res.ok && res.status !== 401;
    } catch {
      // Network error — backend is down; treat as unauthenticated
      return false;
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

    // Success: HttpOnly cookie is now in the browser's cookie jar
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
    const ok = await probe();
    if (!ok) {
      window.location.replace("login.html");
    }
  };

  /**
   * Call this on login.html only.
   * If the user already has a valid session, skip the form and go to dashboard.
   */
  const checkIfAlreadyLoggedIn = async () => {
    const ok = await probe();
    if (ok) {
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

  const init = () => {
    const page = getPageFile();

    if (page === "login.html") {
      // Non-blocking — page renders immediately; redirect happens if already authed
      checkIfAlreadyLoggedIn();
    } else if (page !== "index.html" && page !== "") {
      // Every other page is protected
      requireAuth();
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

  return { login, requireAuth, checkIfAlreadyLoggedIn, logout };

})();

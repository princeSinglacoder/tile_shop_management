/**
 * UI Utilities: Toasts, Modals, Confirmation Dialogs, Sidebar Toggle
 */

const UI = (() => {
  let toastContainer = null;

  // Initialize Toast Container
  const ensureToastContainer = () => {
    if (!toastContainer) {
      toastContainer = document.querySelector(".toast-container");
      if (!toastContainer) {
        toastContainer = document.createElement("div");
        toastContainer.className = "toast-container";
        document.body.appendChild(toastContainer);
      }
    }
    return toastContainer;
  };

  /**
   * Display a floating Toast notification
   * @param {string} title
   * @param {string} message
   * @param {'success'|'error'|'warning'|'info'} type
   * @param {number} duration
   */
  const showToast = (title, message, type = "success", duration = 4000) => {
    const container = ensureToastContainer();

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    let iconSvg = "";
    if (type === "success") {
      iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else if (type === "error") {
      iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
    } else if (type === "warning") {
      iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
    } else {
      iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }

    toast.innerHTML = `
      <div class="toast-icon">${iconSvg}</div>
      <div class="toast-content">
        <div class="toast-title">${escapeHTML(title)}</div>
        ${message ? `<div class="toast-message">${escapeHTML(message)}</div>` : ""}
      </div>
      <button class="toast-close" type="button" aria-label="Close notification">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    `;

    container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add("show");
    });

    const removeToast = () => {
      toast.classList.remove("show");
      setTimeout(() => {
        if (toast.parentElement) {
          toast.parentElement.removeChild(toast);
        }
      }, 300);
    };

    const closeBtn = toast.querySelector(".toast-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", removeToast);
    }

    if (duration > 0) {
      setTimeout(removeToast, duration);
    }
  };

  /**
   * Open Modal by Element ID
   */
  const openModal = (modalId) => {
    const backdrop = document.getElementById(modalId);
    if (backdrop) {
      backdrop.classList.add("active");
      document.body.style.overflow = "hidden";

      // Focus first input if available
      const firstInput = backdrop.querySelector("input:not([type=hidden]), select, textarea");
      if (firstInput) {
        setTimeout(() => firstInput.focus(), 100);
      }
    }
  };

  /**
   * Close Modal by Element ID
   */
  const closeModal = (modalId) => {
    const backdrop = document.getElementById(modalId);
    if (backdrop) {
      backdrop.classList.remove("active");
      document.body.style.overflow = "";
    }
  };

  /**
   * Confirmation Dialog Modal
   * @param {object} options
   * @param {string}   options.title
   * @param {string}   options.message
   * @param {string}   options.confirmText
   * @param {string}   options.cancelText
   * @param {Function} options.onConfirm  — can be async; button shows loading state
   * @param {Function} options.onCancel
   */
  const showConfirm = ({
    title = "Are you sure?",
    message = "This action cannot be undone.",
    confirmText = "Delete",
    cancelText = "Cancel",
    onConfirm = () => {},
    onCancel = () => {}
  }) => {
    let confirmBackdrop = document.getElementById("confirmModal");
    if (!confirmBackdrop) {
      confirmBackdrop = document.createElement("div");
      confirmBackdrop.id = "confirmModal";
      confirmBackdrop.className = "modal-backdrop";
      confirmBackdrop.innerHTML = `
        <div class="modal" style="max-width: 440px;">
          <div class="modal-body confirm-box">
            <div class="confirm-icon-wrapper">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </div>
            <h3 class="confirm-title" id="confirmTitle"></h3>
            <p class="confirm-message" id="confirmMessage"></p>
            <div style="display: flex; gap: var(--space-3); justify-content: center; margin-top: var(--space-2);">
              <button type="button" class="btn btn-secondary" id="confirmCancelBtn" style="flex: 1; min-width: 110px;"></button>
              <button type="button" class="btn btn-danger" id="confirmOkBtn" style="flex: 1; min-width: 110px;"></button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(confirmBackdrop);
    }

    const titleEl    = document.getElementById("confirmTitle");
    const msgEl      = document.getElementById("confirmMessage");
    const okBtn      = document.getElementById("confirmOkBtn");
    const cancelBtn  = document.getElementById("confirmCancelBtn");

    titleEl.textContent  = title;
    msgEl.textContent    = message;
    okBtn.textContent    = confirmText;
    cancelBtn.textContent = cancelText;

    // Reset state
    okBtn.disabled    = false;
    cancelBtn.disabled = false;

    const cleanup = () => {
      closeModal("confirmModal");
      okBtn.onclick    = null;
      cancelBtn.onclick = null;
      // Reset button state
      okBtn.disabled     = false;
      cancelBtn.disabled = false;
      okBtn.textContent  = confirmText;
    };

    okBtn.onclick = async () => {
      // Show loading state on confirm button
      okBtn.disabled     = true;
      cancelBtn.disabled = true;
      okBtn.innerHTML = `
        <span style="display:inline-flex;align-items:center;gap:8px;">
          <span style="width:14px;height:14px;border:2px solid rgba(255,255,255,0.35);border-radius:50%;border-top-color:#fff;animation:spin 0.7s linear infinite;display:inline-block;"></span>
          Processing...
        </span>
      `;

      try {
        await onConfirm();
      } catch (err) {
        console.error("[Confirm] onConfirm threw:", err);
      } finally {
        cleanup();
      }
    };

    cancelBtn.onclick = () => {
      cleanup();
      onCancel();
    };

    openModal("confirmModal");
  };

  /**
   * Escape HTML to prevent XSS
   */
  const escapeHTML = (str) => {
    if (!str && str !== 0) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  /**
   * Format Currency (e.g. ₹ 1,200.00 or $ 1,200.00)
   */
  const formatCurrency = (val) => {
    const num = parseFloat(val);
    if (isNaN(num)) return "0.00";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2
    }).format(num);
  };

  /**
   * Setup Modal listeners for dismiss buttons and backdrop clicks
   */
  const setupModalListeners = () => {
    document.addEventListener("click", (e) => {
      // Close button with data-modal-close
      const closeTarget = e.target.closest("[data-modal-close]");
      if (closeTarget) {
        const modal = closeTarget.closest(".modal-backdrop");
        if (modal) {
          closeModal(modal.id);
        }
      }

      // Clicking directly on the backdrop (outside dialog)
      if (e.target.classList.contains("modal-backdrop")) {
        closeModal(e.target.id);
      }
    });

    // Close on Escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const activeModal = document.querySelector(".modal-backdrop.active");
        if (activeModal) {
          closeModal(activeModal.id);
        }
      }
    });
  };

  /**
   * Setup Responsive Sidebar and Mobile Toggle
   */
  const setupSidebar = () => {
    const toggleBtn = document.querySelector(".btn-toggle-sidebar");
    const sidebar = document.querySelector(".sidebar");
    let backdrop = document.querySelector(".sidebar-backdrop");

    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.className = "sidebar-backdrop";
      document.body.appendChild(backdrop);
    }

    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener("click", () => {
        sidebar.classList.toggle("open");
        backdrop.classList.toggle("active");
      });

      backdrop.addEventListener("click", () => {
        sidebar.classList.remove("open");
        backdrop.classList.remove("active");
      });
    }

    // Highlight current active link based on current filename
    const currentPage = window.location.pathname.split("/").pop() || "dashboard.html";
    const navLinks = document.querySelectorAll(".sidebar .nav-link");
    navLinks.forEach((link) => {
      // Remove any hardcoded active class first
      const href = link.getAttribute("href") || "";
      const linkPage = href.split("/").pop();
      if (linkPage === currentPage) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });
  };

  // Initialize common UI behaviors on DOM load
  document.addEventListener("DOMContentLoaded", () => {
    setupModalListeners();
    setupSidebar();
  });

  return {
    showToast,
    openModal,
    closeModal,
    showConfirm,
    escapeHTML,
    formatCurrency,
  };
})();

// App level state management, auth sessions, translations, notifications
const App = {
  // Get active language or default to English
  getLanguage() {
    return localStorage.getItem("agrilinker_lang") || "en";
  },

  // Set active language
  setLanguage(lang) {
    localStorage.setItem("agrilinker_lang", lang);
    document.documentElement.lang = lang;
    document.body.setAttribute("lang", lang);
    this.translatePage();
  },

  // Translate all DOM elements with data-translate attribute
  translatePage() {
    const lang = this.getLanguage();
    const langDict = translations[lang] || translations.en;

    document.querySelectorAll("[data-translate]").forEach(elem => {
      const key = elem.getAttribute("data-translate");
      if (langDict[key]) {
        if (elem.tagName === "INPUT" && (elem.type === "text" || elem.type === "search" || elem.type === "password" || elem.type === "email")) {
          elem.placeholder = langDict[key];
        } else {
          elem.textContent = langDict[key];
        }
      }
    });
  },

  // Get active session user
  getCurrentUser() {
    const userStr = localStorage.getItem("agrilinker_current_user");
    return userStr ? JSON.parse(userStr) : null;
  },

  // Save/Update user in active session & database
  saveCurrentUser(user) {
    localStorage.setItem("agrilinker_current_user", JSON.stringify(user));
    
    // Update in list of all users
    const users = JSON.parse(localStorage.getItem("agrilinker_users") || "[]");
    const index = users.findIndex(u => u.id === user.id);
    if (index !== -1) {
      users[index] = user;
      localStorage.setItem("agrilinker_users", JSON.stringify(users));
    }
  },

  // Toast notifications creator
  showToast(message, type = "success") {
    let container = document.querySelector(".toast-container");
    if (!container) {
      container = document.createElement("div");
      container.className = "toast-container";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast ${type === "error" ? "error" : ""}`;
    
    const icon = document.createElement("i");
    icon.className = type === "error" ? "ri-error-warning-line" : "ri-checkbox-circle-line";
    
    const text = document.createElement("span");
    text.textContent = message;

    toast.appendChild(icon);
    toast.appendChild(text);
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = "slideIn 0.3s reverse forwards";
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  // Route security check based on roles
  checkAuthAndRedirect(allowedRoles = []) {
    const user = this.getCurrentUser();
    const currentPath = window.location.pathname;

    if (!user) {
      // Not logged in, if we are not on index or auth, redirect to auth.html
      if (!currentPath.includes("index.html") && !currentPath.includes("auth.html") && currentPath !== "/") {
        window.location.href = "auth.html";
      }
      return;
    }

    // If logged in and on auth.html, redirect to appropriate dashboard
    if (currentPath.includes("auth.html")) {
      this.redirectToDashboard(user.role);
      return;
    }

    // Check if role is allowed on this page
    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      this.showToast("Unauthorized access, redirecting...", "error");
      setTimeout(() => this.redirectToDashboard(user.role), 1500);
    }
  },

  redirectToDashboard(role) {
    if (role === "farmer") {
      window.location.href = "farmer-dashboard.html";
    } else if (role === "customer") {
      window.location.href = "customer-dashboard.html";
    } else if (role === "delivery") {
      window.location.href = "delivery-dashboard.html";
    } else {
      // Role not selected yet, redirect to auth role selection
      window.location.href = "auth.html?select_role=true";
    }
  },

  logout() {
    localStorage.removeItem("agrilinker_current_user");
    this.showToast("Logged out successfully");
    setTimeout(() => {
      window.location.href = "index.html";
    }, 1000);
  },

  // Setup navbar dynamically based on auth state
  setupNavbar() {
    const user = this.getCurrentUser();
    const nav = document.getElementById("main-nav");
    if (!nav) return;

    let navHtml = `
      <a href="index.html" data-translate="home">Home</a>
    `;

    if (user) {
      if (user.role === "customer") {
        navHtml += `<a href="marketplace.html" data-translate="marketplace">Marketplace</a>`;
      }
      navHtml += `<a href="#" id="nav-dashboard" data-translate="dashboard">Dashboard</a>`;
      navHtml += `<a href="messages.html" data-translate="messages">Messages</a>`;
      navHtml += `<a href="profile.html" data-translate="profile">Profile</a>`;
      navHtml += `<a href="#" id="logout-btn" data-translate="logout">Logout</a>`;
    } else {
      navHtml += `
        <a href="auth.html" class="btn btn-secondary" data-translate="login">Login</a>
      `;
    }

    nav.innerHTML = navHtml;

    // Attach listeners
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.logout();
      });
    }

    const dashboardLink = document.getElementById("nav-dashboard");
    if (dashboardLink) {
      dashboardLink.addEventListener("click", (e) => {
        e.preventDefault();
        this.redirectToDashboard(user.role);
      });
    }

    // Set active link visually
    const currentPath = window.location.pathname;
    nav.querySelectorAll("a").forEach(a => {
      const href = a.getAttribute("href");
      if (href && currentPath.includes(href) && href !== "#") {
        a.classList.add("active");
      }
    });

    // Translate navbar items
    this.translatePage();
  },

  // Init method to bind selector and run initial setups
  init() {
    this.setupNavbar();

    // Set page language on start
    const currentLang = this.getLanguage();
    document.documentElement.lang = currentLang;
    document.body.setAttribute("lang", currentLang);
    this.translatePage();

    // Bind language selector if present
    const langSelect = document.getElementById("lang-select");
    if (langSelect) {
      langSelect.value = currentLang;
      langSelect.addEventListener("change", (e) => {
        this.setLanguage(e.target.value);
      });
    }
  }
};

// Auto initialize on load
document.addEventListener("DOMContentLoaded", () => {
  App.init();
});

// ============================================================
// AgriLinker — App-Level State, Auth Session & Translations
// Backed by Supabase Auth — replaces localStorage session
// ============================================================

const App = {
  // ── Language ────────────────────────────────────────────────
  getLanguage() {
    return localStorage.getItem("agrilinker_lang") || "en";
  },

  setLanguage(lang) {
    localStorage.setItem("agrilinker_lang", lang);
    document.documentElement.lang = lang;
    document.body.setAttribute("lang", lang);
    this.translatePage();
  },

  translatePage() {
    const lang     = this.getLanguage();
    const langDict = translations[lang] || translations.en;
    document.querySelectorAll("[data-translate]").forEach(elem => {
      const key = elem.getAttribute("data-translate");
      if (langDict[key]) {
        if (elem.tagName === "INPUT" && ["text","search","password","email"].includes(elem.type)) {
          elem.placeholder = langDict[key];
        } else {
          elem.textContent = langDict[key];
        }
      }
    });
  },

  // ── Session (Supabase) ───────────────────────────────────────
  // Cached profile fetched after auth; resets on sign-out
  _currentProfile: null,

  // Fetch the authenticated user's profile from Supabase
  async fetchCurrentUser() {
    const { data: { user }, error } = await supabaseClient.auth.getUser();
    if (error || !user) { this._currentProfile = null; return null; }

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    this._currentProfile = profile ? { ...user, ...profile } : { ...user, role: null };
    return this._currentProfile;
  },

  // Synchronous getter — returns cached profile (set by fetchCurrentUser)
  getCurrentUser() {
    return this._currentProfile;
  },

  // Update profile fields in Supabase + refresh cache
  async saveCurrentUser(updates) {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    await supabaseClient.from("profiles").update(updates).eq("id", user.id);
    // Refresh cache
    await this.fetchCurrentUser();
  },

  // ── Toast Notifications ─────────────────────────────────────
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

  // ── Route Guards ─────────────────────────────────────────────
  async checkAuthAndRedirect(allowedRoles = []) {
    const user = await this.fetchCurrentUser();
    const currentPath = window.location.pathname;

    if (!user) {
      if (!currentPath.includes("index.html") &&
          !currentPath.includes("auth.html") &&
          currentPath !== "/") {
        window.location.href = "auth.html";
      }
      return;
    }

    if (currentPath.includes("auth.html")) {
      this.redirectToDashboard(user.role);
      return;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      this.showToast("Unauthorized access, redirecting...", "error");
      setTimeout(() => this.redirectToDashboard(user.role), 1500);
    }
  },

  redirectToDashboard(role) {
    if (role === "farmer")        window.location.href = "farmer-dashboard.html";
    else if (role === "customer") window.location.href = "customer-dashboard.html";
    else if (role === "delivery") window.location.href = "delivery-dashboard.html";
    else                          window.location.href = "auth.html?select_role=true";
  },

  async logout() {
    await supabaseClient.auth.signOut();
    this._currentProfile = null;
    this.showToast("Logged out successfully");
    setTimeout(() => { window.location.href = "index.html"; }, 1000);
  },

  // ── Navbar ───────────────────────────────────────────────────
  setupNavbar(user) {
    const nav = document.getElementById("main-nav");
    if (!nav) return;

    let navHtml = `<a href="index.html" data-translate="home">Home</a>`;

    if (user) {
      if (user.role === "customer") {
        navHtml += `<a href="marketplace.html" data-translate="marketplace">Marketplace</a>`;
      }
      navHtml += `<a href="#" id="nav-dashboard" data-translate="dashboard">Dashboard</a>`;
      navHtml += `<a href="messages.html" data-translate="messages">Messages</a>`;
      navHtml += `<a href="profile.html" data-translate="profile">Profile</a>`;
      navHtml += `<a href="#" id="logout-btn" data-translate="logout">Logout</a>`;
    } else {
      navHtml += `<a href="auth.html" class="btn btn-secondary" data-translate="login">Login</a>`;
    }

    nav.innerHTML = navHtml;

    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", (e) => { e.preventDefault(); this.logout(); });
    }

    const dashboardLink = document.getElementById("nav-dashboard");
    if (dashboardLink && user) {
      dashboardLink.addEventListener("click", (e) => { e.preventDefault(); this.redirectToDashboard(user.role); });
    }

    const currentPath = window.location.pathname;
    nav.querySelectorAll("a").forEach(a => {
      const href = a.getAttribute("href");
      if (href && currentPath.includes(href) && href !== "#") a.classList.add("active");
    });

    this.translatePage();
  },

  // ── Init ─────────────────────────────────────────────────────
  async init() {
    // Set language
    const currentLang = this.getLanguage();
    document.documentElement.lang = currentLang;
    document.body.setAttribute("lang", currentLang);
    this.translatePage();

    // Bind language selector
    const langSelect = document.getElementById("lang-select");
    if (langSelect) {
      langSelect.value = currentLang;
      langSelect.addEventListener("change", (e) => this.setLanguage(e.target.value));
    }

    // Fetch session & build navbar
    const user = await this.fetchCurrentUser();
    this.setupNavbar(user);

    // Listen for auth state changes (login/logout/token refresh)
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        this._currentProfile = null;
        this.setupNavbar(null);
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        await this.fetchCurrentUser();
        this.setupNavbar(this._currentProfile);
      } else if (event === "PASSWORD_RECOVERY") {
        // Supabase sends this event when user clicks reset link
        // Redirect to the reset password form on auth.html
        const currentPath = window.location.pathname;
        if (!currentPath.includes("auth.html")) {
          window.location.href = "auth.html#reset";
        }
      }
    });
  }
};

document.addEventListener("DOMContentLoaded", () => { App.init(); });

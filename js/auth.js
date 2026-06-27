// ============================================================
// AgriLinker — Authentication Controller (Supabase-backed)
// Handles: email/password, Google OAuth, role modal, password reset
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  // ── DOM Elements ─────────────────────────────────────────────
  const tabLogin    = document.getElementById("tab-login");
  const tabRegister = document.getElementById("tab-register");
  const loginForm   = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");

  const roleModal      = document.getElementById("role-overlay") || document.getElementById("role-modal");
  const roleCards      = document.querySelectorAll(".role-card");
  const roleExtraFields = document.getElementById("role-extra-fields");
  const mapGroup       = document.getElementById("map-selection-group");
  const addressGroup   = document.getElementById("address-field-group");
  const coordsIndicator = document.getElementById("coords-indicator");
  const modalCancelBtn  = document.getElementById("modal-cancel-btn");
  const modalConfirmBtn = document.getElementById("modal-confirm-btn");

  // Password reset elements
  const forgotPasswordLink = document.getElementById("forgot-password-link");
  const forgotBackToLogin  = document.getElementById("forgot-back-to-login");
  const forgotPasswordForm = document.getElementById("forgot-password-form");
  const resetPasswordForm  = document.getElementById("reset-password-form");
  const resetPasswordInput = document.getElementById("reset-password");
  const resetConfirmInput  = document.getElementById("reset-confirm-password");
  const resetSubmitBtn     = document.getElementById("reset-submit-btn");

  // Strength bars
  const strengthBars  = [1,2,3,4].map(n => document.getElementById(`strength-bar-${n}`));
  const strengthLabel = document.getElementById("strength-label");

  let selectedRole   = "";
  let mapInstance    = null;
  let selectedMarker = null;
  let selectedCoords = null;
  let pendingUserId  = null; // Supabase user.id awaiting role setup

  // ── View Helper ──────────────────────────────────────────────
  function showOnlyForm(formEl) {
    [loginForm, registerForm, forgotPasswordForm, resetPasswordForm].forEach(f => {
      if (f) f.style.display = "none";
    });
    const gsiBtn   = document.getElementById("google-signin-btn");
    const divider  = document.querySelector(".divider");
    const authTabs = document.querySelector(".auth-tabs");
    const isCoreAuth = (formEl === loginForm || formEl === registerForm);
    if (gsiBtn)   gsiBtn.style.display   = isCoreAuth ? "flex"  : "none";
    if (divider)  divider.style.display  = isCoreAuth ? "flex"  : "none";
    if (authTabs) authTabs.style.display = isCoreAuth ? "flex"  : "none";
    if (formEl)   formEl.style.display   = "block";
  }

  // ── Tab Toggles ──────────────────────────────────────────────
  tabLogin.addEventListener("click", () => {
    tabLogin.classList.add("active");
    tabRegister.classList.remove("active");
    showOnlyForm(loginForm);
  });

  tabRegister.addEventListener("click", () => {
    tabRegister.classList.add("active");
    tabLogin.classList.remove("active");
    showOnlyForm(registerForm);
  });

  // ── REGISTER (email/password) ────────────────────────────────
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name     = document.getElementById("register-name").value.trim();
    const email    = document.getElementById("register-email").value.trim();
    const password = document.getElementById("register-password").value;

    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if (error) { App.showToast(error.message, "error"); return; }

    const userId = data.user.id;
    pendingUserId = userId;

    // Insert initial profile row (role will be filled by role modal)
    await supabaseClient.from("profiles").insert({
      id:   userId,
      name: name,
      role: null
    });

    App.showToast("Account created! Select your role.");
    openRoleModal();
  });

  // ── LOGIN (email/password) ───────────────────────────────────
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email    = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) { App.showToast("Invalid email or password", "error"); return; }

    App.showToast("Login successful!");

    // Fetch profile to check if role is set
    const { data: profile } = await supabaseClient
      .from("profiles").select("role").eq("id", data.user.id).single();

    setTimeout(() => {
      if (!profile || !profile.role) {
        pendingUserId = data.user.id;
        openRoleModal();
      } else {
        App.redirectToDashboard(profile.role);
      }
    }, 800);
  });

  // ── GOOGLE OAUTH ─────────────────────────────────────────────
  function initGoogleOAuthBtn() {
    const btn = document.getElementById("google-signin-btn");
    if (!btn) return;

    // Replace the raw GSI button with a styled Supabase OAuth trigger
    btn.innerHTML = `
      <button type="button" id="supabase-google-btn" style="
        display:flex; align-items:center; gap:10px; width:100%;
        justify-content:center; padding:12px 20px; border-radius:10px;
        border:1.5px solid rgba(255,255,255,0.15); background:rgba(255,255,255,0.07);
        color:#fff; font-size:0.95rem; cursor:pointer; transition:background 0.2s;">
        <svg width="20" height="20" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continue with Google
      </button>`;

    document.getElementById("supabase-google-btn").addEventListener("click", async () => {
      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin + "/auth.html"
        }
      });
      if (error) App.showToast(error.message, "error");
    });
  }

  initGoogleOAuthBtn();

  // ── ROLE MODAL ───────────────────────────────────────────────
  function openRoleModal() {
    if (roleModal) roleModal.classList.add("active");
    selectedRole = "";
    if (roleCards.length) {
      roleCards.forEach(card => card.classList.remove("selected"));
    }
    if (roleExtraFields) roleExtraFields.style.display = "none";
  }

  roleCards.forEach(card => {
    card.addEventListener("click", () => {
      roleCards.forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      selectedRole = card.dataset.role;

      if (roleExtraFields) {
        roleExtraFields.style.display = "block";
        if (mapGroup)    mapGroup.style.display    = (selectedRole === "farmer" || selectedRole === "delivery") ? "block" : "none";
        if (addressGroup) addressGroup.style.display = selectedRole === "customer" ? "block" : "none";
      }

      // Init leaflet map for farmer/delivery
      if ((selectedRole === "farmer" || selectedRole === "delivery") && !mapInstance) {
        setTimeout(() => {
          mapInstance = L.map("role-map").setView([20.5937, 78.9629], 5);
          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "© OpenStreetMap contributors"
          }).addTo(mapInstance);

          mapInstance.on("click", (e) => {
            selectedCoords = [e.latlng.lat, e.latlng.lng];
            if (selectedMarker) mapInstance.removeLayer(selectedMarker);
            selectedMarker = L.marker(selectedCoords).addTo(mapInstance);
            if (coordsIndicator) {
              coordsIndicator.textContent = `📍 ${selectedCoords[0].toFixed(4)}, ${selectedCoords[1].toFixed(4)}`;
            }
          });
        }, 200);
      }
    });
  });

  if (modalConfirmBtn) {
    modalConfirmBtn.addEventListener("click", async () => {
      if (!selectedRole) { App.showToast("Please select a role", "error"); return; }

      const { data: { user } } = await supabaseClient.auth.getUser();
      const uid = pendingUserId || (user && user.id);
      if (!uid) { App.showToast("Session error. Please log in again.", "error"); return; }

      const profileUpdate = { role: selectedRole };

      if (selectedRole === "customer") {
        const address = document.getElementById("customer-address");
        if (address) profileUpdate.address = address.value;
      }

      if (selectedRole === "farmer" || selectedRole === "delivery") {
        if (selectedCoords) {
          profileUpdate.lat = selectedCoords[0];
          profileUpdate.lng = selectedCoords[1];
        }
      }

      // Upsert profile with role
      const { error } = await supabaseClient.from("profiles")
        .update(profileUpdate).eq("id", uid);

      if (error) { App.showToast(error.message, "error"); return; }

      App.showToast(`Welcome to AgriLinker as a ${selectedRole}!`);
      roleModal.classList.remove("active");
      pendingUserId = null;

      setTimeout(() => App.redirectToDashboard(selectedRole), 1000);
    });
  }

  if (modalCancelBtn) {
    modalCancelBtn.addEventListener("click", async () => {
      roleModal.classList.remove("active");
      await supabaseClient.auth.signOut();
    });
  }

  // ── CHECK FOR GOOGLE OAUTH REDIRECT (role setup needed) ──────
  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (event === "SIGNED_IN" && session) {
      const userId = session.user.id;

      // Check if profile exists with a role
      const { data: profile } = await supabaseClient
        .from("profiles").select("role, name").eq("id", userId).single();

      if (!profile) {
        // First Google login — create profile row
        await supabaseClient.from("profiles").insert({
          id:   userId,
          name: session.user.user_metadata?.full_name || session.user.email,
          role: null
        });
        pendingUserId = userId;
        App.showToast(`Signed in as ${session.user.user_metadata?.full_name || session.user.email}`);
        openRoleModal();
      } else if (!profile.role) {
        pendingUserId = userId;
        openRoleModal();
      } else {
        App.redirectToDashboard(profile.role);
      }
    }

    if (event === "PASSWORD_RECOVERY") {
      // Supabase redirects here after clicking email reset link
      showOnlyForm(resetPasswordForm);
      App.showToast("Set your new password below.");
    }
  });

  // Auto trigger role modal if URL param says so
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("select_role") === "true") openRoleModal();

  // ── FORGOT PASSWORD LINK ─────────────────────────────────────
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener("click", (e) => {
      e.preventDefault();
      showOnlyForm(forgotPasswordForm);
    });
  }

  if (forgotBackToLogin) {
    forgotBackToLogin.addEventListener("click", (e) => {
      e.preventDefault();
      showOnlyForm(loginForm);
    });
  }

  // ── PHASE 1: Request Reset Email ─────────────────────────────
  if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("forgot-email").value.trim();

      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/auth.html"
      });

      if (error) { App.showToast(error.message, "error"); return; }
      App.showToast("Password reset email sent! Check your inbox (and spam folder).");
      showOnlyForm(loginForm);
    });
  }

  // ── PHASE 2: PASSWORD_RECOVERY event handles token redirect (see onAuthStateChange above)

  // ── PHASE 3: Strength Meter & Update Password ────────────────
  function evaluateStrength(pwd) {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score;
  }

  const strengthColors = ["", "#ef4444", "#f97316", "#facc15", "#10b981"];
  const strengthTexts  = ["", "Weak", "Fair", "Good", "Strong ✓"];

  if (resetPasswordInput) {
    resetPasswordInput.addEventListener("input", () => {
      const pwd   = resetPasswordInput.value;
      const score = evaluateStrength(pwd);
      strengthBars.forEach((bar, i) => {
        bar.style.backgroundColor = i < score ? strengthColors[score] : "transparent";
      });
      if (strengthLabel) {
        strengthLabel.textContent = pwd.length === 0 ? "Strength: Too Short" : `Strength: ${strengthTexts[score]}`;
        strengthLabel.style.color = strengthColors[score] || "var(--text-muted)";
      }
      validateResetSubmit();
    });

    resetConfirmInput.addEventListener("input", validateResetSubmit);
  }

  function validateResetSubmit() {
    const pwd    = resetPasswordInput ? resetPasswordInput.value : "";
    const conf   = resetConfirmInput  ? resetConfirmInput.value  : "";
    const score  = evaluateStrength(pwd);
    const match  = pwd === conf && conf.length > 0;
    if (resetSubmitBtn) resetSubmitBtn.disabled = !(score >= 3 && match);
    if (resetConfirmInput && conf.length > 0) {
      resetConfirmInput.style.borderColor = match ? "var(--lime)" : "#ef4444";
    }
  }

  if (resetPasswordForm) {
    resetPasswordForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const newPwd = resetPasswordInput.value;
      const conf   = resetConfirmInput.value;

      if (newPwd !== conf) { App.showToast("Passwords do not match.", "error"); return; }

      // Supabase updateUser uses the active PASSWORD_RECOVERY session
      const { error } = await supabaseClient.auth.updateUser({ password: newPwd });
      if (error) { App.showToast(error.message, "error"); return; }

      App.showToast("Password updated successfully! Please log in.");
      await supabaseClient.auth.signOut();
      setTimeout(() => { window.location.href = "auth.html?pwd_reset=success"; }, 1500);
    });
  }

  if (urlParams.get("pwd_reset") === "success") {
    App.showToast("Your password has been reset. You can now log in.");
  }

}); // End DOMContentLoaded

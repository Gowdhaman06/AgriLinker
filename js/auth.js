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
  const addressGroup   = document.getElementById("address-field-group");
  const modalCancelBtn  = document.getElementById("modal-cancel-btn");
  const modalConfirmBtn = document.getElementById("modal-confirm-btn");

  // Cascading Location inputs
  const cascadingGroup = document.getElementById("location-cascading-group");
  const locStateInput = document.getElementById("loc-state");
  const locDistrictInput = document.getElementById("loc-district");
  const locTalukInput = document.getElementById("loc-taluk");

  const dropdownState = document.getElementById("dropdown-state");
  const dropdownDistrict = document.getElementById("dropdown-district");
  const dropdownTaluk = document.getElementById("dropdown-taluk");

  const locationSummary = document.getElementById("location-summary");
  const locationSummaryText = document.getElementById("location-summary-text");

  const rolePhoneInput = document.getElementById("role-phone");
  const roleAddressInput = document.getElementById("role-address");

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
  let pendingUserId  = null; // Supabase user.id awaiting role setup

  // State coordinates mapping for Leaflet calculations fallback
  const STATE_COORDS = {
    "Andhra Pradesh": [15.9129, 79.7400],
    "Arunachal Pradesh": [28.2180, 94.7278],
    "Assam": [26.2006, 92.9376],
    "Bihar": [25.0961, 85.3131],
    "Chhattisgarh": [21.2787, 81.8661],
    "Goa": [15.2993, 74.1240],
    "Gujarat": [22.2587, 71.1924],
    "Haryana": [29.0588, 76.0856],
    "Himachal Pradesh": [31.1048, 77.1734],
    "Jharkhand": [23.6102, 85.2799],
    "Karnataka": [15.3173, 75.7139],
    "Kerala": [10.8505, 76.2711],
    "Madhya Pradesh": [22.9734, 78.6569],
    "Maharashtra": [19.7515, 75.7139],
    "Manipur": [24.6637, 93.9063],
    "Meghalaya": [25.4670, 91.3662],
    "Mizoram": [23.1645, 92.9376],
    "Nagaland": [26.1584, 94.5624],
    "Odisha": [20.9517, 85.0985],
    "Punjab": [31.1471, 75.3412],
    "Rajasthan": [27.0238, 74.2179],
    "Sikkim": [27.5330, 88.5122],
    "Tamil Nadu": [11.1271, 78.6569],
    "Telangana": [18.1124, 79.0193],
    "Tripura": [23.9408, 91.9882],
    "Uttar Pradesh": [26.8467, 80.9462],
    "Uttarakhand": [30.0668, 79.0193],
    "West Bengal": [22.9868, 87.8550],
    "Delhi": [28.7041, 77.1025],
    "Jammu and Kashmir": [33.7780, 76.5762],
    "Ladakh": [34.1526, 77.5771],
    "Puducherry": [11.9416, 79.8083],
    "Chandigarh": [30.7333, 76.7794],
    "Andaman and Nicobar Islands": [11.7401, 92.6586],
    "Dadra and Nagar Haveli and Daman and Diu": [20.1809, 73.0169],
    "Lakshadweep": [10.5667, 72.6417]
  };

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
  function validateForm() {
    if (!selectedRole) {
      if (modalConfirmBtn) modalConfirmBtn.disabled = true;
      return;
    }

    const phone = rolePhoneInput ? rolePhoneInput.value.trim() : "";
    if (!phone) {
      if (modalConfirmBtn) modalConfirmBtn.disabled = true;
      return;
    }

    if (selectedRole === "customer") {
      const address = roleAddressInput ? roleAddressInput.value.trim() : "";
      if (modalConfirmBtn) modalConfirmBtn.disabled = !address;
    } else if (selectedRole === "farmer" || selectedRole === "delivery") {
      const stateVal = locStateInput.value.trim();
      const distVal = locDistrictInput.value.trim();
      const talukVal = locTalukInput.value.trim();

      const isValidState = INDIA_LOCATIONS[stateVal] !== undefined;
      const isValidDist = isValidState && INDIA_LOCATIONS[stateVal][distVal] !== undefined;
      const isValidTaluk = isValidDist && INDIA_LOCATIONS[stateVal][distVal].includes(talukVal);

      if (modalConfirmBtn) modalConfirmBtn.disabled = !(isValidState && isValidDist && isValidTaluk);
    }
  }

  function setupAutocomplete(inputEl, dropdownEl, getOptionsFn, onSelectFn) {
    if (!inputEl || !dropdownEl) return;

    function renderDropdown(filterText = "") {
      const options = getOptionsFn(filterText);
      dropdownEl.innerHTML = "";

      if (options.length === 0) {
        dropdownEl.classList.remove("active");
        return;
      }

      options.forEach(opt => {
        const optDiv = document.createElement("div");
        optDiv.className = "autocomplete-option";
        optDiv.textContent = opt;
        optDiv.addEventListener("mousedown", (e) => {
          e.preventDefault();
          inputEl.value = opt;
          dropdownEl.classList.remove("active");
          onSelectFn(opt);
          validateForm();
        });
        dropdownEl.appendChild(optDiv);
      });

      dropdownEl.classList.add("active");
    }

    inputEl.addEventListener("focus", () => {
      renderDropdown(inputEl.value);
    });

    inputEl.addEventListener("input", () => {
      renderDropdown(inputEl.value);
      onSelectFn(null);
      validateForm();
    });

    inputEl.addEventListener("blur", () => {
      setTimeout(() => {
        dropdownEl.classList.remove("active");
      }, 200);
    });
  }

  // Setup cascading autocompletes
  setupAutocomplete(
    locStateInput,
    dropdownState,
    (filterText) => {
      const states = Object.keys(INDIA_LOCATIONS);
      return states.filter(s => s.toLowerCase().includes(filterText.toLowerCase())).slice(0, 10);
    },
    (state) => {
      if (state && INDIA_LOCATIONS[state]) {
        locDistrictInput.disabled = false;
        locDistrictInput.placeholder = "Type to search district...";
        locDistrictInput.value = "";

        locTalukInput.disabled = true;
        locTalukInput.placeholder = "Select a district first...";
        locTalukInput.value = "";

        locationSummary.style.display = "none";
      } else {
        locDistrictInput.disabled = true;
        locDistrictInput.placeholder = "Select a state first...";
        locDistrictInput.value = "";

        locTalukInput.disabled = true;
        locTalukInput.placeholder = "Select a district first...";
        locTalukInput.value = "";

        locationSummary.style.display = "none";
      }
    }
  );

  setupAutocomplete(
    locDistrictInput,
    dropdownDistrict,
    (filterText) => {
      const state = locStateInput.value.trim();
      if (!INDIA_LOCATIONS[state]) return [];
      const districts = Object.keys(INDIA_LOCATIONS[state]);
      return districts.filter(d => d.toLowerCase().includes(filterText.toLowerCase())).slice(0, 10);
    },
    (district) => {
      const state = locStateInput.value.trim();
      if (district && INDIA_LOCATIONS[state] && INDIA_LOCATIONS[state][district]) {
        locTalukInput.disabled = false;
        locTalukInput.placeholder = "Type to search subdivision/taluk...";
        locTalukInput.value = "";

        locationSummary.style.display = "none";
      } else {
        locTalukInput.disabled = true;
        locTalukInput.placeholder = "Select a district first...";
        locTalukInput.value = "";

        locationSummary.style.display = "none";
      }
    }
  );

  setupAutocomplete(
    locTalukInput,
    dropdownTaluk,
    (filterText) => {
      const state = locStateInput.value.trim();
      const district = locDistrictInput.value.trim();
      if (!INDIA_LOCATIONS[state] || !INDIA_LOCATIONS[state][district]) return [];
      const taluks = INDIA_LOCATIONS[state][district];
      return taluks.filter(t => t.toLowerCase().includes(filterText.toLowerCase())).slice(0, 10);
    },
    (taluk) => {
      const state = locStateInput.value.trim();
      const district = locDistrictInput.value.trim();
      if (taluk && INDIA_LOCATIONS[state] && INDIA_LOCATIONS[state][district] && INDIA_LOCATIONS[state][district].includes(taluk)) {
        locationSummaryText.textContent = `Selected: ${taluk}, ${district}, ${state}`;
        locationSummary.style.display = "flex";
      } else {
        locationSummary.style.display = "none";
      }
    }
  );

  if (rolePhoneInput) {
    rolePhoneInput.addEventListener("input", validateForm);
  }
  if (roleAddressInput) {
    roleAddressInput.addEventListener("input", validateForm);
  }

  function openRoleModal() {
    if (roleModal) roleModal.classList.add("active");
    selectedRole = "";
    if (roleCards.length) {
      roleCards.forEach(card => card.classList.remove("selected"));
    }
    if (roleExtraFields) roleExtraFields.style.display = "none";
    if (modalConfirmBtn) modalConfirmBtn.disabled = true;
  }

  roleCards.forEach(card => {
    card.addEventListener("click", () => {
      roleCards.forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      selectedRole = card.dataset.role;

      if (roleExtraFields) {
        roleExtraFields.style.display = "block";
        const isFarmerOrDelivery = (selectedRole === "farmer" || selectedRole === "delivery");
        if (cascadingGroup) cascadingGroup.style.display = isFarmerOrDelivery ? "block" : "none";
        if (addressGroup)   addressGroup.style.display   = selectedRole === "customer" ? "block" : "none";
      }

      validateForm();
    });
  });

  if (modalConfirmBtn) {
    modalConfirmBtn.addEventListener("click", async () => {
      if (!selectedRole) { App.showToast("Please select a role", "error"); return; }

      const { data: { user } } = await supabaseClient.auth.getUser();
      const uid = pendingUserId || (user && user.id);
      if (!uid) { App.showToast("Session error. Please log in again.", "error"); return; }

      const phone = rolePhoneInput ? rolePhoneInput.value.trim() : "";
      const profileUpdate = { role: selectedRole, phone: phone };

      if (selectedRole === "customer") {
        if (roleAddressInput) profileUpdate.address = roleAddressInput.value.trim();
      }

      if (selectedRole === "farmer" || selectedRole === "delivery") {
        const stateVal = locStateInput.value.trim();
        const distVal = locDistrictInput.value.trim();
        const talukVal = locTalukInput.value.trim();

        profileUpdate.address = `${talukVal}, ${distVal}, ${stateVal}`;

        // Get coordinates from our state mapping
        const coords = STATE_COORDS[stateVal] || [12.9716, 77.5946];
        // Perturb coordinates slightly so multiple users in the same state aren't stacked exactly on top of each other
        const hash = (uid.charCodeAt(0) + uid.charCodeAt(1) + uid.charCodeAt(2)) % 100;
        const perturbationLat = (hash - 50) * 0.005;
        const perturbationLng = (hash - 50) * 0.005;

        profileUpdate.lat = coords[0] + perturbationLat;
        profileUpdate.lng = coords[1] + perturbationLng;
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

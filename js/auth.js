// Auth logic handler (email/pwd + Google OAuth mock + role selection map helper)
document.addEventListener("DOMContentLoaded", () => {
  const tabLogin = document.getElementById("tab-login");
  const tabRegister = document.getElementById("tab-register");
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  
  // Google sign in elements
  const googleBtn = document.getElementById("google-signin-btn");
  
  // Modal elements
  const roleModal = document.getElementById("role-overlay") || document.getElementById("role-modal");
  const roleCards = document.querySelectorAll(".role-card");
  const roleExtraFields = document.getElementById("role-extra-fields");
  const mapGroup = document.getElementById("map-selection-group");
  const addressGroup = document.getElementById("address-field-group");
  const coordsIndicator = document.getElementById("coords-indicator");
  
  const modalCancelBtn = document.getElementById("modal-cancel-btn");
  const modalConfirmBtn = document.getElementById("modal-confirm-btn");
  
  let selectedRole = "";
  let mapInstance = null;
  let selectedMarker = null;
  let selectedCoords = null;
  let tempUserSession = null; // Store registering user temporarily

  // 1. Tab toggles
  tabLogin.addEventListener("click", () => {
    tabLogin.classList.add("active");
    tabRegister.classList.remove("active");
    loginForm.style.display = "block";
    registerForm.style.display = "none";
  });

  tabRegister.addEventListener("click", () => {
    tabRegister.classList.add("active");
    tabLogin.classList.remove("active");
    loginForm.style.display = "none";
    registerForm.style.display = "block";
  });

  // 2. Email & Password registration
  registerForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("register-name").value;
    const email = document.getElementById("register-email").value;
    const password = document.getElementById("register-password").value;

    const users = JSON.parse(localStorage.getItem("agrilinker_users") || "[]");
    if (users.some(u => u.email === email)) {
      App.showToast("Email already registered!", "error");
      return;
    }

    // Create temp user object
    const newUser = {
      id: "user_" + Date.now(),
      name: name,
      email: email,
      password: password,
      role: null, // to be updated in role modal
      joined: new Date().toISOString().split('T')[0]
    };

    users.push(newUser);
    localStorage.setItem("agrilinker_users", JSON.stringify(users));

    tempUserSession = newUser;
    App.showToast("Registration successful! Select your role.");
    openRoleModal();
  });

  // 3. Email & Password Login
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    const users = JSON.parse(localStorage.getItem("agrilinker_users") || "[]");
    const matchedUser = users.find(u => u.email === email && u.password === password);

    if (!matchedUser) {
      App.showToast("Invalid email or password", "error");
      return;
    }

    localStorage.setItem("agrilinker_current_user", JSON.stringify(matchedUser));
    App.showToast("Login successful!");
    
    setTimeout(() => {
      if (!matchedUser.role) {
        tempUserSession = matchedUser;
        openRoleModal();
      } else {
        App.redirectToDashboard(matchedUser.role);
      }
    }, 1000);
  });

  // 4. Google Sign In OAuth Integration
  function handleCredentialResponse(response) {
    const token = response.credential;
    const payload = decodeJwt(token);
    if (!payload) {
      App.showToast("Google Authentication failed", "error");
      return;
    }

    const email = payload.email;
    const name = payload.name;

    const users = JSON.parse(localStorage.getItem("agrilinker_users") || "[]");
    let matchedUser = users.find(u => u.email === email);

    if (!matchedUser) {
      // Register Google User
      matchedUser = {
        id: "google_" + payload.sub,
        name: name,
        email: email,
        password: "google_oauth_bypass",
        role: null,
        joined: new Date().toISOString().split('T')[0]
      };
      users.push(matchedUser);
      localStorage.setItem("agrilinker_users", JSON.stringify(users));
    }

    localStorage.setItem("agrilinker_current_user", JSON.stringify(matchedUser));
    App.showToast(`Signed in as ${name}`);

    setTimeout(() => {
      if (!matchedUser.role) {
        tempUserSession = matchedUser;
        openRoleModal();
      } else {
        App.redirectToDashboard(matchedUser.role);
      }
    }, 1000);
  }

  function decodeJwt(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      console.error("JWT decoding failed:", e);
      return null;
    }
  }

  // Initialize Google Identity Services
  function initGoogleOAuth() {
    if (window.location.protocol === 'file:') {
      App.showToast("Warning: Google Sign-In requires a web server (http://localhost). Running from file:// will cause a Google Error 400.", "error");
    }

    if (typeof google !== 'undefined') {
      google.accounts.id.initialize({
        client_id: "4533466381-ik9fcpe5b7ock54hsq4kvj3m4r5svrv4.apps.googleusercontent.com",
        callback: handleCredentialResponse
      });
      google.accounts.id.renderButton(
        document.getElementById("google-signin-btn"),
        { theme: "filled_blue", size: "large", text: "continue_with" }
      );
    } else {
      setTimeout(initGoogleOAuth, 300);
    }
  }

  // Trigger Google load
  initGoogleOAuth();

  // 5. Role Selection Modal Trigger
  function openRoleModal() {
    roleModal.classList.add("active");
    // If modal maps need initializing, wait a tick for DOM to register height
    setTimeout(() => {
      if (!mapInstance) {
        // Center around Bengaluru by default
        mapInstance = AgriMap.init("role-location-map", [12.9716, 77.5946], 11);
        
        mapInstance.on("click", (e) => {
          const lat = parseFloat(e.latlng.lat.toFixed(4));
          const lng = parseFloat(e.latlng.lng.toFixed(4));
          selectedCoords = [lat, lng];
          coordsIndicator.textContent = `[${lat}, ${lng}]`;

          if (selectedMarker) {
            selectedMarker.setLatLng(e.latlng);
          } else {
            selectedMarker = AgriMap.addMarker(mapInstance, selectedCoords, "Your Selected Location", selectedRole);
          }
          validateModalConfirm();
        });
      }
    }, 300);
  }

  // 6. Handling Role Cards Clicks
  roleCards.forEach(card => {
    card.addEventListener("click", () => {
      roleCards.forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      
      selectedRole = card.getAttribute("data-role");
      roleExtraFields.style.display = "block";

      if (selectedRole === "farmer" || selectedRole === "customer") {
        mapGroup.style.display = "block";
        addressGroup.style.display = "block";
        if (mapInstance) {
          // Trigger leaflet layout refresh
          mapInstance.invalidateSize();
        }
      } else {
        // Delivery person doesn't need map coordinates pin
        mapGroup.style.display = "none";
        addressGroup.style.display = "none";
      }

      validateModalConfirm();
    });
  });

  // 7. Validate inputs inside Role Modal
  const rolePhoneInput = document.getElementById("role-phone");
  const roleAddressInput = document.getElementById("role-address");

  function validateModalConfirm() {
    let isValid = selectedRole !== "";
    
    if (selectedRole === "farmer" || selectedRole === "customer") {
      const hasPhone = rolePhoneInput.value.trim() !== "";
      const hasAddress = roleAddressInput.value.trim() !== "";
      const hasCoords = selectedCoords !== null;
      isValid = hasPhone && hasAddress && hasCoords;
    } else if (selectedRole === "delivery") {
      const hasPhone = rolePhoneInput.value.trim() !== "";
      isValid = hasPhone;
    }

    modalConfirmBtn.disabled = !isValid;
  }

  rolePhoneInput.addEventListener("input", validateModalConfirm);
  roleAddressInput.addEventListener("input", validateModalConfirm);

  // 8. Confirm Role & Coordinates Selection
  modalConfirmBtn.addEventListener("click", () => {
    const userToUpdate = tempUserSession || App.getCurrentUser();
    if (!userToUpdate) {
      App.showToast("No active registration session found. Try again.", "error");
      return;
    }

    userToUpdate.role = selectedRole;
    userToUpdate.phone = rolePhoneInput.value;
    
    if (selectedRole === "farmer" || selectedRole === "customer") {
      userToUpdate.address = roleAddressInput.value;
      userToUpdate.coords = selectedCoords;
    }

    // Write back to database list
    const users = JSON.parse(localStorage.getItem("agrilinker_users") || "[]");
    const index = users.findIndex(u => u.id === userToUpdate.id);
    if (index !== -1) {
      users[index] = userToUpdate;
      localStorage.setItem("agrilinker_users", JSON.stringify(users));
    }

    // Set active session
    localStorage.setItem("agrilinker_current_user", JSON.stringify(userToUpdate));
    
    App.showToast(`Setup complete! Welcome to AgriLinker.`);
    roleModal.classList.remove("active");
    
    setTimeout(() => {
      App.redirectToDashboard(selectedRole);
    }, 1000);
  });

  // Modal Cancel handler
  modalCancelBtn.addEventListener("click", () => {
    roleModal.classList.remove("active");
    localStorage.removeItem("agrilinker_current_user");
  });

  // Auto trigger role selection modal if redirect param present
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("select_role") === "true") {
    openRoleModal();
  }

  // ============================================================
  // PASSWORD RESET WORKFLOW
  // ============================================================

  // DOM Elements
  const forgotPasswordLink  = document.getElementById("forgot-password-link");
  const forgotBackToLogin   = document.getElementById("forgot-back-to-login");
  const forgotPasswordForm  = document.getElementById("forgot-password-form");
  const resetPasswordForm   = document.getElementById("reset-password-form");
  const resetPasswordInput  = document.getElementById("reset-password");
  const resetConfirmInput   = document.getElementById("reset-confirm-password");
  const resetSubmitBtn      = document.getElementById("reset-submit-btn");
  const mockEmailModal      = document.getElementById("mock-email-modal");
  const mockEmailLink       = document.getElementById("mock-email-link");
  const mockEmailTo         = document.getElementById("mock-email-to");
  const mockEmailUrlText    = document.getElementById("mock-email-url-text");
  const mockEmailClose      = document.getElementById("mock-email-close");

  // Strength bar elements
  const strengthBars  = [1,2,3,4].map(n => document.getElementById(`strength-bar-${n}`));
  const strengthLabel = document.getElementById("strength-label");

  // Helper — hide all forms and show only the target
  function showOnlyForm(formEl) {
    [loginForm, registerForm, forgotPasswordForm, resetPasswordForm].forEach(f => {
      if (f) f.style.display = "none";
    });
    // Hide Google btn + divider on reset/forgot views
    const gsiBtn   = document.getElementById("google-signin-btn");
    const divider  = document.querySelector(".divider");
    const authTabs = document.querySelector(".auth-tabs");
    const isCoreAuth = (formEl === loginForm || formEl === registerForm);
    if (gsiBtn)   gsiBtn.style.display   = isCoreAuth ? "flex"  : "none";
    if (divider)  divider.style.display  = isCoreAuth ? "flex"  : "none";
    if (authTabs) authTabs.style.display = isCoreAuth ? "flex"  : "none";
    if (formEl)   formEl.style.display   = "block";
  }

  // Forgot password link click
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener("click", (e) => {
      e.preventDefault();
      showOnlyForm(forgotPasswordForm);
    });
  }

  // Back to login from forgot page
  if (forgotBackToLogin) {
    forgotBackToLogin.addEventListener("click", (e) => {
      e.preventDefault();
      showOnlyForm(loginForm);
    });
  }

  // ── PHASE 1: Request Phase ──────────────────────────────────
  if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = document.getElementById("forgot-email").value.trim();
      const users  = JSON.parse(localStorage.getItem("agrilinker_users") || "[]");
      const user   = users.find(u => u.email === email);

      if (!user) {
        App.showToast("No account found with that email address.", "error");
        return;
      }

      // Generate secure token using Web Crypto API (128-bit random hex)
      const tokenBytes = new Uint8Array(16);
      crypto.getRandomValues(tokenBytes);
      const token = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, "0")).join("");

      // Store token with 15-minute expiry
      const resetEntry = {
        token,
        email,
        expiresAt: Date.now() + 15 * 60 * 1000  // 15 minutes
      };
      const tokens = JSON.parse(localStorage.getItem("agrilinker_reset_tokens") || "[]");
      // Invalidate any existing token for this email first
      const filtered = tokens.filter(t => t.email !== email);
      filtered.push(resetEntry);
      localStorage.setItem("agrilinker_reset_tokens", JSON.stringify(filtered));

      // Build reset URL (works on both file:// and http://)
      const baseUrl  = window.location.href.split("?")[0];
      const resetUrl = `${baseUrl}?reset_token=${token}`;

      // Show mock email inbox modal
      mockEmailTo.textContent       = email;
      mockEmailUrlText.textContent  = resetUrl;
      mockEmailLink.setAttribute("href", resetUrl);
      mockEmailModal.classList.add("active");

      App.showToast("Password reset link generated! Check your inbox.");
    });
  }

  // Close mock email modal
  if (mockEmailClose) {
    mockEmailClose.addEventListener("click", () => {
      mockEmailModal.classList.remove("active");
    });
  }

  // ── PHASE 2: Verification Phase ─────────────────────────────
  const resetToken = urlParams.get("reset_token");
  if (resetToken) {
    const tokens  = JSON.parse(localStorage.getItem("agrilinker_reset_tokens") || "[]");
    const entry   = tokens.find(t => t.token === resetToken);
    const now     = Date.now();

    if (!entry) {
      // Invalid token
      showOnlyForm(null);
      App.showToast("Invalid reset link. Please request a new one.", "error");
      setTimeout(() => showOnlyForm(forgotPasswordForm), 1500);
    } else if (now > entry.expiresAt) {
      // Expired token — delete it and show error
      const purged = tokens.filter(t => t.token !== resetToken);
      localStorage.setItem("agrilinker_reset_tokens", JSON.stringify(purged));
      App.showToast("This reset link has expired (15 min limit). Request a new one.", "error");
      setTimeout(() => showOnlyForm(forgotPasswordForm), 2000);
    } else {
      // Valid token → show New Password form
      document.getElementById("reset-token-input").value = resetToken;
      showOnlyForm(resetPasswordForm);
      App.showToast("Token verified. Please set your new password.");
    }
  }

  // ── PHASE 3: Password Strength Meter ────────────────────────
  function evaluateStrength(pwd) {
    let score = 0;
    const checks = {
      length:   pwd.length >= 8,
      upper:    /[A-Z]/.test(pwd),
      lower:    /[a-z]/.test(pwd),
      number:   /[0-9]/.test(pwd),
      symbol:   /[^A-Za-z0-9]/.test(pwd)
    };
    if (checks.length) score++;
    if (checks.upper && checks.lower) score++;
    if (checks.number) score++;
    if (checks.symbol) score++;
    return { score, checks };
  }

  const strengthColors = ["", "#ef4444", "#f97316", "#facc15", "#10b981"];
  const strengthTexts  = ["", "Weak — add uppercase & numbers", "Fair — add a symbol", "Good — almost there!", "Strong ✓"];

  if (resetPasswordInput) {
    resetPasswordInput.addEventListener("input", () => {
      const pwd = resetPasswordInput.value;
      const { score } = evaluateStrength(pwd);

      strengthBars.forEach((bar, i) => {
        bar.style.backgroundColor = i < score ? strengthColors[score] : "transparent";
        bar.style.borderRadius = "3px";
      });

      if (strengthLabel) {
        strengthLabel.textContent = pwd.length === 0
          ? "Strength: Too Short"
          : `Strength: ${strengthTexts[score]}`;
        strengthLabel.style.color = strengthColors[score] || "var(--text-muted)";
      }

      validateResetSubmit();
    });

    resetConfirmInput.addEventListener("input", validateResetSubmit);
  }

  function validateResetSubmit() {
    const pwd     = resetPasswordInput ? resetPasswordInput.value : "";
    const confirm = resetConfirmInput  ? resetConfirmInput.value  : "";
    const { score } = evaluateStrength(pwd);
    const match   = pwd === confirm && confirm.length > 0;
    if (resetSubmitBtn) {
      resetSubmitBtn.disabled = !(score >= 3 && match);
    }

    // Confirm field border feedback
    if (resetConfirmInput && confirm.length > 0) {
      resetConfirmInput.style.borderColor = match ? "var(--lime)" : "#ef4444";
    }
  }

  // ── PHASE 3: Update Password & Token Invalidation ───────────
  if (resetPasswordForm) {
    resetPasswordForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const token   = document.getElementById("reset-token-input").value;
      const newPwd  = resetPasswordInput.value;
      const confirm = resetConfirmInput.value;

      if (newPwd !== confirm) {
        App.showToast("Passwords do not match.", "error");
        return;
      }

      const tokens = JSON.parse(localStorage.getItem("agrilinker_reset_tokens") || "[]");
      const entry  = tokens.find(t => t.token === token);

      if (!entry || Date.now() > entry.expiresAt) {
        App.showToast("Reset link expired. Please request a new one.", "error");
        setTimeout(() => showOnlyForm(forgotPasswordForm), 1500);
        return;
      }

      // "Hash" the password — client-side SHA-256 simulation via btoa
      // (In a real app, hashing is done server-side with bcrypt/argon2)
      const hashedPwd = btoa(unescape(encodeURIComponent(newPwd)));

      // Update user password in database
      const users = JSON.parse(localStorage.getItem("agrilinker_users") || "[]");
      const idx   = users.findIndex(u => u.email === entry.email);
      if (idx !== -1) {
        users[idx].password = hashedPwd;
        localStorage.setItem("agrilinker_users", JSON.stringify(users));
      }

      // ── Immediately invalidate the token (prevent replay attacks)
      const purged = tokens.filter(t => t.token !== token);
      localStorage.setItem("agrilinker_reset_tokens", JSON.stringify(purged));

      // Clear URL token param and redirect to login with success message
      App.showToast("Password updated successfully! Please log in.");
      setTimeout(() => {
        window.location.href = window.location.pathname + "?pwd_reset=success";
      }, 1500);
    });
  }

  // Show success banner if redirected after password reset
  if (urlParams.get("pwd_reset") === "success") {
    App.showToast("Your password has been reset. You can now log in.");
  }

}); // End DOMContentLoaded

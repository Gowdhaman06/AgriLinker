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
    // Clear login session if cancel setting up role
    localStorage.removeItem("agrilinker_current_user");
  });

  // Auto trigger role selection modal if redirect param present
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("select_role") === "true") {
    openRoleModal();
  }
});

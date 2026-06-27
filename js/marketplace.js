// ============================================================
// AgriLinker — Marketplace (Supabase Data Layer)
// Shopping Cart, Farm Finder Leaflet integration
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
  // Check authorization - only customer can browse marketplace
  await App.checkAuthAndRedirect(["customer"]);

  // We await fetchCurrentUser here to ensure the session is loaded
  const currentUser = await App.fetchCurrentUser();
  if (!currentUser) return;

  // State
  let products = [];
  let cart = [];
  let isMapView = false;
  let mapInstance = null;
  let checkoutMapInstance = null;
  let checkoutMarker = null;
  let checkoutCoords = currentUser.lat && currentUser.lng ? [currentUser.lat, currentUser.lng] : [12.9716, 77.5946];

  let activeCategory = "all";
  let activeQuery = "";

  // DOM bindings
  const productsContainer = document.getElementById("products-container");
  const mapWrapper = document.getElementById("farm-finder-map-wrapper");
  const searchInput = document.getElementById("search-input");
  const filterBtns = document.querySelectorAll(".filter-btn");
  const toggleViewBtn = document.getElementById("toggle-view-btn");
  const viewModeText = document.getElementById("view-mode-text");
  
  // Cart DOM bindings
  const cartItemsContainer = document.getElementById("cart-items-container");
  const cartCountBadge = document.getElementById("cart-count-badge");
  const cartSubtotal = document.getElementById("cart-subtotal");
  const cartTotal = document.getElementById("cart-total");
  const deliveryOptIn = document.getElementById("delivery-opt-in");
  const deliveryRow = document.getElementById("delivery-charge-row");
  const deliveryAmountDisplay = document.getElementById("delivery-charge-amount");
  const checkoutBtn = document.getElementById("checkout-btn");

  // Checkout modal bindings
  const checkoutModal = document.getElementById("checkout-modal");
  const checkoutSummaryList = document.getElementById("checkout-summary-list");
  const checkoutAddressGroup = document.getElementById("checkout-delivery-address-group");
  const checkoutAddressInput = document.getElementById("checkout-address");
  const modalCheckoutTotal = document.getElementById("modal-checkout-total");
  const checkoutCancelBtn = document.getElementById("checkout-cancel");
  const checkoutConfirmBtn = document.getElementById("checkout-confirm");

  // 0. Initial Data Load
  async function loadData() {
    productsContainer.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:3rem;"><div class="spinner"></div></div>`;
    products = await DB.getProducts();
    renderCatalog();
  }

  // 1. Render Products Catalog
  function renderCatalog() {
    productsContainer.innerHTML = "";
    
    // Filter logic
    const filtered = products.filter(p => {
      const matchCat = activeCategory === "all" || p.category === activeCategory;
      const matchSearch = (p.name || "").toLowerCase().includes(activeQuery.toLowerCase()) || 
                          (p.description || "").toLowerCase().includes(activeQuery.toLowerCase());
      return matchCat && matchSearch;
    });

    if (filtered.length === 0) {
      productsContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">No products found matching your search.</div>`;
      return;
    }

    filtered.forEach(p => {
      const farmerName = p.farmer?.name || "Unknown Farmer";
      const farmerRating = p.farmer?.rating || 0;
      
      const card = document.createElement("div");
      card.className = "glass-card product-card";
      
      card.innerHTML = `
        <div class="product-img-container">
          ${p.organic ? `<span class="organic-badge" data-translate="organic">100% Organic</span>` : ''}
          <img src="${p.image}" alt="${p.name}" onerror="this.src='https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80'">
        </div>
        <div class="product-info">
          <div class="product-cat">${p.category}</div>
          <h4 class="product-title">${p.name}</h4>
          <div class="product-farmer">
            <i class="ri-user-follow-line"></i>
            <span>${farmerName} (${farmerRating} ⭐)</span>
          </div>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">${p.description}</p>
          <div class="product-price-stock">
            <div class="price-tag">₹${p.price} <span style="font-size:0.75rem; color:var(--text-muted);">/ kg</span></div>
            <div class="stock-tag">${p.stock} kg available</div>
          </div>
          <button class="btn btn-primary add-to-cart-btn" data-id="${p.id}" style="width: 100%; margin-top: auto;" ${p.stock <= 0 ? 'disabled' : ''}>
            <i class="ri-shopping-cart-line"></i> <span data-translate="addToCart">Add to Cart</span>
          </button>
        </div>
      `;
      productsContainer.appendChild(card);
    });

    App.translatePage();

    // Attach Add to Cart Listeners
    document.querySelectorAll(".add-to-cart-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const prodId = btn.getAttribute("data-id");
        addToCart(prodId);
      });
    });
  }

  // 2. Shopping Cart Logic
  function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const existing = cart.find(item => item.product.id === productId);
    if (existing) {
      if (existing.quantity >= product.stock) {
        App.showToast("Cannot add more than available stock!", "error");
        return;
      }
      existing.quantity++;
    } else {
      cart.push({ product, quantity: 1 });
    }

    App.showToast(`${product.name} added to cart`);
    updateCartDisplay();
  }

  function updateCartDisplay() {
    cartItemsContainer.innerHTML = "";
    
    if (cart.length === 0) {
      cartItemsContainer.innerHTML = `<p style="text-align: center; color: var(--text-muted); padding: 1.5rem 0;" data-translate="emptyCart">Your cart is empty.</p>`;
      cartCountBadge.textContent = "0";
      cartSubtotal.textContent = "₹0.00";
      cartTotal.textContent = "₹0.00";
      checkoutBtn.disabled = true;
      App.translatePage();
      return;
    }

    let subtotal = 0;
    let totalItems = 0;
    
    cart.forEach(item => {
      subtotal += item.product.price * item.quantity;
      totalItems += item.quantity;

      const row = document.createElement("div");
      row.className = "cart-item";
      row.innerHTML = `
        <div class="cart-item-details">
          <h5>${item.product.name}</h5>
          <p>₹${item.product.price} x ${item.quantity}</p>
        </div>
        <div class="cart-item-qty">
          <button class="qty-btn dec-btn" data-id="${item.product.id}">-</button>
          <span style="font-weight: 600;">${item.quantity}</span>
          <button class="qty-btn inc-btn" data-id="${item.product.id}">+</button>
        </div>
      `;
      cartItemsContainer.appendChild(row);
    });

    cartCountBadge.textContent = totalItems;
    cartSubtotal.textContent = `₹${subtotal.toFixed(2)}`;

    // Handle delivery details calculation
    let deliveryCharge = 0;
    if (deliveryOptIn.checked && checkoutCoords) {
      // Calculate average distance from farmers in cart
      let totalDistance = 0;
      let farmerCounts = 0;
      
      const uniqueFarmers = [...new Set(cart.map(item => item.product.farmer_id))];
      uniqueFarmers.forEach(fid => {
        // Find a product from this farmer to get coords
        const farmerProd = cart.find(i => i.product.farmer_id === fid)?.product;
        if (farmerProd && farmerProd.farmer && farmerProd.farmer.lat) {
          totalDistance += AgriMap.calculateDistance(
            checkoutCoords[0], checkoutCoords[1],
            farmerProd.farmer.lat, farmerProd.farmer.lng
          );
          farmerCounts++;
        }
      });

      const avgDistance = farmerCounts > 0 ? (totalDistance / farmerCounts) : 5;
      const totalWeight = cart.reduce((sum, item) => sum + item.quantity, 0);
      
      deliveryCharge = AgriMap.calculateDeliveryCharge(avgDistance, totalWeight);
      deliveryRow.style.display = "flex";
      deliveryAmountDisplay.textContent = `₹${deliveryCharge.toFixed(2)}`;
    } else {
      deliveryRow.style.display = "none";
    }

    const grandTotal = subtotal + deliveryCharge;
    cartTotal.textContent = `₹${grandTotal.toFixed(2)}`;
    checkoutBtn.disabled = false;

    // Hook listeners
    document.querySelectorAll(".dec-btn").forEach(btn => {
      btn.addEventListener("click", () => changeQty(btn.getAttribute("data-id"), -1));
    });
    document.querySelectorAll(".inc-btn").forEach(btn => {
      btn.addEventListener("click", () => changeQty(btn.getAttribute("data-id"), 1));
    });
  }

  function changeQty(productId, delta) {
    const item = cart.find(i => i.product.id === productId);
    if (!item) return;

    item.quantity += delta;
    if (item.quantity <= 0) {
      cart = cart.filter(i => i.product.id !== productId);
    } else {
      const prod = products.find(p => p.id === productId);
      if (item.quantity > prod.stock) {
        App.showToast("Requested quantity exceeds available stock!", "error");
        item.quantity = prod.stock;
      }
    }
    updateCartDisplay();
  }

  deliveryOptIn.addEventListener("change", updateCartDisplay);

  // 3. Leaflet Farm Finder Map Handler
  function initFarmFinderMap() {
    if (mapInstance) return;

    mapInstance = AgriMap.init("marketplace-map", checkoutCoords, 11);
    AgriMap.addMarker(mapInstance, checkoutCoords, "Your Delivery Address", "customer");

    // Group products by farmer to place one marker per farmer
    const farmerProductsMap = {};
    products.forEach(p => {
      if (!farmerProductsMap[p.farmer_id]) farmerProductsMap[p.farmer_id] = [];
      farmerProductsMap[p.farmer_id].push(p);
    });

    Object.values(farmerProductsMap).forEach(farmerProds => {
      const farmer = farmerProds[0].farmer;
      if (!farmer || !farmer.lat || !farmer.lng) return;

      let productsHtml = farmerProds.slice(0, 3).map(p => `
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.85rem; margin-top:0.5rem; border-top:1px solid #374151; padding-top:0.25rem;">
          <span>${p.name} (₹${p.price})</span>
          <button class="btn btn-primary map-shop-btn" data-id="${p.id}" style="padding:0.2rem 0.5rem; font-size:0.75rem;">+ Cart</button>
        </div>
      `).join("");

      const popupContent = `
        <div style="color:white; font-family:Outfit, sans-serif;">
          <h4 style="margin-bottom:0.25rem; font-weight:700;">${farmer.name}</h4>
          <p style="font-size:0.8rem; color:#9ca3af; margin-bottom:0.5rem;">${farmer.address || "Farm Location"}</p>
          <div style="font-weight:600; font-size:0.85rem; margin-top:0.5rem; color:#7cc243;">Listed Crops:</div>
          ${productsHtml}
        </div>
      `;

      AgriMap.addMarker(mapInstance, [farmer.lat, farmer.lng], popupContent, "farmer");
    });

    mapInstance.on("popupopen", () => {
      document.querySelectorAll(".map-shop-btn").forEach(btn => {
        btn.onclick = (e) => {
          e.preventDefault();
          addToCart(btn.getAttribute("data-id"));
        };
      });
    });
  }

  toggleViewBtn.addEventListener("click", () => {
    isMapView = !isMapView;
    if (isMapView) {
      productsContainer.style.display = "none";
      mapWrapper.style.display = "block";
      viewModeText.textContent = "Grid Catalog View";
      toggleViewBtn.querySelector("i").className = "ri-grid-fill";
      initFarmFinderMap();
      setTimeout(() => mapInstance.invalidateSize(), 100);
    } else {
      productsContainer.style.display = "grid";
      mapWrapper.style.display = "none";
      viewModeText.textContent = "Farm Finder Map";
      toggleViewBtn.querySelector("i").className = "ri-map-2-line";
    }
  });

  // 4. Filters & Searches
  searchInput.addEventListener("input", (e) => {
    activeQuery = e.target.value;
    renderCatalog();
  });

  filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      filterBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeCategory = btn.getAttribute("data-category");
      renderCatalog();
    });
  });

  // 5. Checkout
  checkoutBtn.addEventListener("click", () => {
    checkoutModal.classList.add("active");
    
    checkoutSummaryList.innerHTML = "";
    cart.forEach(item => {
      const div = document.createElement("div");
      div.style.display = "flex";
      div.style.justifyContent = "space-between";
      div.style.fontSize = "0.9rem";
      div.style.padding = "0.4rem 0";
      div.innerHTML = `<span>${item.product.name} (x${item.quantity})</span><span>₹${(item.product.price * item.quantity).toFixed(2)}</span>`;
      checkoutSummaryList.appendChild(div);
    });

    if (deliveryOptIn.checked) {
      checkoutAddressGroup.style.display = "block";
      checkoutAddressInput.value = currentUser.address || "";
      
      setTimeout(() => {
        if (!checkoutMapInstance) {
          checkoutMapInstance = AgriMap.init("checkout-map", checkoutCoords, 12);
          checkoutMarker = AgriMap.addMarker(checkoutMapInstance, checkoutCoords, "Your Delivery Coordinate Pin", "customer", true);
          
          checkoutMapInstance.on("click", (e) => {
            checkoutCoords = [e.latlng.lat, e.latlng.lng];
            checkoutMarker.setLatLng(e.latlng);
          });
          
          checkoutMarker.on("dragend", () => {
            const pos = checkoutMarker.getLatLng();
            checkoutCoords = [pos.lat, pos.lng];
          });
        } else {
          checkoutMapInstance.invalidateSize();
        }
      }, 300);
    } else {
      checkoutAddressGroup.style.display = "none";
    }

    modalCheckoutTotal.textContent = cartTotal.textContent;
  });

  checkoutCancelBtn.addEventListener("click", () => {
    checkoutModal.classList.remove("active");
  });

  checkoutConfirmBtn.addEventListener("click", async () => {
    if (deliveryOptIn.checked && checkoutAddressInput.value.trim() === "") {
      App.showToast("Please provide a delivery address", "error");
      return;
    }

    checkoutConfirmBtn.disabled = true;
    checkoutConfirmBtn.textContent = "Processing...";

    const farmersInCart = [...new Set(cart.map(i => i.product.farmer_id))];
    
    // Process each farmer's order separately
    for (const fid of farmersInCart) {
      const itemsForFarmer = cart.filter(i => i.product.farmer_id === fid);
      const sub = itemsForFarmer.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
      
      const farmerProd = itemsForFarmer[0].product;
      const farmerUser = farmerProd.farmer || { lat: 12.97, lng: 77.60 };

      let delCharge = 0;
      if (deliveryOptIn.checked) {
        const dist = AgriMap.calculateDistance(
          checkoutCoords[0], checkoutCoords[1],
          farmerUser.lat, farmerUser.lng
        );
        delCharge = AgriMap.calculateDeliveryCharge(dist, itemsForFarmer.length);
      }

      const orderData = {
        customer_id: currentUser.id,
        farmer_id: fid,
        subtotal: sub,
        delivery_charge: delCharge,
        total: sub + delCharge,
        status: deliveryOptIn.checked ? "pending" : "accepted",
        delivery_address: deliveryOptIn.checked ? checkoutAddressInput.value : "Self-Pickup from Farm",
        delivery_lat: deliveryOptIn.checked ? checkoutCoords[0] : null,
        delivery_lng: deliveryOptIn.checked ? checkoutCoords[1] : null,
        farmer_lat: farmerUser.lat,
        farmer_lng: farmerUser.lng
      };

      const orderItems = itemsForFarmer.map(i => ({
        product_id: i.product.id,
        name: i.product.name,
        quantity: i.quantity,
        price: i.product.price
      }));

      const newOrder = await DB.placeOrder(orderData, orderItems);

      if (newOrder) {
        // Decrease stock in Supabase
        for (const item of itemsForFarmer) {
          const newStock = Math.max(0, item.product.stock - item.quantity);
          await DB.updateProduct(item.product.id, { stock: newStock });
        }
      } else {
        App.showToast("Failed to place order. Try again.", "error");
      }
    }

    App.showToast("Order placed successfully!");
    checkoutModal.classList.remove("active");
    checkoutConfirmBtn.disabled = false;
    checkoutConfirmBtn.textContent = "Confirm Order";
    
    // Clear cart and reload
    cart = [];
    updateCartDisplay();
    await loadData(); // refresh stock

    setTimeout(() => {
      window.location.href = "customer-dashboard.html";
    }, 1500);
  });

  // Boot
  await loadData();
});

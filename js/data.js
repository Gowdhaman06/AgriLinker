const seedData = {
  users: [
    {
      id: "farmer_ramesh",
      name: "Ramesh Kumar",
      email: "ramesh@agri.com",
      password: "password123",
      role: "farmer",
      phone: "+91 98765 43210",
      address: "Green Field Farms, near Yelahanka, Bengaluru, Karnataka",
      coords: [13.100, 77.596],
      rating: 4.8,
      reviewsCount: 15,
      joined: "2025-05-10"
    },
    {
      id: "farmer_ananya",
      name: "Ananya Swamy",
      email: "ananya@agri.com",
      password: "password123",
      role: "farmer",
      phone: "+91 87654 32109",
      address: "Kavuni Organic Farms, near Redhills, Chennai, Tamil Nadu",
      coords: [13.180, 80.170],
      rating: 4.6,
      reviewsCount: 9,
      joined: "2025-07-22"
    },
    {
      id: "farmer_singh",
      name: "Balvinder Singh",
      email: "singh@agri.com",
      password: "password123",
      role: "farmer",
      phone: "+91 76543 21098",
      address: "Sona Farm, Khanna, Ludhiana District, Punjab",
      coords: [30.700, 76.220],
      rating: 4.9,
      reviewsCount: 32,
      joined: "2025-01-15"
    },
    {
      id: "customer_gowdhaman",
      name: "Gowdhaman Dev",
      email: "gowdhaman@demo.com",
      password: "password123",
      role: "customer",
      phone: "+91 91234 56789",
      address: "Flat 405, Orchid Heights, Indiranagar, Bengaluru, Karnataka",
      coords: [12.978, 77.640],
      joined: "2026-06-01"
    },
    {
      id: "delivery_kartik",
      name: "Kartik Nair",
      email: "kartik@agri.com",
      password: "password123",
      role: "delivery",
      phone: "+91 99988 87776",
      coords: [12.970, 77.600],
      earnings: 450,
      activeDeliveries: 0,
      rating: 4.7,
      joined: "2025-09-18"
    }
  ],
  products: [
    {
      id: "prod_1",
      farmerId: "farmer_ramesh",
      name: "Organic Tomatoes",
      category: "vegetables",
      price: 45,
      stock: 120,
      organic: true,
      image: "https://images.unsplash.com/photo-1595855759920-86582396756a?auto=format&fit=crop&w=400&q=80",
      description: "Vine-ripened, organic red tomatoes grown without synthetic pesticides. Freshly harvested."
    },
    {
      id: "prod_2",
      farmerId: "farmer_ramesh",
      name: "Fresh Potatoes",
      category: "vegetables",
      price: 30,
      stock: 300,
      organic: false,
      image: "https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=400&q=80",
      description: "High-quality table potatoes, perfect for daily curries and baking."
    },
    {
      id: "prod_3",
      farmerId: "farmer_ramesh",
      name: "Fresh Spinach (Palak)",
      category: "vegetables",
      price: 25,
      stock: 40,
      organic: true,
      image: "https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=400&q=80",
      description: "Crispy, nutritious green spinach bundles. Cleaned and bundle packed."
    },
    {
      id: "prod_4",
      farmerId: "farmer_ananya",
      name: "Alphonso Mangoes",
      category: "fruits",
      price: 220,
      stock: 80,
      organic: true,
      image: "https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&w=400&q=80",
      description: "Premium, sweet Alphonso mangoes from local orchard. Chemical-free ripening."
    },
    {
      id: "prod_5",
      farmerId: "farmer_ananya",
      name: "Cavendish Bananas",
      category: "fruits",
      price: 50,
      stock: 150,
      organic: false,
      image: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=400&q=80",
      description: "Fresh and ripe bananas sold by the dozen. Nutrient-rich energy source."
    },
    {
      id: "prod_6",
      farmerId: "farmer_singh",
      name: "Premium Basmati Rice",
      category: "grains",
      price: 110,
      stock: 500,
      organic: true,
      image: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=400&q=80",
      description: "Long-grain aromatic basmati rice, aged for 1 year for exquisite fluffiness and taste."
    },
    {
      id: "prod_7",
      farmerId: "farmer_singh",
      name: "Whole Wheat Atta",
      category: "grains",
      price: 45,
      stock: 400,
      organic: true,
      image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=400&q=80",
      description: "Stone-ground whole wheat flour. Zero preservatives, retains all dietary fiber."
    },
    {
      id: "prod_8",
      farmerId: "farmer_ananya",
      name: "Organic Cow Ghee",
      category: "dairy",
      price: 650,
      stock: 50,
      organic: true,
      image: "https://images.unsplash.com/photo-1627308595229-7830a5c91f9f?auto=format&fit=crop&w=400&q=80",
      description: "Traditional A2 bilona method cow ghee, golden texture and heavenly aroma."
    },
    {
      id: "prod_9",
      farmerId: "farmer_ramesh",
      name: "Fresh Paneer",
      category: "dairy",
      price: 280,
      stock: 30,
      organic: false,
      image: "https://images.unsplash.com/photo-1631451095765-2c91616fc9e6?auto=format&fit=crop&w=400&q=80",
      description: "Soft, fresh paneer prepared daily from fresh dairy milk. No water dilution."
    },
    {
      id: "prod_10",
      farmerId: "farmer_ramesh",
      name: "Turmeric Powder",
      category: "herbs",
      price: 180,
      stock: 100,
      organic: true,
      image: "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=400&q=80",
      description: "High curcumin content organic turmeric powder, ground from sun-dried rhizomes."
    }
  ],
  orders: [
    {
      id: "order_101",
      customerId: "customer_gowdhaman",
      farmerId: "farmer_ramesh",
      deliveryId: "delivery_kartik",
      items: [
        { productId: "prod_1", name: "Organic Tomatoes", quantity: 3, price: 45 },
        { productId: "prod_9", name: "Fresh Paneer", quantity: 1, price: 280 }
      ],
      subtotal: 415,
      deliveryCharge: 40,
      total: 455,
      status: "delivered", // pending, accepted, picked_up, delivered
      date: "2026-06-25T11:00:00Z",
      deliveryAddress: "Flat 405, Orchid Heights, Indiranagar, Bengaluru",
      deliveryCoords: [12.978, 77.640],
      farmerCoords: [13.100, 77.596]
    },
    {
      id: "order_102",
      customerId: "customer_gowdhaman",
      farmerId: "farmer_ramesh",
      deliveryId: "delivery_kartik",
      items: [
        { productId: "prod_2", name: "Fresh Potatoes", quantity: 5, price: 30 },
        { productId: "prod_3", name: "Fresh Spinach (Palak)", quantity: 2, price: 25 }
      ],
      subtotal: 200,
      deliveryCharge: 40,
      total: 240,
      status: "accepted",
      date: "2026-06-27T10:00:00Z",
      deliveryAddress: "Flat 405, Orchid Heights, Indiranagar, Bengaluru",
      deliveryCoords: [12.978, 77.640],
      farmerCoords: [13.100, 77.596]
    }
  ],
  reviews: [
    {
      id: "rev_1",
      productId: "prod_1",
      customerId: "customer_gowdhaman",
      customerName: "Gowdhaman Dev",
      rating: 5,
      comment: "Absolutely fresh and juicy! Tastes miles better than store-bought hybrid tomatoes.",
      date: "2026-06-26"
    },
    {
      id: "rev_2",
      productId: "prod_9",
      customerId: "customer_gowdhaman",
      customerName: "Gowdhaman Dev",
      rating: 4,
      comment: "Very soft paneer. Made delicious paneer butter masala. Highly recommend.",
      date: "2026-06-26"
    }
  ],
  messages: [
    {
      id: "msg_1",
      senderId: "customer_gowdhaman",
      receiverId: "farmer_ramesh",
      content: "Hello Ramesh, are the tomatoes fresh enough for salads today?",
      timestamp: "2026-06-25T10:15:00Z"
    },
    {
      id: "msg_2",
      senderId: "farmer_ramesh",
      receiverId: "customer_gowdhaman",
      content: "Yes Gowdhaman, I harvested them just 2 hours ago. They are crisp and perfect!",
      timestamp: "2026-06-25T10:20:00Z"
    }
  ]
};

// Initialize localStorage with seedData if empty
function initializeDatabase() {
  if (!localStorage.getItem("agrilinker_db_initialized")) {
    localStorage.setItem("agrilinker_users", JSON.stringify(seedData.users));
    localStorage.setItem("agrilinker_products", JSON.stringify(seedData.products));
    localStorage.setItem("agrilinker_orders", JSON.stringify(seedData.orders));
    localStorage.setItem("agrilinker_reviews", JSON.stringify(seedData.reviews));
    localStorage.setItem("agrilinker_messages", JSON.stringify(seedData.messages));
    localStorage.setItem("agrilinker_db_initialized", "true");
    console.log("AgriLinker Mock Database initialized successfully.");
  }
}

initializeDatabase();

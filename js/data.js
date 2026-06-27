// ============================================================
// AgriLinker — Supabase Data Helpers
// Replaces localStorage mock DB — all reads/writes go to Supabase
// ============================================================

const DB = {
  // ── Products ────────────────────────────────────────────────
  async getProducts(filters = {}) {
    let query = supabaseClient.from("products").select(`
      *,
      farmer:profiles!farmer_id(id, name, rating, reviews_count, address, lat, lng)
    `);

    if (filters.category)  query = query.eq("category", filters.category);
    if (filters.organic)   query = query.eq("organic", true);
    if (filters.farmerId)  query = query.eq("farmer_id", filters.farmerId);
    if (filters.search)    query = query.ilike("name", `%${filters.search}%`);

    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) { console.error("getProducts error:", error); return []; }
    return data || [];
  },

  async getProductById(id) {
    const { data, error } = await supabaseClient.from("products")
      .select(`*, farmer:profiles!farmer_id(id, name, rating, reviews_count)`)
      .eq("id", id).single();
    if (error) return null;
    return data;
  },

  async addProduct(product) {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabaseClient.from("products").insert({
      ...product,
      farmer_id: user.id
    }).select().single();

    if (error) { console.error("addProduct error:", error); return null; }
    return data;
  },

  async updateProduct(id, updates) {
    const { data, error } = await supabaseClient.from("products")
      .update(updates).eq("id", id).select().single();
    if (error) { console.error("updateProduct error:", error); return null; }
    return data;
  },

  async deleteProduct(id) {
    const { error } = await supabaseClient.from("products").delete().eq("id", id);
    return !error;
  },

  // ── Orders ───────────────────────────────────────────────────
  async getOrders(role, userId) {
    let query = supabaseClient.from("orders").select(`
      *,
      customer:profiles!customer_id(id, name, phone),
      farmer:profiles!farmer_id(id, name, phone),
      delivery:profiles!delivery_id(id, name, phone),
      order_items(*)
    `);

    if (role === "customer") query = query.eq("customer_id", userId);
    if (role === "farmer")   query = query.eq("farmer_id",   userId);
    if (role === "delivery") query = query.eq("delivery_id", userId);

    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) { console.error("getOrders error:", error); return []; }
    return data || [];
  },

  async placeOrder(orderData, items) {
    // Insert the order
    const { data: order, error: orderErr } = await supabaseClient
      .from("orders").insert(orderData).select().single();

    if (orderErr) { console.error("placeOrder error:", orderErr); return null; }

    // Insert order items
    const itemRows = items.map(item => ({ ...item, order_id: order.id }));
    const { error: itemErr } = await supabaseClient.from("order_items").insert(itemRows);
    if (itemErr) console.error("order_items insert error:", itemErr);

    return order;
  },

  async updateOrderStatus(orderId, status) {
    const { data, error } = await supabaseClient.from("orders")
      .update({ status }).eq("id", orderId).select().single();
    if (error) { console.error("updateOrderStatus error:", error); return null; }
    return data;
  },

  // ── Reviews ──────────────────────────────────────────────────
  async getReviews(productId) {
    const { data, error } = await supabaseClient.from("reviews")
      .select("*").eq("product_id", productId).order("created_at", { ascending: false });
    if (error) return [];
    return data || [];
  },

  async addReview(review) {
    const { data, error } = await supabaseClient.from("reviews")
      .insert(review).select().single();
    if (error) { console.error("addReview error:", error); return null; }

    // Recalculate average rating for the product
    const { data: allReviews } = await supabaseClient.from("reviews")
      .select("rating").eq("product_id", review.product_id);

    if (allReviews && allReviews.length > 0) {
      const avg = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
      // Update farmer's profile rating (optional aggregate)
    }

    return data;
  },

  // ── Messages ─────────────────────────────────────────────────
  async getMessages(userId) {
    const { data, error } = await supabaseClient.from("messages")
      .select(`
        *,
        sender:profiles!sender_id(id, name),
        receiver:profiles!receiver_id(id, name)
      `)
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order("created_at", { ascending: true });

    if (error) { console.error("getMessages error:", error); return []; }
    return data || [];
  },

  async sendMessage(senderId, receiverId, content) {
    const { data, error } = await supabaseClient.from("messages").insert({
      sender_id:   senderId,
      receiver_id: receiverId,
      content
    }).select().single();

    if (error) { console.error("sendMessage error:", error); return null; }
    return data;
  },

  async markMessagesRead(userId, otherUserId) {
    await supabaseClient.from("messages")
      .update({ read: true })
      .eq("receiver_id", userId)
      .eq("sender_id", otherUserId);
  },

  // ── Profiles ─────────────────────────────────────────────────
  async getProfile(userId) {
    const { data, error } = await supabaseClient.from("profiles")
      .select("*").eq("id", userId).single();
    if (error) return null;
    return data;
  },

  async getAllFarmers() {
    const { data, error } = await supabaseClient.from("profiles")
      .select("*").eq("role", "farmer");
    if (error) return [];
    return data || [];
  },

  async getAllDeliveryAgents() {
    const { data, error } = await supabaseClient.from("profiles")
      .select("*").eq("role", "delivery");
    if (error) return [];
    return data || [];
  }
};

// ── Seed helper (run ONCE from browser console if needed) ────
// window.seedSupabase = async () => { ... };
// Tables should be seeded via Supabase SQL Editor or dashboard instead.

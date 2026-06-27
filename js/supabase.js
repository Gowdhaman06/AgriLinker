// ============================================================
// AgriLinker — Supabase Client Initializer
// All other JS files import supabaseClient from this module
// ============================================================

const SUPABASE_URL  = "https://gkyyzqjakntqsoqkxhch.supabase.co";
const SUPABASE_ANON = "sb_publishable_Dq1Cch2YW7k7ILULASRE9Q_9qxjalqS";

// supabase is loaded via CDN UMD build (window.supabase)
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Expose globally so all other scripts can use it
window.supabaseClient = supabaseClient;

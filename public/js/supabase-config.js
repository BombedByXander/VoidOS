window.XANDERSUPABASE_URL = "https://ljmycyhjagwwjlkitpht.supabase.co";
window.XANDERSUPABASE_PUBLISHABLE_KEY = "sb_publishable_253EPMx1DR3NvZgU-BMoSw_0Dlhmdv3";

if (window.supabase?.createClient) {
  window.xandersSupabase = window.supabase.createClient(
    window.XANDERSUPABASE_URL,
    window.XANDERSUPABASE_PUBLISHABLE_KEY,
  );
}

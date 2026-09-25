window.SITE_AUTH = {
  supabaseUrl: 'https://xuzolqglwlgvsazlojsy.supabase.co',
  publishableKey: 'sb_publishable_vP0WCXtMMSbgsnXmwjVLFQ_qleCkmhr',
  turnstileSiteKey: '0x4AAAAAAFDg9jXsid6POuHt'
};

window.getSupabase = function getSupabase() {
  if (!window.supabase || !window.supabase.createClient) {
    throw new Error('Supabase library is not loaded.');
  }
  if (!window.__supabaseClient) {
    window.__supabaseClient = window.supabase.createClient(
      window.SITE_AUTH.supabaseUrl,
      window.SITE_AUTH.publishableKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );
  }
  return window.__supabaseClient;
};

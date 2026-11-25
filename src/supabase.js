import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  document.body.innerHTML =
    '<p style="padding:2rem;font-family:sans-serif">Configurazione mancante: ' +
    'imposta VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.</p>';
  throw new Error('Supabase non configurato');
}

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

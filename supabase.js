import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// Le variabili di Cloudflare (se impostate) hanno la precedenza su config.js
const url = import.meta.env.VITE_SUPABASE_URL || SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY;

if (!url || !key || url.includes('INCOLLA-QUI') || key.includes('INCOLLA-QUI')) {
  document.body.innerHTML =
    '<p style="padding:2rem;font-family:sans-serif">Configurazione mancante: ' +
    'inserisci URL e chiave anon di Supabase nel file <b>src/config.js</b>.</p>';
  throw new Error('Supabase non configurato');
}

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

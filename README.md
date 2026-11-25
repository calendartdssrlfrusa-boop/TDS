# Renko Calendar — Sito

Calendario condiviso per gruppi di lavoro. Supabase (dati e login) · GitHub · Cloudflare.

## PASSO 2 — GitHub
Carica **il contenuto** di questa cartella nella radice del repository
(devono vedersi subito `package.json`, `index.html`, `src/`, `public/`, `wrangler.jsonc`).
La cartella `node_modules` non va caricata.

## PASSO 3 — Cloudflare
Workers & Pages → Create → **Import a repository** → scegli il repository.

Impostazioni:
- **Build command**: `npm run build`
- **Deploy command**: `npx wrangler deploy`
- **Root directory**: `/`
- **Build variables** (nella sezione Build, non "Variables and Secrets"):
  - `VITE_SUPABASE_URL` = Project URL di Supabase
  - `VITE_SUPABASE_ANON_KEY` = chiave anon / publishable

Il nome del Worker deve essere uguale a `"name"` in `wrangler.jsonc` (ora `tds`).

## PASSO 4 — Prova
Apri l'indirizzo `.workers.dev`, entra con l'utente creato su Supabase.

## Sviluppo in locale (facoltativo)
```bash
cp .env.example .env    # metti URL e chiave
npm install
npm run dev             # http://localhost:5173
```

## Struttura
```
index.html        pagine (accesso, calendario, finestre)
src/main.js       logica
src/style.css     grafica (desktop, telefono, tema scuro)
src/supabase.js   connessione a Supabase
public/           icone e installazione come app sul telefono
wrangler.jsonc    configurazione Cloudflare
```

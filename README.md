# Renko Calendar

Calendario condiviso in cloud per gruppi di lavoro.
**Stack:** Supabase (database + login) · GitHub (codice) · Cloudflare Pages (sito).

## Cosa fa (v0.1)

- Iscrizione / accesso con email e password, recupero password
- Impegni con data, ora, "tutto il giorno", luogo, note, flag **privato**
- Viste Mese / Settimana / Giorno / Agenda, trascina per spostare o allungare
- **Gruppi di lavoro** (es. TDS): chi crea il gruppo ottiene un **codice invito** da dare ai colleghi
- Pannello a destra con i colleghi:
  - spunta per mostrare/nascondere ciascun collega **nel tuo** calendario
  - interruttore "Rendi visibili i miei impegni a questo gruppo" (privacy, vale per gli altri)
- Aggiornamento in tempo reale quando un collega modifica qualcosa
- **App per telefono**: è installabile (PWA) — da Chrome Android "Aggiungi a schermata Home",
  da Safari iPhone "Condividi → Aggiungi alla schermata Home". Si apre a tutto schermo con l'icona.

La sicurezza è tutta lato database (Row Level Security): anche usando la chiave anon
nessuno può leggere impegni di persone con cui non condivide un gruppo, né quelli privati.

---

## 1. Supabase

Va preparato prima, con il pacchetto **renko-calendar-supabase** (vedi il suo README).
Ti servono `Project URL` e `anon public key` (Supabase → Project Settings → API).

## 2. GitHub

```bash
git init
git add .
git commit -m "Renko Calendar v0.1"
git branch -M main
git remote add origin https://github.com/<tuo-utente>/renko-calendar.git
git push -u origin main
```

## 3. Cloudflare Pages

1. Workers & Pages → Create → Pages → **Connect to Git** → scegli il repo.
2. Framework preset: **Vite** (oppure: build command `npm run build`, output `dist`).
3. **Environment variables** (Production e Preview):
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = anon key
   - `VITE_ACCESSO_LIBERO` = `1` → per ora: si entra senza iscrizione (utente ospite).
     Quando vuoi gli accessi veri cancellala e rifai il deploy.
4. Deploy. Ottieni un indirizzo tipo `renko-calendar.pages.dev` (puoi collegare un tuo dominio).

## 4. Torna su Supabase (importante per le email)

(è anche nel README di renko-calendar-supabase)

**Authentication → URL Configuration**
- Site URL: `https://renko-calendar.pages.dev` (o il tuo dominio)
- Redirect URLs: aggiungi lo stesso indirizzo e `http://localhost:5173`

Senza questo, i link di conferma/recupero password nelle email puntano a localhost.

> Le email gratuite di Supabase hanno un limite basso (poche all'ora).
> Quando lo dai ai colleghi conviene impostare un SMTP tuo in
> Authentication → Emails → SMTP Settings (es. Brevo, Resend, o la casella del dominio).

## 5. Primo utilizzo

1. Apri il sito → **Iscriviti** → conferma l'email → accedi.
2. Pannello a destra → **+ Crea gruppo** → "TDS" → copia il codice invito.
3. Manda il codice ai colleghi: si iscrivono e fanno **Entra con codice**.

## Sviluppo in locale

```bash
cp .env.example .env   # e metti URL + anon key
npm install
npm run dev            # http://localhost:5173
```

## Struttura

```
src/main.js              tutta la logica dell'app
src/style.css            grafica (desktop + telefono + tema scuro)
src/supabase.js          connessione a Supabase
public/                  icone, manifest e service worker (installazione come app)
```

## Prossimi passi possibili

- App Android: pacchetto **renko-calendar-apk** (apre questo sito, si compila su GitHub)
- App per PC (Tauri o Electron, oppure semplicemente installare la PWA da Chrome/Edge)
- Notifiche/promemoria, impegni ripetuti, impegni assegnati al gruppo, export .ics

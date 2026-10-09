# History Barber da Francesco

Sito vetrina e sistema di prenotazione del barbiere di Via Ca' Rossa 47/A-B, Mestre (VE).
Next.js 16 (App Router), React 19, Tailwind CSS 4.

- **Produzione:** https://history-barber-da-francesco.vercel.app
- **Documentazione completa:** [`PRODUCTION_BIBLE.md`](./PRODUCTION_BIBLE.md) — architettura, scelte, trappole, debito noto. Da leggere prima di toccare il codice.

## Avvio in locale

```bash
npm install
cp .env.example .env.local   # poi riempi i valori che ti servono
npm run dev                  # http://localhost:3000
```

Il sito parte anche senza nessuna variabile d'ambiente. Senza `DATABASE_URL` le
prenotazioni finiscono in un database locale su file (`.data/agenda`, PGlite) che
resta fra un riavvio e l'altro; senza `AUTH_SECRET` e `ADMIN_PASSWORD` l'agenda non
è raggiungibile; senza Telegram nessuno riceve gli avvisi.

## Variabili d'ambiente

Tutte in `.env.local` (git le ignora) e, in produzione, su Vercel →
Settings → Environment Variables. L'elenco commentato è in [`.env.example`](./.env.example).

| Variabile | Serve a | Se manca |
|---|---|---|
| `DATABASE_URL` | Database Postgres delle prenotazioni (Neon, Supabase, Vercel…). Vale anche `POSTGRES_URL` | In locale: Postgres su file in `.data/agenda` (PGlite). Su Vercel: in memoria, si azzera |
| `AUTH_SECRET` | Firma dei cookie di sessione dell'agenda. Generala con `npx auth secret` | Nessuno può entrare in `/admin` |
| `ADMIN_PASSWORD` | Password unica per entrare in `/admin` | Come sopra |
| `AUTH_URL` | Solo se il sito gira su un dominio diverso da quello di Vercel | Su Vercel viene ricavata da sola |
| `TELEGRAM_BOT_TOKEN` | Bot che avvisa il titolare a ogni prenotazione (`@BotFather` → `/newbot`) | L'avviso finisce solo nei log del server |
| `TELEGRAM_CHAT_ID` | Chat a cui mandare l'avviso (`https://api.telegram.org/bot<TOKEN>/getUpdates`) | Come sopra |

## Database

Lo schema sta in [`db/schema.ts`](./db/schema.ts): tabella `prenotazioni` con
appuntamenti e blocchi (pause, assenze), più il vincolo di esclusione che impedisce
due voci sovrapposte sullo stesso operatore. Il controllo è nel database, l'unico
posto dove due richieste simultanee non passano entrambe.

**In locale non serve niente:** senza `DATABASE_URL` l'app crea da sola
`.data/agenda` (Postgres su file, via PGlite) e ci applica lo schema. È lo stesso SQL
della produzione. Per ripartire da zero: spegni il server e cancella `.data/`.
Non avviare due server contemporaneamente sulla stessa cartella.

**In produzione** serve un Postgres vero con l'estensione `btree_gist` (Neon,
Supabase e Vercel ce l'hanno):

```bash
npm run db:init    # applica lo schema al database di DATABASE_URL; è rieseguibile (Node 22.18+)
```

**Neon (configurato il 27/09/2026).** Il progetto è collegato a Neon, progetto `polished-glitter-73416212` ("Francoforte"), regione AWS eu-central-1 (Francoforte, dati in UE). Anche le funzioni di Vercel girano a Francoforte (`vercel.json` → `fra1`). `neon link` scrive `DATABASE_URL` (pooler), `DATABASE_URL_UNPOOLED` e `NEON_BRANCH` in `.env.local`; lo schema è già applicato. Due branch: `production` (lo usa Vercel, variabile `DATABASE_URL` impostata sul progetto) e `sviluppo` (lo usa `.env.local`, per le prove in locale). `.neon` punta a `sviluppo`: `neon deploy` senza `--branch` agisce lì. Per tornare a lavorare su produzione in locale: `neon checkout production`. `neon.ts` è la configurazione del CLI (`neon config plan` / `neon deploy`): l'app non lo usa.

## Comandi

| Comando | Cosa fa |
|---|---|
| `npm run dev` | Sviluppo con Turbopack |
| `npm run build` | Build di produzione |
| `npm start` | Serve la build |
| `npm run lint` | ESLint (config flat) |
| `npm run db:init` | Applica `db/schema.ts` al Postgres di `DATABASE_URL` |

## Mappa veloce

| Dove | Cosa |
|---|---|
| `lib/salone.ts` | **Sorgente unica** dei contenuti: dati del salone, orari, listino, portfolio, menu |
| `components/` | Sezioni del sito e widget di prenotazione (`BookingWidget.tsx`) |
| `lib/prenotazioni/` | Tipi, algoritmo degli orari, validazione, archivio, avvisi |
| `app/api/bookings/` | `GET` orari liberi · `POST` nuova prenotazione |
| `app/admin/` | Agenda protetta da Auth.js: pagina server + Server Action (`azioni.ts`) |
| `components/agenda/` | Agenda interattiva: navigazione fra i giorni, calendario, fogli per creare, modificare, disdire e bloccare |
| `auth.ts`, `auth.config.ts`, `middleware.ts` | Accesso all'agenda |
| `app/admin/lookbook/`, `app/stile/`, `lib/lookbook/` | Lookbook personale: schede dei clienti con foto e note del taglio (lato barbiere) e "Il mio stile" con link personale e copia offline (lato cliente). Vedi §6.14 della bible |

## Prima di prendere appuntamenti veri

Vedi §11 della production bible: prezzi e durate da confermare, P.IVA, foto reali,
e la verifica del numero di telefono del cliente.

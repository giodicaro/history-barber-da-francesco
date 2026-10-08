# History Barber — PWA

App web installabile per **History Barber da Francesco** (Mestre): vetrina del salone, prenotazione online in 5 passi con orari calcolati dal server, funzionamento offline con coda delle richieste, promemoria push 24 ore e 2 ore prima dell'appuntamento.

È un'app autonoma, separata dal sito Next.js che sta nella cartella madre del repository: HTML, CSS e moduli ES scritti a mano, senza build; il backend è Node + Express + SQLite.

---

## Avvio rapido (italiano)

Serve **Node.js 20.12 o successivo**.

```bash
cd history-barber-pwa
npm install        # dipendenze (better-sqlite3 usa binari precompilati)
npm run vapid      # crea server/.env con le chiavi per le notifiche push
npm start          # http://localhost:3000
```

- **Cambiare dati, orari, barbieri, servizi e prezzi:** modifica solo `public/data/shop.json` e ricarica la pagina. Il server rilegge il file al riavvio (`npm start`).
- **Provare una notifica:** apri l'app, prenota e tocca «Sì, avvisami» (oppure Contatti → Promemoria → «Attiva i promemoria»), poi `npm run push:test`. Toccando la notifica si apre la prenotazione.
- **Test automatici:** `npm test` (regole degli orari, API, prenotazioni doppie, cutoff, ora legale).
- **Modalità demo:** se i file di `public/` sono pubblicati su un hosting statico senza server, l'app lo rileva e funziona in locale (fascia rossa «Modalità demo»: le prenotazioni restano sul dispositivo). Si può forzare con `?mock`.

⚠️ **Prezzi e durate sono valori di esempio** (`"sample": true` in `shop.json`): nessuna fonte pubblica li riporta. Vanno confermati con il salone. Indirizzo, telefono e orari vengono dalla scheda Fresha pubblica (settembre 2026). Anche le date di chiusura festiva sono di esempio. L'informativa privacy è un modello **da far revisionare**.

---

## Technical notes (English)

### Structure

```text
history-barber-pwa/
├── public/                     static app (served as-is)
│   ├── index.html              single page: hero, services, team, booking, manage, contacts
│   ├── offline.html            branded offline fallback
│   ├── privacy.html            privacy notice template (flagged for review)
│   ├── manifest.webmanifest
│   ├── sw.js                   service worker
│   ├── css/styles.css
│   ├── js/
│   │   ├── app.js              bootstrap, SW registration + update toast, install UX, nav, routing
│   │   ├── api.js              API adapter: real backend or local mock
│   │   ├── booking.js          booking state machine, confirmation, offline queue view, manage screen
│   │   ├── notifications.js    permission, subscription, local notifications, settings panel
│   │   ├── outbox.js           IndexedDB queue shared by page and SW (classic script)
│   │   ├── store.js            guarded localStorage helpers
│   │   ├── ui.js               DOM helpers, Italian formatting, .ics
│   │   └── shared/             pure modules used by browser AND server
│   │       ├── time.js         Europe/Rome conversions without a tz library
│   │       ├── slots.js        slot engine
│   │       └── validation.js   customer-data validation (Italian messages)
│   ├── data/shop.json          shop config (the only file to edit for content)
│   ├── fonts/                  self-hosted Bodoni Moda + Figtree (OFL)
│   └── icons/                  generated PNGs + SVG source
├── server/
│   ├── index.js                Express app (static + /api), security headers
│   ├── bookings.js             availability, atomic create, cancel/reschedule, tokens
│   ├── db.js                   SQLite schema and statements
│   ├── push.js                 web-push wrapper, reminder scheduler, email/SMS hook point
│   ├── ratelimit.js            in-memory per-IP limiter
│   └── .env.example
├── scripts/                    generate-icons.mjs, generate-vapid.mjs, push-test.mjs
├── test/                       slots.test.js, api.test.js (node:test), e2e.mjs (Playwright)
└── docs/PLAN.md                plan, architecture, risks
```

### Environment variables (`server/.env`)

| Variable | Purpose | Default |
|---|---|---|
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Web Push keys (`npm run vapid`; `--force` rotates them and invalidates all subscriptions) | none → push disabled, the UI says so |
| `VAPID_SUBJECT` | `mailto:` or `https:` contact for push services. **Change it** before production | `mailto:changeme@example.com` |
| `PORT` | HTTP port | `3000` |
| `BOOKING_SECRET` | HMAC key for booking tokens | generated once into `storage/booking-secret` |
| `DATA_DIR` | Folder for the SQLite DB and secret | `./storage` |
| `TRUST_PROXY` | Express `trust proxy` (e.g. `1`, `loopback`) so rate limiting sees client IPs | off |
| `RATE_LIMIT_READ`, `RATE_LIMIT_WRITE` | Requests per IP per 5 min (GET) / 15 min (writes) | `600` / `30` |

### API

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | `{ ok, push }` |
| GET | `/api/shop` | contents of `shop.json` |
| GET | `/api/days?service=&barber=` | each date in the window with free-slot count |
| GET | `/api/availability?date=&service=&barber=` | slots for one day (`barber=any` for "Primo disponibile") |
| POST | `/api/bookings` | 201 created · 200 idempotent replay (same `clientRequestId`) · 409 slot taken · 422 per-field errors · 429 too many active bookings or rate limit |
| GET | `/api/bookings/:id` | header `X-Booking-Token` |
| POST | `/api/bookings/:id/cancel` · `/reschedule` | token in header or body; 403 after the cutoff |
| GET | `/api/push/public-key` | 503 when push is not configured |
| POST | `/api/push/subscribe` | `{ subscription, bookingId?, token?, oldEndpoint? }` |
| POST | `/api/push/unsubscribe` | `{ endpoint }` |

### How the key pieces work

- **Slots** are computed on the server (`public/js/shared/slots.js`) from opening shifts, service duration (must end before the shift closes), the barber's bookings, closed weekdays/dates, a minimum notice (60 min) and the booking window (21 days). Wall-clock times are in Europe/Rome; instants are UTC ms. The conversion re-checks the offset after the first guess, so DST days are right (tested on 29 Mar and 25 Oct 2026).
- **No double booking.** `better-sqlite3` is synchronous, so "check slot + insert" runs in one transaction with nothing interleaving in the process. SQLite triggers reject overlapping confirmed bookings too, in case two processes share the file. Tested with 10 parallel requests for one slot: one 201, nine 409.
- **Tokens** are `HMAC(secret, bookingId)`: nothing secret is stored, and the offline queue's retries get the same token back. The manage link is `#gestisci/<id>/<token>`. It lives in the URL fragment, so it never reaches server logs.
- **Offline queue.** With no connection, the booking goes into IndexedDB (`outbox.js`) and shows «In attesa di invio». It is never shown as confirmed before the server answers. It is sent by Background Sync (Chromium) or, as a fallback, on the page's `online` event (Safari, Firefox). A 409 at send time shows «Orario non disponibile» with «Scegli un altro orario».
- **Service worker** (`sw.js`): versioned caches. Navigations are network-first (4 s), then the cached page, then `offline.html`. Public API GETs (`shop`, `days`, `availability`) are network-first (3 s) with a cache fallback, marked `X-HB-From-Cache` so the UI warns that slots may be stale. Personal data and non-GET requests are never cached. Static assets use stale-while-revalidate.
- **Update flow:** a new worker waits, the page shows «Nuova versione disponibile — Aggiorna», the tap posts `SKIP_WAITING`, and the page reloads once on `controllerchange`. **Bump `VERSION` in `sw.js` on every deploy.**
- **Reminders:** a scheduler (every minute) sends pushes 24 h and 2 h before, to subscriptions linked to the booking. A reminder whose window had already started when the booking was made is skipped. `410/404` subscriptions are deleted. Email/SMS: register a function in `reminderHooks` (`server/push.js`). None is configured.
- **Abuse protection:** shared validation and sanitisation, a 10 kB body limit, per-IP rate limits, at most 2 active bookings per phone or email, and a strict CSP with no inline scripts or styles.
- **Retention:** bookings are deleted 365 days after the appointment (`booking.retentionDays`), at startup and daily.

### Deploy notes

- **HTTPS is mandatory** for service workers, install and push (only `localhost` is exempt).
- Run behind a reverse proxy (nginx, Caddy) with `TRUST_PROXY=1`. Keep a **single Node process**: the in-memory rate limiter and the reminder scheduler assume one instance (the DB triggers still prevent double booking across processes).
- **Subfolder hosting works.** All URLs are relative, and `scope`/`start_url` are `./`. Mount the whole app (static + API) under the same prefix and strip it in the proxy:

  ```nginx
  location /barber/ { proxy_pass http://127.0.0.1:3000/; proxy_set_header Host $host; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; }
  ```

  Verified with the app mounted at `/barber/`: SW scope `/barber/`, API reachable, no demo fallback.
- `og:image` is relative (`icons/icon-512.png`). Set an absolute URL once the domain is known.
- Back up `storage/` (database + token secret).

### Assumptions and decisions

1. **Separate app, same repo.** The Next.js site already has its own booking system and agenda. This PWA follows the requested vanilla stack in `history-barber-pwa/`, so the production site is not touched. The root ESLint config ignores this folder.
2. **Real shop data where it exists:** address, phone and hours come from the existing site's `lib/salone.ts` (sources: Fresha, Instagram). Prices and durations are flagged `sample`, and the UI says «Prezzi indicativi». Festive closed dates are samples.
3. **One barber (Francesco):** no other names are invented. Step 1 still offers «Primo disponibile», and the engine and tests handle several barbers. To add one, append it to `barbers` in `shop.json`.
4. Slot step 15 min, notice 60 min, window 21 days, cutoff 120 min, max 2 active bookings per contact: all in `shop.json → booking`.
5. The **Android install banner is non-modal** (`role="dialog"`, labelled, Esc dismisses) so it never traps focus over the page. The **iOS guide is a modal `<dialog>`**, which gives a native focus trap and Esc. A dismissal is remembered for 14 days.
6. **"Ripeti l'ultimo taglio"** stores barber, service and the contact details on the device only (localStorage). This is stated in the privacy notice.
7. **.ics is generated client-side** (UTC times, 2 h alarm), so it also works in demo mode and offline.
8. Fonts: Bodoni Moda (display) + Figtree (text), self-hosted, about 52 kB in total, preloaded, `font-display: swap`.
9. The confirmation's local notification uses `registration.showNotification()`. Permission is asked only from «Sì, avvisami» or the settings toggle. «No, grazie» is remembered, so the app does not ask again.
10. SQLite file under `storage/`. If `better-sqlite3` cannot be installed on a platform, swap `server/db.js` for another driver: the rest of the code only uses its exported functions.

### Known limitations

- **iOS:** Web Push works only once the PWA is added to the Home screen (iOS/iPadOS 16.4+). The UI detects this and shows the install guide instead of a dead toggle. iOS has no Background Sync: queued bookings are sent when the app is open and back online.
- **Email/SMS reminders are hooks only** (`reminderHooks` in `server/push.js`).
- **Cached availability can be stale offline.** The UI says so, and the server re-validates at send time (409).
- Single-process design (see Deploy notes).
- Blob downloads of `.ics` can be clunky inside an installed iOS PWA. The booking link is also in the event description.

### Verification

#### What was run here (8 Oct 2026, Node 22.22, Chromium 141 headless via Playwright 1.56)

| Check | Result |
|---|---|
| `npm test`: 26 unit/API tests (slots, DST, validation, 409 race, idempotency, per-contact limit, reschedule, cancel cutoff, push routes, reminder windows, rate limit) | ✅ 26/26 |
| `test/e2e.mjs` in Chromium: SW control, installability (CDP `Page.getInstallabilityErrors` = none), full booking + .ics, manage/cancel, repeat-last, 409 → step 3, offline queue → confirmed on reconnect, offline.html, push event (JSON and empty payload) → notification, NAVIGATE to `#booking`, iOS guide (emulated UA), SW update toast → new version, no console errors | ✅ 12 passed, 1 skipped |
| Real `pushManager.subscribe()` in the browser | ⏭ skipped: this sandbox blocks Google's push registration servers |
| `npm run push:test` against a stored FCM endpoint | ✅ the server reached FCM, got 410, removed the subscription |
| Mock mode on a plain static server (`http-server public`) | ✅ demo banner, full booking, push panel explains it is unavailable |
| Subfolder hosting (`/barber/`) | ✅ |
| axe-core 4.10 (WCAG 2.2 AA + best practices), dark and light: home, steps 2–4 with errors, iOS dialog | ✅ 0 violations |
| **Lighthouse 13.5.0, mobile (simulated throttling)** | **Performance 100 · Accessibility 100 · Best Practices 100 · SEO 100** (FCP 1.3 s, LCP 1.6 s, TBT 40 ms, CLS 0.028) |

Re-run the browser checks with `NODE_PATH="$(npm root -g)" node test/e2e.mjs` (it starts its own server on a temporary database).

#### Manual checklist on real devices (not possible here)

**Android, Chrome** (over HTTPS, e.g. a tunnel or the deployed server)
- [ ] Install: after a few seconds the banner «Aggiungi History Barber alla Home…» appears → «Installa» → system dialog → icon on the Home screen with the scissors (adaptive/maskable shape looks right).
- [ ] The app opens standalone with the dark status bar. The shortcut «Prenota ora» (long-press the icon) opens `#booking`.
- [ ] Offline: open the app, enable airplane mode, reload → it works. Book → «In attesa di invio». Disable airplane mode (app open or closed) → «Prenotazione confermata» (toast, or a notification if the app was closed and notifications are allowed).
- [ ] Push: book → «Sì, avvisami» → allow → immediate local «Prenotazione confermata». Run `npm run push:test` on the server → notification arrives. Tap it → the app opens/focuses at the booking section.
- [ ] Update: change something, bump `VERSION` in `sw.js`, deploy, reopen the app → toast «Nuova versione disponibile» → «Aggiorna» → reload with the new version.

**iOS / iPadOS 16.4+, Safari**
- [ ] The banner shows «Come fare» → step-by-step guide (Share → «Aggiungi alla schermata Home» → «Aggiungi»).
- [ ] The installed app opens standalone, the status bar is readable, and nothing hides behind the notch or home indicator (safe areas).
- [ ] In Safari (not installed), Contatti → Promemoria explains that the app must be installed first.
- [ ] Installed app: «Attiva i promemoria» → iOS permission prompt → `npm run push:test` → notification → tap opens `#booking`.
- [ ] Offline: airplane mode → the app opens from cache. A booking is queued and is sent when you reopen the app online (no Background Sync on iOS).
- [ ] Update toast as on Android.

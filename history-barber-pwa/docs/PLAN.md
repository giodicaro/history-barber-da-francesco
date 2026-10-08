# Plan — History Barber PWA

## Goal

A mobile-first, installable PWA for History Barber (Mestre): shop showcase,
5-step booking with server-side slots, offline resilience and Web Push
reminders. Vanilla HTML/CSS/ES modules, no build step; Node + Express +
SQLite backend.

## Architecture

```text
browser                                   server (Node ≥20, Express 5)
───────                                   ─────────────────────────────
index.html ─ app.js (bootstrap, SW, install UX, nav, routing)
            ├ booking.js  (state machine) ─┐
            ├ notifications.js            ├─ api.js ── fetch ──▶ /api/*  ─▶ bookings.js ─▶ db.js (SQLite)
            └ shared/*.js ◀── same files ──┼──────────── imported by ────▶ server            push.js (web-push, scheduler)
sw.js ─ precache, fetch strategies,        └─ mock (localStorage) when no backend
        push, notificationclick, sync ─▶ js/outbox.js (IndexedDB queue, shared page/SW)
```

- **One source of truth for rules.** `public/js/shared/{time,slots,validation}.js`
  are pure ES modules imported both by the browser (mock mode, inline
  validation) and by the server. The same slot engine runs in tests.
- **Shop data** lives in `public/data/shop.json`; the server reads the same file.
- **Booking tokens** are `HMAC(secret, bookingId)`: nothing secret is stored in
  the DB, and an idempotent replay (offline queue retry) can return the same
  token again.
- **Concurrency.** `better-sqlite3` is synchronous, so "check slot + insert"
  runs inside one transaction with no interleaving in a single process. A
  SQLite trigger rejects overlapping confirmed bookings as a second line of
  defence (e.g. two processes on the same file).
- **Timezone.** All instants are stored as UTC milliseconds. Wall-clock times
  in Europe/Rome are converted with `Intl.DateTimeFormat` (no tz library),
  re-checking the offset after the first guess so DST days are correct.

## Vertical slices

1. Server + data: shop.json, SQLite schema, slot engine, tests.
2. API: availability, days, bookings (create/read/cancel/reschedule), push routes.
3. Frontend shell: layout, sections rendered from shop.json, nav.
4. Booking stepper, manage screen, "repeat last cut", .ics.
5. Service worker: precache, strategies, offline queue + Background Sync.
6. Install UX: Android banner, iOS guide.
7. Push: permission UI, subscribe, local notification, reminders scheduler.
8. Polish: a11y, Lighthouse, offline/update tests with Playwright.

## Risks

| Risk | Mitigation |
|---|---|
| iOS push works only in an installed PWA (16.4+) | Detect iOS non-standalone, explain and show the install guide instead of a dead toggle |
| Double booking under concurrency | Sync transaction + DB trigger; race test with 10 parallel requests |
| DST / timezone bugs | Instants in UTC, Intl-based conversion, tests on 29 Mar and 25 Oct 2026 |
| Offline retry creates duplicates | `clientRequestId` unique column → server returns the existing booking |
| Stale cached availability offline | UI says data may be stale; server re-validates and answers 409 |
| SW update stuck on old version | Waiting worker detected, toast, `SKIP_WAITING` on tap, reload on `controllerchange` |
| Push keys missing | Server starts anyway; push UI hides itself; `npm run vapid` documented |

// Express app: serves the static PWA from /public and the JSON API under /api.
// `createApp` is exported for the tests; running this file starts the server.

import express from "express";
import compression from "compression";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { openDb } from "./db.js";
import { createBookingService, BookingError } from "./bookings.js";
import { createPush } from "./push.js";
import { rateLimit } from "./ratelimit.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function loadShop(publicDir = join(ROOT, "public")) {
  return JSON.parse(readFileSync(join(publicDir, "data", "shop.json"), "utf8"));
}

// Booking tokens are signed with this secret. Taken from the environment or
// generated once and kept next to the database, so `npm start` works with no
// manual setup and tokens survive restarts.
function loadSecret(env, dataDir) {
  if (env.BOOKING_SECRET) return env.BOOKING_SECRET;
  const file = join(dataDir, "booking-secret");
  if (existsSync(file)) return readFileSync(file, "utf8").trim();
  mkdirSync(dataDir, { recursive: true });
  const secret = randomBytes(32).toString("base64url");
  writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}

const SECURITY_HEADERS = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "img-src 'self' data:",
    "style-src 'self'",
    "script-src 'self'",
    "font-src 'self'",
    "connect-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cross-Origin-Opener-Policy": "same-origin",
};

export function createApp({
  env = process.env,
  dataDir = env.DATA_DIR ? resolve(env.DATA_DIR) : join(ROOT, "storage"),
  dbPath = join(dataDir, "history-barber.sqlite"),
  publicDir = env.STATIC_DIR ? resolve(env.STATIC_DIR) : join(ROOT, "public"),
  now = Date.now,
  log = console,
} = {}) {
  const shop = loadShop(publicDir);
  const db = openDb(dbPath);
  const bookings = createBookingService({ db, shop, secret: loadSecret(env, dataDir), now });
  const push = createPush({ db, shop, env, now, log });

  const app = express();
  app.disable("x-powered-by");
  if (env.TRUST_PROXY) app.set("trust proxy", env.TRUST_PROXY === "true" ? true : env.TRUST_PROXY);
  app.use(compression());
  app.use((req, res, next) => {
    res.set(SECURITY_HEADERS);
    next();
  });

  /* ── API ─────────────────────────────────────────────────────────────── */

  const api = express.Router();
  api.use(express.json({ limit: "10kb" }));
  api.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  const readLimit = rateLimit({ windowMs: 5 * 60_000, max: Number(env.RATE_LIMIT_READ ?? 600), now });
  const writeLimit = rateLimit({ windowMs: 15 * 60_000, max: Number(env.RATE_LIMIT_WRITE ?? 30), now });
  api.use((req, res, next) => (req.method === "GET" ? readLimit : writeLimit)(req, res, next));

  const token = (req) => req.get("X-Booking-Token") ?? req.body?.token;

  api.get("/health", (req, res) => res.json({ ok: true, push: push.enabled }));

  api.get("/shop", (req, res) => res.json(shop));

  api.get("/days", (req, res) => {
    res.json({ days: bookings.days({ serviceId: String(req.query.service ?? ""), barberId: String(req.query.barber ?? "any") }) });
  });

  api.get("/availability", (req, res) => {
    const date = String(req.query.date ?? "");
    const slots = bookings.availability({
      date,
      serviceId: String(req.query.service ?? ""),
      barberId: String(req.query.barber ?? "any"),
    });
    res.json({ date, slots: slots.map(({ time, startUtc, barberIds }) => ({ time, startUtc, barberIds })) });
  });

  api.post("/bookings", (req, res) => {
    const { booking, token: t, replayed } = bookings.create(req.body ?? {});
    res.status(replayed ? 200 : 201).json({ booking: bookings.present(booking), token: t });
  });

  api.get("/bookings/:id", (req, res) => {
    res.json({ booking: bookings.present(bookings.authorized(req.params.id, token(req))) });
  });

  api.post("/bookings/:id/cancel", (req, res) => {
    res.json({ booking: bookings.present(bookings.cancel(req.params.id, token(req))) });
  });

  api.post("/bookings/:id/reschedule", (req, res) => {
    const { date, time, barberId } = req.body ?? {};
    res.json({ booking: bookings.present(bookings.reschedule(req.params.id, token(req), { date, time, barberId })) });
  });

  api.get("/push/public-key", (req, res) => {
    if (!push.enabled) return res.status(503).json({ error: "push_disabled", message: "Notifiche non configurate." });
    res.json({ publicKey: push.publicKey });
  });

  const validSubscription = (s) =>
    s && typeof s.endpoint === "string" && /^https:\/\//.test(s.endpoint) && s.endpoint.length < 1024 &&
    typeof s.keys?.p256dh === "string" && typeof s.keys?.auth === "string";

  api.post("/push/subscribe", (req, res) => {
    const { subscription, bookingId, oldEndpoint } = req.body ?? {};
    if (!validSubscription(subscription)) return res.status(422).json({ error: "invalid_subscription" });
    db.saveSubscription(subscription, now());
    if (typeof oldEndpoint === "string" && oldEndpoint !== subscription.endpoint)
      db.migrateSubscription(oldEndpoint, subscription.endpoint);
    if (bookingId) {
      // Only the holder of the booking token may attach reminders to it.
      bookings.authorized(bookingId, token(req));
      db.linkSubscription(bookingId, subscription.endpoint);
    }
    res.status(201).json({ ok: true });
  });

  api.post("/push/unsubscribe", (req, res) => {
    const endpoint = req.body?.endpoint;
    if (typeof endpoint === "string") db.deleteSubscription(endpoint);
    res.json({ ok: true });
  });

  api.use((req, res) => res.status(404).json({ error: "not_found" }));

  api.use((err, req, res, _next) => {
    if (err instanceof BookingError)
      return res.status(err.status).json({ error: err.code, message: err.message, fields: err.details });
    if (err.type === "entity.parse.failed" || err.type === "entity.too.large")
      return res.status(400).json({ error: "bad_request", message: "Richiesta non valida." });
    log.error(err);
    res.status(500).json({ error: "server_error", message: "Errore del server. Riprova." });
  });

  app.use("/api", api);

  /* ── Static PWA ──────────────────────────────────────────────────────── */

  app.use(
    express.static(publicDir, {
      extensions: ["html"],
      setHeaders(res, path) {
        if (path.endsWith("sw.js")) {
          // The browser must always see the latest worker to detect updates.
          res.set("Cache-Control", "no-cache");
        } else if (path.endsWith(".webmanifest")) {
          res.set("Content-Type", "application/manifest+json");
          res.set("Cache-Control", "no-cache");
        } else if (/\/(icons|fonts)\//.test(path)) {
          res.set("Cache-Control", "public, max-age=604800");
        } else {
          // No hashed filenames: revalidate with ETag; the service worker
          // serves these instantly (stale-while-revalidate) after first load.
          res.set("Cache-Control", "no-cache");
        }
      },
    }),
  );
  app.use((req, res) => res.status(404).sendFile(join(publicDir, "offline.html")));

  bookings.purgeOld();
  const purgeTimer = setInterval(() => bookings.purgeOld(), 24 * 3_600_000);
  purgeTimer.unref();

  return {
    app,
    db,
    shop,
    bookings,
    push,
    close() {
      clearInterval(purgeTimer);
      push.stop();
      db.close();
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const envFile = join(ROOT, "server", ".env");
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const ctx = createApp();
  ctx.push.start();
  const port = Number(process.env.PORT ?? 3000);
  const server = ctx.app.listen(port, () => {
    console.log(`History Barber in ascolto su http://localhost:${port}`);
  });
  const shutdown = () => server.close(() => { ctx.close(); process.exit(0); });
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

/* History Barber service worker.
   Bump VERSION on every deploy: a byte-different sw.js is what makes the
   browser install the new worker, which then waits for the user to accept
   the update (see app.js). Paths are relative to this file, so the app works
   at the domain root and in a subfolder. */

importScripts("./js/outbox.js");

const VERSION = "v1.1.0";
const SHELL_CACHE = `hb-shell-${VERSION}`;
const RUNTIME_CACHE = `hb-runtime-${VERSION}`;
const API_CACHE = `hb-api-${VERSION}`;
const API_TIMEOUT_MS = 3000;
const NAV_TIMEOUT_MS = 4000;

// "./" is not precached: on the site it redirects to ./index.html, and a
// redirected response cannot answer a navigation.
const SHELL = [
  "./index.html",
  "./offline.html",
  "./manifest.webmanifest",
  "./css/styles.css",
  "./js/app.js",
  "./js/api.js",
  "./js/booking.js",
  "./js/notifications.js",
  "./js/outbox.js",
  "./js/store.js",
  "./js/ui.js",
  "./js/shared/slots.js",
  "./js/shared/time.js",
  "./js/shared/validation.js",
  "./data/shop.json",
  "./fonts/bodoni-moda-latin-600-normal.woff2",
  "./fonts/bodoni-moda-latin-500-italic.woff2",
  "./fonts/figtree-latin-wght-normal.woff2",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/favicon-32.png",
  "./icons/badge-72.png",
];

const scopeUrl = new URL(self.registration.scope);
const apiPrefix = scopeUrl.pathname + "api/";
const apiBase = scopeUrl.href + "api/";
// Only these GETs are cached for offline use: public, non-personal data.
const CACHEABLE_API = ["shop", "days", "availability"];

/* install: precache the app shell. `cache: "reload"` bypasses the HTTP
   cache so a new version never precaches stale files. No skipWaiting here:
   the new worker waits until the user taps "Aggiorna". */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL.map((url) => new Request(url, { cache: "reload" })))),
  );
});

/* activate: drop caches from older versions, then take control of open
   pages right away so the first visit is already offline-capable. */
self.addEventListener("activate", (event) => {
  const keep = [SHELL_CACHE, RUNTIME_CACHE, API_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("hb-") && !keep.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/* The page posts SKIP_WAITING when the user accepts the update. */
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

/* ── fetch ─────────────────────────────────────────────────────────────── */

const timeout = (ms) => new Promise((resolve) => setTimeout(resolve, ms, null));

/** Navigations: network first; offline → cached page → shell → offline.html. */
async function handleNavigation(request) {
  const network = fetch(request).then((res) => {
    if (res.ok) {
      const copy = res.clone();
      caches.open(SHELL_CACHE).then((c) => c.put(request.url.split("#")[0].split("?")[0], copy));
    }
    return res;
  });
  network.catch(() => {});
  const first = await Promise.race([network.catch(() => null), timeout(NAV_TIMEOUT_MS)]);
  if (first) return first;
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const url = new URL(request.url);
  const isAppRoot = url.pathname === scopeUrl.pathname || url.pathname.endsWith("/index.html");
  const shell = isAppRoot ? await caches.match("./index.html") : null;
  if (shell) return shell;
  // Slow but online: keep waiting for the network rather than lying.
  const late = await network.catch(() => null);
  return late ?? (await caches.match("./offline.html"));
}

/** Cacheable API GETs: network first with a short timeout, cache fallback. */
async function handleApi(request) {
  const cache = await caches.open(API_CACHE);
  const network = fetch(request).then((res) => {
    if (res.ok) cache.put(request, res.clone());
    return res;
  });
  network.catch(() => {});
  const first = await Promise.race([network.catch(() => null), timeout(API_TIMEOUT_MS)]);
  if (first) return first;
  const cached = await cache.match(request);
  if (cached) {
    // Tell the page this answer may be stale.
    const headers = new Headers(cached.headers);
    headers.set("X-HB-From-Cache", "1");
    return new Response(cached.body, { status: cached.status, statusText: cached.statusText, headers });
  }
  return network; // rejects when offline: the page shows its offline message
}

/** Static assets: stale-while-revalidate (instant from cache, refreshed behind). */
async function handleAsset(event) {
  const { request } = event;
  const shell = await caches.open(SHELL_CACHE);
  const inShell = await shell.match(request, { ignoreSearch: true });
  const cache = inShell ? shell : await caches.open(RUNTIME_CACHE);
  const cached = inShell ?? (await cache.match(request));
  const refresh = fetch(request).then((res) => {
    if (res.ok && res.type === "basic") cache.put(request, res.clone());
    return res;
  });
  if (cached) {
    event.waitUntil(refresh.catch(() => {}));
    return cached;
  }
  return refresh;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Never touch non-GET requests: bookings and push calls go straight to the
  // network (the offline queue handles their failures).
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") return event.respondWith(handleNavigation(request));
  if (url.pathname.startsWith(apiPrefix)) {
    const endpoint = url.pathname.slice(apiPrefix.length).split("/")[0];
    if (CACHEABLE_API.includes(endpoint)) event.respondWith(handleApi(request));
    return; // personal data (bookings, push) is never cached
  }
  event.respondWith(handleAsset(event));
});

/* ── Offline booking queue ─────────────────────────────────────────────── */

async function notifyClients(message) {
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of clients) client.postMessage(message);
}

async function flushQueue() {
  const changed = await self.HBOutbox.flush(apiBase); // rejects while offline → sync retries
  if (!changed.length) return;
  await notifyClients({ type: "QUEUE_UPDATED" });
  // If no page is open, tell the user with a notification (when allowed).
  const open = await self.clients.matchAll({ type: "window" });
  if (open.length || Notification.permission !== "granted") return;
  for (const item of changed) {
    const ok = item.status === "sent";
    await self.registration.showNotification(ok ? "Prenotazione confermata" : "Prenotazione non riuscita", {
      body: ok
        ? `${item.summary.service}, ${item.summary.date} alle ${item.summary.time}.`
        : `${item.summary.service} alle ${item.summary.time}: ${item.error} Apri l'app per scegliere un altro orario.`,
      icon: "./icons/icon-192.png",
      badge: "./icons/badge-72.png",
      tag: `queue-${item.id}`,
      data: { url: "./index.html#booking" },
    });
  }
}

/* Background Sync (Chromium): fires when connectivity returns, even with the
   page closed. Safari/Firefox use the page's `online` listener instead. */
self.addEventListener("sync", (event) => {
  if (event.tag === "booking-queue") event.waitUntil(flushQueue());
});

/* ── Push ──────────────────────────────────────────────────────────────── */

/* push: the payload is JSON from server/push.js. Parse defensively: an
   empty or malformed payload still shows a generic, useful notification
   (browsers penalise push events that show nothing). */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data?.text() };
  }
  const title = data.title || "History Barber";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "Hai un aggiornamento sulla tua prenotazione.",
      icon: "./icons/icon-192.png",
      badge: "./icons/badge-72.png",
      tag: data.tag || "history-barber",
      renotify: Boolean(data.tag),
      data: { url: data.url || "./index.html#booking" },
    }),
  );
});

/* notificationclick: focus an open app window and move it to the target;
   otherwise open a new one. Same-origin targets only. */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "./index.html#booking", self.registration.scope);
  if (target.origin !== self.location.origin) return;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const client = windows.find((c) => c.url.startsWith(self.registration.scope));
      if (client) {
        await client.focus();
        // A hash change can't be done with client.navigate() on uncontrolled
        // pages; the page handles this message in app.js.
        client.postMessage({ type: "NAVIGATE", url: target.href });
        return;
      }
      await self.clients.openWindow(target.href);
    })(),
  );
});

/* pushsubscriptionchange: the push service rotated or expired our
   subscription. Subscribe again with the server key and tell the server, so
   reminders already linked to the old endpoint move to the new one. */
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const oldEndpoint = event.oldSubscription?.endpoint;
      let subscription = event.newSubscription;
      if (!subscription) {
        const res = await fetch(apiBase + "push/public-key");
        if (!res.ok) return;
        const { publicKey } = await res.json();
        const pad = "=".repeat((4 - (publicKey.length % 4)) % 4);
        const raw = atob((publicKey + pad).replace(/-/g, "+").replace(/_/g, "/"));
        subscription = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: Uint8Array.from(raw, (c) => c.charCodeAt(0)),
        });
      }
      await fetch(apiBase + "push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON(), oldEndpoint }),
      });
    })(),
  );
});

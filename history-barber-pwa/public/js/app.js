// Bootstrap: API mode, content from shop.json, navigation and routing,
// service worker registration with a user-driven update flow, install UX,
// online/offline handling.

import { init as initApi, api, getMode } from "./api.js";
import { initBooking, openManage, flushOutbox, processOutbox } from "./booking.js";
import * as notifications from "./notifications.js";
import { isStandalone } from "./notifications.js";
import { parseTime, formatTime, todayIn, utcToZoned, weekday, addDays } from "./shared/time.js";
import { el, toast, formatPrice } from "./ui.js";
import { read, write } from "./store.js";

const $ = (id) => document.getElementById(id);
let shop;

/* ── Content from shop.json ───────────────────────────────────────────── */

function renderShop() {
  const s = shop.shop;
  // Static fallbacks in the HTML (for no-JS and first paint) are replaced
  // with the values from shop.json, the single source of truth.
  for (const node of document.querySelectorAll("[data-shop]")) node.textContent = s[node.dataset.shop] ?? node.textContent;
  for (const node of document.querySelectorAll("[data-shop-href]")) node.href = s[node.dataset.shopHref];

  $("address-block").replaceChildren(`${s.name} ${s.signature}`, el("br"), s.street, el("br"), `${s.postalCode} ${s.city} (${s.province})`);
  $("maps-link").href = s.mapsUrl;
  $("ig-link").href = s.instagramUrl;
  $("ig-link").textContent = `@${s.instagram}`;

  const anySample = shop.services.some((x) => x.sample);
  $("price-note").hidden = !anySample;
  $("service-list").replaceChildren(
    ...shop.categories.map((cat) =>
      el(
        "div",
        { class: "menu-group" },
        el("h3", { text: cat.title }),
        el(
          "ul",
          { role: "list" },
          shop.services
            .filter((x) => x.category === cat.id)
            .map((x) =>
              el(
                "li",
                { class: "menu-item" },
                el("div", { class: "menu-row" }, el("span", { class: "menu-name", text: x.name }), el("span", { class: "menu-price", text: formatPrice(x.price) })),
                el("p", { class: "menu-meta", text: `${x.durationMinutes} min · ${x.description}` }),
              ),
            ),
        ),
      ),
    ),
  );

  $("team-list").replaceChildren(
    ...shop.barbers.map((b) =>
      el(
        "li",
        { class: "team-card" },
        el("span", { class: "avatar", "aria-hidden": "true", text: b.name.slice(0, 1) }),
        el("div", {}, el("p", { class: "team-name", text: b.name }), el("p", { class: "muted small", text: [b.role, "Su appuntamento"].filter(Boolean).join(" · ") })),
      ),
    ),
  );

  renderHours();
  renderOpenStatus();
  setInterval(renderOpenStatus, 60_000);
}

function renderHours() {
  const today = weekday(todayIn(shop.shop.timezone));
  const order = [1, 2, 3, 4, 5, 6, 0]; // the barber's week reads from Monday
  $("hours-table").replaceChildren(
    ...order.map((i) => {
      const day = shop.hours.days[i];
      const text = day.shifts.length ? day.shifts.map(([a, b]) => `${a}–${b}`).join(" · ") : "Chiuso";
      return el("tr", { "data-today": String(i === today) }, el("th", { scope: "row", text: day.label }), el("td", { class: day.shifts.length ? "" : "closed", text }));
    }),
  );
}

/** "Aperto ora · chiude alle 13:00" / "Chiuso · apre martedì alle 08:30". */
function renderOpenStatus() {
  const tz = shop.shop.timezone;
  const now = utcToZoned(Date.now(), tz);
  const node = $("open-status");
  const shiftsOf = (date) => (shop.hours.closedDates.includes(date) ? [] : shop.hours.days[weekday(date)].shifts);
  const current = shiftsOf(now.date).find(([a, b]) => now.minutes >= parseTime(a) && now.minutes < parseTime(b));
  if (current) {
    node.dataset.open = "true";
    node.textContent = `Aperto ora · chiude alle ${current[1]}`;
  } else {
    node.dataset.open = "false";
    let text = "Chiuso ora";
    for (let i = 0; i < 14; i++) {
      const date = addDays(now.date, i);
      const next = shiftsOf(date).find(([a]) => i > 0 || parseTime(a) > now.minutes);
      if (next) {
        const when = i === 0 ? "" : i === 1 ? "domani " : `${shop.hours.days[weekday(date)].label.toLowerCase()} `;
        text += ` · apre ${when}alle ${formatTime(parseTime(next[0]))}`;
        break;
      }
    }
    node.textContent = text;
  }
  node.hidden = false;
}

/* ── Navigation and routing ───────────────────────────────────────────── */

function route() {
  const match = /^#gestisci\/([^/]+)\/([^/]+)$/.exec(location.hash);
  const manage = $("gestisci");
  manage.hidden = !match;
  if (match) {
    openManage(decodeURIComponent(match[1]), decodeURIComponent(match[2]));
    manage.scrollIntoView({ block: "start" });
    manage.focus({ preventScroll: true });
  }
}

function highlightNav() {
  const links = [...document.querySelectorAll(".bottomnav a")];
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        for (const a of links) a.setAttribute("aria-current", String(a.dataset.nav === entry.target.id));
      }
    },
    { rootMargin: "-45% 0px -50% 0px" },
  );
  for (const id of ["home", "servizi", "team", "booking", "contatti"]) observer.observe($(id));
}

/* ── Service worker and update flow ───────────────────────────────────── */

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  let reloading = false;
  let updateRequested = false;

  // A new worker took control *because the user asked*: reload once to run
  // the new code. Without the flag, the first install (clients.claim) would
  // reload the page for no reason.
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!updateRequested || reloading) return;
    reloading = true;
    location.reload();
  });

  // The new worker waits (no blind skipWaiting): we ask the user first.
  const offerUpdate = (worker) => {
    toast("Nuova versione disponibile", {
      action: {
        label: "Aggiorna",
        onClick: () => {
          updateRequested = true;
          worker.postMessage({ type: "SKIP_WAITING" });
        },
      },
    });
  };

  const reg = await navigator.serviceWorker.register("./sw.js");
  if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
  reg.addEventListener("updatefound", () => {
    const worker = reg.installing;
    worker?.addEventListener("statechange", () => {
      // "installed" with an existing controller = an update is waiting.
      if (worker.state === "installed" && navigator.serviceWorker.controller) offerUpdate(worker);
    });
  });
  // Check for updates when the app comes back to the foreground.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") reg.update().catch(() => {});
  });

  navigator.serviceWorker.addEventListener("message", (event) => {
    const { type, url } = event.data ?? {};
    if (type === "NAVIGATE" && url) {
      const target = new URL(url, location.href);
      if (target.origin === location.origin) location.href = target.href;
    }
    if (type === "QUEUE_UPDATED") processOutbox();
  });
}

/* ── Install UX ───────────────────────────────────────────────────────── */

const DISMISS_DAYS = 14;
const isIosDevice = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const dismissedRecently = () => Date.now() - (read("install-dismissed") ?? 0) < DISMISS_DAYS * 86_400_000;

function setupInstall() {
  const banner = $("install-banner");
  const footerBtn = $("install-footer");
  const guide = $("ios-guide");
  let deferred = null;

  const hide = () => {
    banner.hidden = true;
  };
  const show = () => {
    if (isStandalone() || dismissedRecently()) return;
    banner.hidden = false;
  };
  const dismiss = () => {
    write("install-dismissed", Date.now());
    hide();
  };

  // Chromium: keep the event and prompt only from our button (user gesture).
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event;
    footerBtn.hidden = false;
    show();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    hide();
    footerBtn.hidden = true;
    toast("App installata: la trovi nella schermata Home.");
  });

  const install = async () => {
    if (deferred) {
      hide();
      deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "dismissed") write("install-dismissed", Date.now());
      deferred = null;
      footerBtn.hidden = true;
    } else if (isIosDevice()) {
      hide();
      guide.showModal();
    }
  };
  $("install-accept").addEventListener("click", install);
  footerBtn.addEventListener("click", install);
  $("install-dismiss").addEventListener("click", dismiss);
  banner.addEventListener("keydown", (e) => {
    if (e.key === "Escape") dismiss();
  });
  // <dialog> gives us the focus trap and Esc-to-close natively.
  guide.addEventListener("close", () => write("install-dismissed", Date.now()));

  // iOS has no install event: same banner, the button opens the guide.
  if (isIosDevice() && !isStandalone()) {
    $("install-accept").textContent = "Come fare";
    footerBtn.hidden = false;
    setTimeout(show, 2500);
  }
}

/* ── Online / offline ─────────────────────────────────────────────────── */

function setupNetwork() {
  const node = $("net-status");
  const update = () => {
    const offline = !navigator.onLine;
    node.hidden = !offline;
    node.textContent = offline ? "Sei offline. Puoi consultare il sito; le prenotazioni verranno inviate al ritorno della connessione." : "";
  };
  window.addEventListener("offline", update);
  window.addEventListener("online", () => {
    update();
    // Fallback for browsers without Background Sync (Safari, Firefox).
    flushOutbox();
  });
  update();
}

/* ── Start ────────────────────────────────────────────────────────────── */

async function start() {
  registerServiceWorker().catch((err) => console.warn("Service worker non registrato:", err));
  setupInstall();
  setupNetwork();

  await initApi();
  $("demo-banner").hidden = getMode() !== "mock";
  shop = await api.getShop();
  renderShop();
  highlightNav();
  initBooking(shop, notifications);
  notifications.initNotifications().catch(() => {});

  window.addEventListener("hashchange", route);
  route();
  if (navigator.onLine) flushOutbox();
}

start().catch((err) => {
  console.error(err);
  toast("Qualcosa non ha funzionato nel caricamento. Ricarica la pagina o chiama il salone.");
});

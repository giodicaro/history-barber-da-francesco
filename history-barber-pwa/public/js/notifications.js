// Push notifications: permission (only after a user gesture), subscription
// with the server's VAPID key, linking subscriptions to bookings, and local
// notifications through the service worker registration.

import { api, getMode } from "./api.js";
import { el } from "./ui.js";
import { read, write } from "./store.js";

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

let publicKey = null;
let panel;

const supported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/**
 * unsupported | ios-install | server-off | default | granted | denied
 * "ios-install": iOS only exposes Push to Home-screen web apps (16.4+).
 */
export function pushState() {
  if (isIos() && !isStandalone()) return "ios-install";
  if (!supported()) return "unsupported";
  if (!publicKey) return "server-off";
  return Notification.permission;
}

// The VAPID public key is base64url; PushManager wants the raw bytes.
function keyBytes(base64url) {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function currentSubscription() {
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

async function subscribe() {
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
}

/** Attach this device's subscription to every booking it knows about. */
async function linkBookings(subscription, bookings) {
  const json = subscription.toJSON();
  if (!bookings.length) return api.subscribePush(json);
  for (const b of bookings) await api.subscribePush(json, b.id, b.token);
}

const upcoming = () => read("my-bookings", []).filter((b) => b.status === "confirmed" && b.startUtc > Date.now());

/**
 * Must run inside a click handler: browsers ignore (Safari rejects)
 * permission requests without a user gesture.
 */
export async function enable(bookings = upcoming()) {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    renderPanel();
    return false;
  }
  const subscription = await subscribe();
  await linkBookings(subscription, bookings);
  write("push-enabled", true);
  renderPanel();
  return true;
}

export async function disable() {
  const subscription = await currentSubscription();
  if (subscription) {
    await api.unsubscribePush(subscription.endpoint).catch(() => {});
    await subscription.unsubscribe();
  }
  write("push-enabled", false);
  renderPanel();
}

/** Local notification via the registration (new Notification() throws on Android). */
export async function showLocal(title, body, url = "./#booking") {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const reg = await navigator.serviceWorker?.ready;
  await reg?.showNotification(title, {
    body,
    icon: "icons/icon-192.png",
    badge: "icons/badge-72.png",
    tag: "booking-confirmed",
    data: { url },
  });
}

/* ── Settings panel ───────────────────────────────────────────────────── */

async function renderPanel() {
  if (!panel) return;
  const state = pushState();
  const text = (t) => el("p", { class: "small", text: t });
  const button = (label, onclick, cls = "btn btn-gold btn-sm") => el("button", { type: "button", class: cls, text: label, onclick });
  let nodes;
  if (state === "ios-install") {
    nodes = [
      text("Su iPhone e iPad i promemoria funzionano solo dopo aver aggiunto l'app alla schermata Home (iOS 16.4 o successivo)."),
      button("Come aggiungerla", () => document.getElementById("ios-guide").showModal(), "btn btn-ghost btn-sm"),
    ];
  } else if (state === "unsupported") {
    nodes = [text("Questo browser non supporta le notifiche push. Puoi aggiungere l'appuntamento al calendario dalla conferma.")];
  } else if (state === "server-off") {
    nodes = [text(getMode() === "mock" ? "In modalità demo i promemoria non sono disponibili." : "I promemoria non sono attivi su questo server.")];
  } else if (state === "denied") {
    nodes = [text("Hai bloccato le notifiche per questo sito. Per riattivarle apri le impostazioni del browser (icona accanto all'indirizzo) e consenti le notifiche.")];
  } else {
    const subscribed = state === "granted" && (await currentSubscription());
    nodes = subscribed
      ? [text("Attivi: ti avvisiamo 24 ore e 2 ore prima di ogni appuntamento prenotato da qui."), button("Disattiva", () => disable(), "btn btn-ghost btn-sm")]
      : [
          text("Ricevi un avviso 24 ore e 2 ore prima dell'appuntamento. Nessuna pubblicità."),
          button("Attiva i promemoria", async (e) => {
            e.target.disabled = true;
            try {
              await enable();
            } catch {
              e.target.disabled = false;
              panel.append(text("Non è stato possibile attivarli. Riprova più tardi."));
            }
          }),
        ];
  }
  panel.replaceChildren(...nodes);
}

/* ── After a confirmed booking ────────────────────────────────────────── */

/**
 * Already subscribed → link the booking silently and show a local
 * notification. Never asked before → offer reminders (one tap, user gesture).
 * Asked and refused → leave the user alone.
 */
export async function afterBooking(container, { booking, token, title, body }) {
  const state = pushState();
  if (state === "granted") {
    const subscription = await currentSubscription().catch(() => null);
    if (subscription) await linkBookings(subscription, [{ id: booking.id, token }]).catch(() => {});
    await showLocal(title, body);
    return;
  }
  if (state === "ios-install") {
    container.replaceChildren(
      el(
        "div",
        { class: "reminder-ask" },
        el("p", { class: "small", text: "Vuoi i promemoria su iPhone? Prima aggiungi l'app alla schermata Home, poi aprila dall'icona e attivali." }),
        el("button", { type: "button", class: "btn btn-ghost btn-sm", text: "Come fare", onclick: () => document.getElementById("ios-guide").showModal() }),
      ),
    );
    return;
  }
  if (state !== "default" || read("push-declined")) return;
  const box = el(
    "div",
    { class: "reminder-ask" },
    el("p", { class: "repeat-title", text: "Vuoi i promemoria?" }),
    el("p", { class: "small", text: "Ti avvisiamo sul telefono 24 ore e 2 ore prima dell'appuntamento." }),
  );
  const actions = el(
    "div",
    { class: "done-actions" },
    el("button", {
      type: "button",
      class: "btn btn-gold btn-sm",
      text: "Sì, avvisami",
      onclick: async () => {
        const ok = await enable([{ id: booking.id, token }]).catch(() => false);
        box.replaceChildren(el("p", { class: "small", text: ok ? "Fatto: riceverai i promemoria." : "Notifiche non attivate. Puoi cambiare idea in Contatti → Promemoria." }));
        if (ok) await showLocal(title, body);
      },
    }),
    el("button", {
      type: "button",
      class: "btn btn-ghost btn-sm",
      text: "No, grazie",
      onclick: () => {
        // Remember the "no": we do not ask again after every booking.
        write("push-declined", true);
        box.remove();
      },
    }),
  );
  box.append(actions);
  container.replaceChildren(box);
}

export async function initNotifications() {
  panel = document.getElementById("reminders-panel");
  if (supported() && getMode() === "real") publicKey = await api.getPushKey();
  renderPanel();
  // The browser may have dropped or rotated the subscription: re-sync it in
  // the background (offline, it is simply retried on the next start).
  if (pushState() === "granted" && read("push-enabled")) {
    subscribe().then((sub) => linkBookings(sub, upcoming())).catch(() => {});
  }
}

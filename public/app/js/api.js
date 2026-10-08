// The only module that talks to the backend. Two implementations behind one
// interface: the real API (default) and a clearly labelled local mock used
// when no backend exists (e.g. the static files on a plain web host).

import { ANY_BARBER, computeDays, computeSlots, findService, pickBarber } from "./shared/slots.js";
import { MINUTE, DAY } from "./shared/time.js";
import { validateCustomer } from "./shared/validation.js";
import { read, write } from "./store.js";

export class ApiError extends Error {
  constructor(status, code, message, fields) {
    super(message || "Errore imprevisto.");
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

/** The network (or the server) could not be reached. */
export class OfflineError extends Error {
  constructor() {
    super("Sei offline o il server non risponde.");
  }
}

const BASE = new URL("api/", document.baseURI).href;
export const apiBase = BASE;

async function request(path, { method = "GET", body, token, timeout = 8000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { "X-Booking-Token": token } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new OfflineError();
  } finally {
    clearTimeout(timer);
  }
  if (!(res.headers.get("content-type") ?? "").includes("application/json"))
    throw new ApiError(res.status, "no_api", "Il server delle prenotazioni non è disponibile.");
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data.error, data.message, data.fields);
  // The service worker marks answers served from its cache while offline.
  if (res.headers.get("X-HB-From-Cache") === "1") data.stale = true;
  return data;
}

/* ── Real API ──────────────────────────────────────────────────────────── */

const real = {
  async getShop() {
    try {
      return await request("shop");
    } catch {
      const res = await fetch(new URL("data/shop.json", document.baseURI));
      return res.json();
    }
  },
  getDays: (serviceId, barberId) => request(`days?service=${encodeURIComponent(serviceId)}&barber=${encodeURIComponent(barberId)}`),
  getAvailability: (date, serviceId, barberId) =>
    request(`availability?date=${date}&service=${encodeURIComponent(serviceId)}&barber=${encodeURIComponent(barberId)}`),
  createBooking: (payload) => request("bookings", { method: "POST", body: payload }),
  getBooking: (id, token) => request(`bookings/${encodeURIComponent(id)}`, { token }),
  cancelBooking: (id, token) => request(`bookings/${encodeURIComponent(id)}/cancel`, { method: "POST", token, body: {} }),
  rescheduleBooking: (id, token, change) =>
    request(`bookings/${encodeURIComponent(id)}/reschedule`, { method: "POST", token, body: change }),
  async getPushKey() {
    try {
      return (await request("push/public-key")).publicKey;
    } catch {
      return null;
    }
  },
  subscribePush: (subscription, bookingId, token) =>
    request("push/subscribe", { method: "POST", token, body: { subscription, bookingId } }),
  unsubscribePush: (endpoint) => request("push/unsubscribe", { method: "POST", body: { endpoint } }),
};

/* ── Local mock (demo only) ────────────────────────────────────────────── */

// Same rules as the server (shared slot engine and validation), data in
// localStorage. Nothing here reaches the shop: the UI says so in a banner.
function createMock(shop) {
  const load = () => read("mock-bookings", []);
  const save = (list) => write("mock-bookings", list);
  const confirmed = () => load().filter((b) => b.status === "confirmed");
  const randomId = () => (crypto.randomUUID?.() ?? String(Math.random()).slice(2)).replace(/-/g, "").slice(0, 12);
  const cutoff = (b) => b.startUtc - shop.booking.cancelCutoffMinutes * MINUTE;
  const present = (b) => ({ ...b, token: undefined, canModify: b.status === "confirmed" && Date.now() < cutoff(b), modifyUntil: cutoff(b) });
  const wait = (v) => new Promise((r) => setTimeout(() => r(v), 150));

  function find(id, token) {
    const b = load().find((x) => x.id === id && x.token === token);
    if (!b) throw new ApiError(404, "not_found", "Prenotazione non trovata.");
    return b;
  }
  function slotFor({ date, time, serviceId, barberId, excludeId }) {
    const bookings = confirmed().filter((b) => b.id !== excludeId);
    const slot = computeSlots({ shop, date, serviceId, barberId, bookings, now: Date.now() }).find((s) => s.time === time);
    if (!slot) throw new ApiError(409, "slot_taken", "Questo orario non è più disponibile. Scegline un altro.");
    return { slot, barberId: barberId === ANY_BARBER ? pickBarber(shop, slot.barberIds, bookings) : barberId };
  }
  function beforeCutoff(b) {
    if (Date.now() >= cutoff(b))
      throw new ApiError(403, "cutoff_passed", "Mancano meno di 2 ore all'appuntamento: per modificarlo chiama il salone.");
  }

  return {
    getShop: async () => shop,
    getDays: async (serviceId, barberId) =>
      wait({ days: computeDays({ shop, serviceId, barberId, bookings: confirmed(), now: Date.now() }) }),
    getAvailability: async (date, serviceId, barberId) =>
      wait({ date, slots: computeSlots({ shop, date, serviceId, barberId, bookings: confirmed(), now: Date.now() }) }),
    async createBooking(input) {
      const existing = load().find((b) => b.clientRequestId === input.clientRequestId);
      if (existing) return { booking: present(existing), token: existing.token };
      const { ok, errors, value } = validateCustomer(input);
      if (!ok) throw new ApiError(422, "invalid_input", "Controlla i dati inseriti.", errors);
      if (!findService(shop, input.serviceId)) throw new ApiError(422, "invalid_service", "Servizio non valido.");
      const { slot, barberId } = slotFor(input);
      const active = confirmed().filter((b) => b.endUtc > Date.now() && b.phone === value.phone);
      if (active.length >= shop.booking.maxActivePerContact)
        throw new ApiError(429, "too_many_active", `Hai già ${shop.booking.maxActivePerContact} prenotazioni attive.`);
      const booking = {
        id: randomId(), token: randomId() + randomId(), clientRequestId: input.clientRequestId,
        barberId, serviceId: input.serviceId, startUtc: slot.startUtc, endUtc: slot.endUtc,
        ...value, status: "confirmed", createdAt: Date.now(),
      };
      // Keep the demo store small: drop bookings that ended over a day ago.
      save([...load().filter((b) => b.endUtc > Date.now() - DAY), booking]);
      return wait({ booking: present(booking), token: booking.token });
    },
    getBooking: async (id, token) => ({ booking: present(find(id, token)) }),
    async cancelBooking(id, token) {
      const b = find(id, token);
      if (b.status === "confirmed") {
        beforeCutoff(b);
        save(load().map((x) => (x.id === id ? { ...x, status: "cancelled" } : x)));
      }
      return { booking: present(find(id, token)) };
    },
    async rescheduleBooking(id, token, { date, time }) {
      const b = find(id, token);
      beforeCutoff(b);
      const { slot, barberId } = slotFor({ date, time, serviceId: b.serviceId, barberId: b.barberId, excludeId: id });
      save(load().map((x) => (x.id === id ? { ...x, barberId, startUtc: slot.startUtc, endUtc: slot.endUtc } : x)));
      return { booking: present(find(id, token)) };
    },
    getPushKey: async () => null,
    subscribePush: async () => ({ ok: false }),
    unsubscribePush: async () => ({ ok: true }),
  };
}

/* ── Mode selection ────────────────────────────────────────────────────── */

let impl = real;
let mode = "real";
export const getMode = () => mode;

/**
 * Decide real vs mock once, at startup. A failed health check while offline
 * (or on a device that already reached this backend) means "offline", not
 * "no backend": we stay on the real API and queue writes. `?mock` forces
 * the mock for demos.
 */
export async function init() {
  let useMock = new URLSearchParams(location.search).has("mock");
  if (!useMock) {
    try {
      await request("health", { timeout: 4000 });
      write("api-seen", true);
    } catch (err) {
      const justOffline = err instanceof OfflineError && (read("api-seen") || !navigator.onLine);
      useMock = !justOffline;
    }
  }
  if (useMock) {
    const shop = await real.getShop();
    impl = createMock(shop);
    mode = "mock";
  }
  return mode;
}

export const api = new Proxy({}, { get: (_, key) => impl[key] });

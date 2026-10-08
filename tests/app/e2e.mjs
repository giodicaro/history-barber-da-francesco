// Prove end-to-end dell'app clienti (PWA in /app) collegata all'agenda.
// Servono il sito avviato e Playwright (installato a parte, non è una
// dipendenza del progetto):
//
//   AGENDA_DATA_DIR=/tmp/agenda-prova ADMIN_PASSWORD=… CRON_SECRET=… npm run dev -- -p 3200
//   NODE_PATH="$(npm root -g)" ADMIN_PASSWORD=… CRON_SECRET=… npm run e2e:app
//
// Variabili: BASE_URL (predefinito http://localhost:3200/app/), CHROMIUM_PATH,
// E2E_DEBUG=1 per gli screenshot dei fallimenti. Usare un database di prova:
// le prove creano e cancellano appuntamenti veri.

import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");

const BASE = (process.env.BASE_URL ?? "http://localhost:3200/app/").replace(/\/?$/, "/");
const SITE = new URL("/", BASE).href;
const ORIGIN = new URL(BASE).origin;
const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const results = [];
let main;

const check = async (name, fn) => {
  try {
    await fn();
    results.push(["PASS", name]);
  } catch (err) {
    results.push([err.skip ? "SKIP" : "FAIL", name, err.message.split("\n")[0]]);
    if (process.env.E2E_DEBUG && main) {
      const shot = join(tmpdir(), `e2e-app-fail-${results.length}.png`);
      await main.page.screenshot({ path: shot }).catch(() => {});
      console.log(`  screenshot: ${shot}\n  ${err.stack?.split("\n").slice(0, 6).join("\n  ")}`);
    }
  }
};
const skip = (msg) => Object.assign(new Error(msg), { skip: true });

// Numeri diversi a ogni esecuzione: il limite di prenotazioni attive per
// telefono farebbe fallire le esecuzioni ripetute sullo stesso database.
const RUN = String(Date.now()).slice(-6);
const phoneFor = (n) => `34${n}${RUN}`.padEnd(10, "0").slice(0, 10);

const api = async (path, { method = "GET", body, token, headers = {} } = {}) => {
  const res = await fetch(new URL(path, BASE), {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { "X-Booking-Token": token } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
};

/* ── API e agenda ─────────────────────────────────────────────────────── */

// Primo giorno con almeno `n` orari liberi per il taglio.
async function freeDay(n = 6) {
  const { body } = await api("api/days?service=taglio-uomo&barber=any");
  const day = body.days.find((d) => d.available >= n);
  const { body: av } = await api(`api/availability?date=${day.date}&service=taglio-uomo&barber=any`);
  return { date: day.date, times: av.slots.map((s) => s.time) };
}
const customer = (n, over = {}) => ({ name: `Prova App ${n}-${RUN}`, phone: phoneFor(n), privacy: true, ...over });

await check("API: prenotazione dall'app → l'orario risulta occupato anche per il sito", async () => {
  const { date, times } = await freeDay();
  const time = times.at(-1);
  const created = await api("api/bookings", { method: "POST", body: { barberId: "any", serviceId: "taglio-uomo", date, time, ...customer(1) } });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  // Il widget del sito legge la stessa agenda.
  const site = await (await fetch(new URL(`/api/bookings?date=${date}&servizio=taglio-uomo`, SITE))).json();
  assert.equal(site.slot.find((s) => s.ora === time).motivo, "occupato");
});

await check("API: prenotazione dal sito → l'orario sparisce dall'app", async () => {
  const { date, times } = await freeDay();
  const time = times[0];
  const res = await fetch(new URL("/api/bookings", SITE), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ servizioId: "taglio-uomo", data: date, ora: time, cliente: { nome: `Sito ${RUN}`, telefono: phoneFor(2) }, origine: "e2e" }),
  });
  assert.equal(res.status, 201);
  const { body } = await api(`api/availability?date=${date}&service=taglio-uomo&barber=any`);
  assert.ok(!body.slots.some((s) => s.time === time));
});

await check("API: 10 richieste in parallelo sullo stesso orario → una sola passa", async () => {
  const { date, times } = await freeDay();
  const time = times[2];
  const all = await Promise.all(
    Array.from({ length: 10 }, (_, i) => api("api/bookings", { method: "POST", body: { barberId: "francesco", serviceId: "taglio-uomo", date, time, ...customer(`3${i}`) } })),
  );
  const statuses = all.map((r) => r.status).sort();
  assert.deepEqual(statuses, [201, 409, 409, 409, 409, 409, 409, 409, 409, 409], JSON.stringify(statuses));
});

let managed;
await check("API: richiesta ripetuta (coda offline) → stessa prenotazione, stesso token", async () => {
  const { date, times } = await freeDay();
  const body = { barberId: "any", serviceId: "barba-completa", date, time: times[3], clientRequestId: `e2e-${RUN}-replay-0001`, ...customer(4) };
  const first = await api("api/bookings", { method: "POST", body });
  const again = await api("api/bookings", { method: "POST", body });
  assert.equal(first.status, 201, JSON.stringify(first.body));
  assert.equal(again.status, 200);
  assert.equal(again.body.booking.id, first.body.booking.id);
  assert.equal(again.body.token, first.body.token);
  managed = { ...first.body, date, times };
});

await check("API: gestione col link: token sbagliato 404, sposta, poi disdici", async () => {
  const { booking, token, date } = managed;
  assert.equal((await api(`api/bookings/${booking.id}`, { token: "sbagliato" })).status, 404);
  const view = await api(`api/bookings/${booking.id}`, { token });
  assert.equal(view.status, 200);
  assert.equal(view.body.booking.canModify, true);
  const { body: av } = await api(`api/availability?date=${date}&service=barba-completa&barber=${booking.barberId}`);
  const target = av.slots.find((s) => s.startUtc !== booking.startUtc).time;
  const moved = await api(`api/bookings/${booking.id}/reschedule`, { method: "POST", token, body: { date, time: target } });
  assert.equal(moved.status, 200, JSON.stringify(moved.body));
  const cancelled = await api(`api/bookings/${booking.id}/cancel`, { method: "POST", token, body: {} });
  assert.equal(cancelled.body.booking.status, "cancelled");
  assert.equal((await api(`api/bookings/${booking.id}`, { token })).status, 404);
});

await check("API: limite di prenotazioni attive per telefono (429)", async () => {
  const { date, times } = await freeDay(8);
  const me = customer(5);
  assert.equal((await api("api/bookings", { method: "POST", body: { serviceId: "taglio-uomo", date, time: times[4], ...me } })).status, 201);
  assert.equal((await api("api/bookings", { method: "POST", body: { serviceId: "taglio-uomo", date, time: times[5], ...me } })).status, 201);
  const third = await api("api/bookings", { method: "POST", body: { serviceId: "taglio-uomo", date, time: times[6], ...me } });
  assert.equal(third.status, 429);
  assert.equal(third.body.error, "too_many_active");
});

await check("API: dati non validi → 422 campo per campo", async () => {
  const { date, times } = await freeDay();
  const res = await api("api/bookings", { method: "POST", body: { serviceId: "taglio-uomo", date, time: times[0], name: "x", phone: "12", privacy: false } });
  assert.equal(res.status, 422);
  assert.deepEqual(Object.keys(res.body.fields).sort(), ["name", "phone", "privacy"]);
});

await check("Festivi: il sito considera chiuso l'8 dicembre (martedì)", async () => {
  const site = await (await fetch(new URL("/api/bookings?date=2026-12-08&servizio=taglio-uomo", SITE))).json();
  assert.equal(site.aperto, false);
  assert.equal(site.liberi, 0);
});

await check("Promemoria: rotta del cron protetta da CRON_SECRET", async () => {
  if (!process.env.CRON_SECRET) throw skip("CRON_SECRET non impostato per la prova");
  assert.equal((await api("api/cron/promemoria")).status, 401);
  const ok = await api("api/cron/promemoria", { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(typeof ok.body.inviati, "number");
});

/* ── Browser ──────────────────────────────────────────────────────────── */

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const phone = { ...devices["Pixel 7"] };

async function newPage(contextOptions = {}) {
  const context = await browser.newContext({ ...phone, ...contextOptions });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return { context, page, errors };
}

async function waitForController(page) {
  await page.evaluate(() => navigator.serviceWorker.ready);
  if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
}

async function bookThroughUi(page, { name = `Mario Rossi ${RUN}`, tel, pickSlot = 0 } = {}) {
  await page.goto(BASE + "index.html#booking");
  await page.reload(); // caricamento completo: un cambio di sola # terrebbe lo stato vecchio
  await page.locator('label[for="barber-francesco"]').click();
  await page.locator("#step-next").click();
  await page.locator('label[for="service-taglio-uomo"]').click();
  await page.locator("#step-next").click();
  await page.locator("#slot-options input").first().waitFor({ state: "attached" });
  const slot = page.locator("#slot-options .choice-body").nth(pickSlot);
  const time = (await slot.textContent()).trim();
  await slot.click();
  const date = await page.locator("#date-options input:checked").getAttribute("value");
  await page.locator("#step-next").click();
  await page.fill("#f-name", name);
  await page.fill("#f-phone", tel);
  if (!(await page.isChecked("#f-privacy"))) await page.locator('label[for="f-privacy"]').click({ position: { x: 5, y: 5 } });
  await page.locator("#step-next").click();
  await page.locator("#summary").waitFor();
  return { date, time, name };
}

await check("pagina caricata da /app, service worker attivo, nessun errore in console", async () => {
  main = await newPage();
  await main.page.goto(new URL("/app", BASE).href); // redirect a /app/index.html
  assert.ok(main.page.url().endsWith("/app/index.html"), main.page.url());
  await main.page.locator("#service-list .menu-item").first().waitFor();
  await waitForController(main.page);
  assert.equal(await main.page.locator("#demo-banner").isHidden(), true);
  assert.equal(await main.page.locator("#price-note").isVisible(), true); // listino non confermato
  assert.deepEqual(main.errors, []);
});

await check("manifest valido e app installabile (CDP, profilo non incognito)", async () => {
  const profile = mkdtempSync(join(tmpdir(), "hb-profile-"));
  const ctx = await chromium.launchPersistentContext(profile, { ...phone, executablePath: process.env.CHROMIUM_PATH || undefined });
  try {
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    await page.goto(BASE + "index.html");
    await waitForController(page);
    const cdp = await ctx.newCDPSession(page);
    const manifest = await cdp.send("Page.getAppManifest");
    assert.deepEqual(manifest.errors, [], JSON.stringify(manifest.errors));
    const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
    assert.deepEqual(installabilityErrors, [], JSON.stringify(installabilityErrors));
  } finally {
    await ctx.close();
    rmSync(profile, { recursive: true, force: true });
  }
});

let uiBooking;
await check("prenotazione completa dall'interfaccia → confermata, .ics, promemoria proposti", async () => {
  const { page } = main;
  uiBooking = await bookThroughUi(page, { tel: phoneFor(6) });
  await page.locator("#step-next").click();
  await page.getByText("Prenotazione confermata").waitFor();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Aggiungi al calendario" }).click()]);
  assert.match(readFileSync(await download.path(), "utf8"), /DTSTART:\d{8}T\d{6}Z/);
  await page.getByText("Vuoi i promemoria?").waitFor();
});

await check("l'appuntamento preso dall'app compare nell'agenda di Francesco", async () => {
  if (!process.env.ADMIN_PASSWORD) throw skip("ADMIN_PASSWORD non impostata per la prova");
  const admin = await newPage({ viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false });
  try {
    await admin.page.goto(new URL(`/admin?data=${uiBooking.date}`, SITE).href);
    await admin.page.fill('input[name="password"]', process.env.ADMIN_PASSWORD);
    await admin.page.locator('button[type="submit"]').click();
    await admin.page.waitForURL(/\/admin(\?|$)/);
    await admin.page.goto(new URL(`/admin?data=${uiBooking.date}`, SITE).href);
    await admin.page.getByText(uiBooking.name).first().waitFor({ timeout: 15_000 });
    await admin.page.getByText(uiBooking.name).first().click();
    await admin.page.getByText(/App del cliente/).waitFor();
  } finally {
    await admin.context.close();
  }
});

await check("Gestisci prenotazione: disdetta con conferma", async () => {
  const { page } = main;
  await page.getByRole("link", { name: "Gestisci prenotazione" }).first().click();
  await page.locator("#gestisci:not([hidden])").waitFor();
  await page.locator("#manage-body .badge-ok").waitFor();
  await page.getByRole("button", { name: "Disdici" }).click();
  await page.locator("#confirm-ok").click();
  await page.locator("#manage-body .badge-err").waitFor();
});

await check("'Ripeti l'ultimo taglio' porta a giorno e ora con il servizio già scelto", async () => {
  const { page } = main;
  await page.goto(BASE + "index.html");
  await page.locator("#repeat-card:not([hidden])").waitFor();
  await page.locator("#repeat-btn").click();
  await page.locator('fieldset[data-step="3"]:not([hidden])').waitFor();
  await page.locator("#step-back").click();
  assert.equal(await page.isChecked("#service-taglio-uomo"), true);
});

await check("orario preso nel frattempo → 409 → si torna al passo 3 con il messaggio", async () => {
  const { page } = main;
  const picked = await bookThroughUi(page, { tel: phoneFor(7), pickSlot: 3 });
  const rival = await api("api/bookings", { method: "POST", body: { barberId: "francesco", serviceId: "taglio-uomo", date: picked.date, time: picked.time, ...customer(8) } });
  assert.equal(rival.status, 201);
  await page.locator("#step-next").click();
  await page.locator('fieldset[data-step="3"]:not([hidden])').waitFor();
  await page.locator('#slot-message[data-tone="error"]').waitFor();
  assert.match(await page.locator("#slot-message").textContent(), /non è più disponibile/);
});

await check("offline: app dalla cache, richiesta 'in attesa', confermata al ritorno della rete", async () => {
  const { page, context } = main;
  await page.goto(BASE + "index.html");
  await waitForController(page);
  await bookThroughUi(page, { tel: phoneFor(9), pickSlot: 6 }); // scalda la cache degli orari
  await context.setOffline(true);
  await page.reload();
  await page.locator("#net-status:not([hidden])").waitFor();
  await bookThroughUi(page, { tel: phoneFor(9), pickSlot: 6 });
  // L'emulazione offline di Playwright copre la pagina ma non il service
  // worker: Background Sync può inviare subito. Si registra cosa ha mostrato
  // la pagina invece di fare a gara.
  await page.evaluate(() => {
    window.__sawPending = false;
    new MutationObserver(() => {
      const done = document.getElementById("booking-done");
      if (!done.hidden && done.textContent.includes("In attesa di invio") && !done.textContent.includes("Prenotazione confermata")) window.__sawPending = true;
    }).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
  });
  await page.locator("#step-next").click();
  await page.waitForFunction(() => window.__sawPending === true);
  await context.setOffline(false);
  await page.getByText("Prenotazione confermata").first().waitFor({ timeout: 15_000 });
  assert.deepEqual(await page.evaluate(() => self.HBOutbox.all()), []);
});

await check("push (inviato da DevTools) → notifica; NAVIGATE porta a #booking", async () => {
  const { page, context } = main;
  await context.grantPermissions(["notifications"], { origin: ORIGIN });
  await page.goto(BASE + "index.html");
  await waitForController(page);
  const cdp = await context.newCDPSession(page);
  await cdp.send("ServiceWorker.enable");
  const regId = await new Promise((resolve) => {
    cdp.on("ServiceWorker.workerRegistrationUpdated", ({ registrations }) => {
      const r = registrations.find((x) => x.scopeURL === BASE && !x.isDeleted);
      if (r) resolve(r.registrationId);
    });
  });
  const find = async (title) => {
    for (let i = 0; i < 50; i++) {
      const n = await page.evaluate(async (t) => {
        const x = (await (await navigator.serviceWorker.ready).getNotifications()).find((y) => y.title === t);
        return x ? { body: x.body, url: x.data?.url } : null;
      }, title);
      if (n) return n;
      await page.waitForTimeout(100);
    }
    throw new Error(`notifica "${title}" non mostrata`);
  };
  await cdp.send("ServiceWorker.deliverPushMessage", { origin: ORIGIN, registrationId: regId, data: JSON.stringify({ title: "Domani: Taglio uomo alle 10:00", body: "Prova", url: "index.html#booking", tag: "t1" }) });
  assert.equal((await find("Domani: Taglio uomo alle 10:00")).url, "index.html#booking");
  await cdp.send("ServiceWorker.deliverPushMessage", { origin: ORIGIN, registrationId: regId, data: "" });
  assert.equal((await find("History Barber")).url, "./index.html#booking");
  await page.goto(BASE + "index.html#home");
  await page.evaluate(() => {
    navigator.serviceWorker.dispatchEvent(new MessageEvent("message", { data: { type: "NAVIGATE", url: new URL("index.html#booking", location.href).href } }));
  });
  await page.waitForFunction(() => location.hash === "#booking");
});

await check("iOS Safari (simulato): banner → guida passo passo, Esc la chiude", async () => {
  const ios = await newPage({ ...devices["iPhone 14"] });
  await ios.page.goto(BASE + "index.html");
  await ios.page.locator("#install-banner:not([hidden])").waitFor({ timeout: 6000 });
  await ios.page.locator("#install-accept").click();
  await ios.page.locator("#ios-guide[open]").waitFor();
  await ios.page.keyboard.press("Escape");
  assert.equal(await ios.page.locator("#ios-guide").evaluate((d) => d.open), false);
  await ios.context.close();
});

await check("aggiornamento del SW: 'Nuova versione disponibile' → Aggiorna → versione nuova", async () => {
  // Il server di sviluppo serve public/ dal disco: si cambia la versione e la
  // si rimette com'era alla fine.
  const swPath = join(ROOT, "public", "app", "sw.js");
  const original = readFileSync(swPath, "utf8");
  const up = await newPage();
  try {
    await up.page.goto(BASE + "index.html");
    await waitForController(up.page);
    const current = /const VERSION = "([^"]+)"/.exec(original)[1];
    writeFileSync(swPath, original.replace(`const VERSION = "${current}"`, `const VERSION = "${current}-e2e"`));
    await up.page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await up.page.getByText("Nuova versione disponibile").waitFor({ timeout: 15_000 });
    await Promise.all([up.page.waitForEvent("load"), up.page.getByRole("button", { name: "Aggiorna" }).click()]);
    await up.page.waitForFunction((v) => caches.keys().then((k) => k.includes(`hb-shell-${v}-e2e`)), current);
    assert.ok(!(await up.page.evaluate(() => caches.keys())).includes(`hb-shell-${current}`));
  } finally {
    writeFileSync(swPath, original);
    await up.context.close();
  }
});

await check("nessun errore in console durante la sessione", async () => {
  const real = main.errors.filter((e) => !/net::ERR_INTERNET_DISCONNECTED|Failed to load resource|Failed to fetch/.test(e));
  assert.deepEqual(real, [], real.join(" | "));
});

await browser.close();
for (const r of results) console.log(r.join("  "));
const count = (s) => results.filter((r) => r[0] === s).length;
console.log(`\n${count("PASS")} passed, ${count("SKIP")} skipped, ${count("FAIL")} failed`);
process.exit(count("FAIL") ? 1 : 0);

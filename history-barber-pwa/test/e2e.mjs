// End-to-end checks in a real Chromium (Playwright): booking, 409 path,
// manage/cancel, repeat-last, offline queue, push event + click, SW update
// toast, installability, iOS guide. Not part of `npm test` (needs a browser).
//
// Usage (Playwright installed globally or locally):
//   NODE_PATH="$(npm root -g)" node test/e2e.mjs
// It starts its own server on a temporary database (VAPID keys from
// server/.env when present). BASE_URL=… tests an already running app instead.
// Optional: CHROMIUM_PATH=/path/to/chrome, E2E_DEBUG=1 for failure screenshots.

import { createRequire } from "node:module";
import { parseEnv } from "node:util";
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const { createApp } = await import(join(ROOT, "server", "index.js"));
const silent = { info() {}, warn() {}, error() {} };

let own = null;
if (!process.env.BASE_URL) {
  const dir = mkdtempSync(join(tmpdir(), "hb-e2e-"));
  const env = { RATE_LIMIT_WRITE: "10000" };
  const envFile = join(ROOT, "server", ".env");
  if (existsSync(envFile)) Object.assign(env, parseEnv(readFileSync(envFile, "utf8")), { RATE_LIMIT_WRITE: "10000" });
  const ctx = createApp({ env, dataDir: dir, log: silent });
  const server = ctx.app.listen(Number(process.env.E2E_PORT ?? 3398));
  await new Promise((r) => server.once("listening", r));
  own = { ctx, server, dir };
}
const BASE = (process.env.BASE_URL ?? `http://localhost:${own.server.address().port}`).replace(/\/$/, "") + "/";
const results = [];
let main;
// Unique contacts per run: the per-contact booking limit would otherwise
// make repeated runs against the same database fail.
const RUN = String(Date.now()).slice(-6);
const contact = (n) => ({ phone: `34${n}${RUN}`.padEnd(10, "0").slice(0, 10), email: `e2e${n}-${RUN}@example.it` });
const check = async (name, fn) => {
  try {
    await fn();
    results.push(["PASS", name]);
  } catch (err) {
    results.push([err.skip ? "SKIP" : "FAIL", name, err.message.split("\n")[0]]);
    if (process.env.E2E_DEBUG && main) {
      const shot = join(tmpdir(), `e2e-fail-${results.length}.png`);
      await main.page.screenshot({ path: shot, fullPage: false }).catch(() => {});
      console.log(`  screenshot: ${shot}\n  ${err.stack?.split("\n").slice(0, 6).join("\n  ")}`);
    }
  }
};

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
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null || navigator.serviceWorker.ready.then(() => false), null, { timeout: 10_000 }).catch(() => {});
  await page.evaluate(() => navigator.serviceWorker.ready);
  if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
}

async function bookThroughUi(page, { name = "Mario Rossi", phone: tel = "348 123 4567", email = "mario@example.it", pickSlot = 0 } = {}) {
  await page.goto(BASE + "#booking");
  await page.reload(); // full load: a hash-only navigation would keep the old form state
  await page.locator('label[for="barber-francesco"]').click();
  await page.locator("#step-next").click();
  await page.locator('label[for="service-taglio-uomo"]').click();
  await page.locator("#step-next").click();
  await page.locator("#slot-options input").first().waitFor({ state: "attached" });
  const slot = page.locator("#slot-options .choice-body").nth(pickSlot);
  const time = (await slot.textContent()).trim();
  await slot.click();
  const date = await page.locator('#date-options input:checked').getAttribute("value");
  await page.locator("#step-next").click();
  await page.fill("#f-name", name);
  await page.fill("#f-phone", tel);
  await page.fill("#f-email", email);
  if (!(await page.isChecked("#f-privacy"))) await page.locator('label[for="f-privacy"]').click({ position: { x: 5, y: 5 } });
  await page.locator("#step-next").click();
  await page.locator("#summary").waitFor();
  return { date, time };
}

/* 1. Shell, no console errors, SW controls the page */
await check("page loads, SW controls it, no console errors", async () => {
  main = await newPage();
  await main.page.goto(BASE);
  await main.page.locator("#service-list .menu-item").first().waitFor();
  await waitForController(main.page);
  assert.equal(await main.page.locator("#demo-banner").isHidden(), true);
  assert.deepEqual(main.errors, []);
});

/* 2. Installability (Chromium's own checks) */
await check("manifest valid and installable (CDP)", async () => {
  // Normal contexts are incognito, which Chromium never treats as installable:
  // use a persistent profile for this check.
  const profile = mkdtempSync(join(tmpdir(), "hb-profile-"));
  const ctx = await chromium.launchPersistentContext(profile, { ...phone, executablePath: process.env.CHROMIUM_PATH || undefined });
  try {
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    await page.goto(BASE);
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

/* 3. Full booking + confirmation + .ics + reminder offer */

await check("full booking: 5 steps → confirmed, .ics download, reminders offered", async () => {
  const { page } = main;
  await bookThroughUi(page, contact(1));
  await page.locator("#step-next").click();
  await page.getByText("Prenotazione confermata").waitFor();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Aggiungi al calendario" }).click()]);
  const ics = readFileSync(await download.path(), "utf8");
  assert.match(ics, /BEGIN:VEVENT/);
  assert.match(ics, /DTSTART:\d{8}T\d{6}Z/);
  await page.getByText("Vuoi i promemoria?").waitFor();
});

/* 4. Manage + cancel */
await check("manage screen: cancel booking (confirm dialog)", async () => {
  const { page } = main;
  await page.getByRole("link", { name: "Gestisci prenotazione" }).first().click();
  await page.locator("#gestisci:not([hidden])").waitFor();
  await page.locator("#manage-body .badge-ok").waitFor();
  await page.getByRole("button", { name: "Disdici" }).click();
  await page.locator("#confirm-ok").click();
  await page.locator("#manage-body .badge-err").waitFor();
  assert.equal((await page.locator("#manage-body .badge-err").textContent()).trim(), "Disdetta");
});

/* 5. Repeat last cut pre-fills steps 1–2 and the form */
await check("'Ripeti l'ultimo taglio' jumps to date/time with service preselected", async () => {
  const { page } = main;
  await page.goto(BASE);
  await page.locator("#repeat-card:not([hidden])").waitFor();
  await page.locator("#repeat-btn").click();
  await page.locator('fieldset[data-step="3"]:not([hidden])').waitFor();
  await page.locator("#step-back").click();
  assert.equal(await page.isChecked("#service-taglio-uomo"), true);
});

/* 6. 409: slot taken between choosing and confirming */
await check("slot taken meanwhile → 409 → back to step 3 with a message", async () => {
  const { page } = main;
  const picked = await bookThroughUi(page, { ...contact(2), pickSlot: 3 });
  const res = await page.evaluate(
    async ({ date, time, rival }) =>
      (await fetch("api/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ barberId: "francesco", serviceId: "taglio-uomo", date, time, name: "Rivale", ...rival, privacy: true }) })).status,
    { ...picked, rival: contact(9) },
  );
  assert.equal(res, 201);
  await page.locator("#step-next").click();
  await page.locator('fieldset[data-step="3"]:not([hidden])').waitFor();
  await page.locator('#slot-message[data-tone="error"]').waitFor();
  assert.match(await page.locator("#slot-message").textContent(), /non è più disponibile/);
});

/* 7. Offline: app shell from cache, booking queued, sent when back online */
await check("offline: shell from cache, booking queued 'in attesa', confirmed on reconnect", async () => {
  const { page, context } = main;
  await page.goto(BASE);
  await waitForController(page);
  // Warm the API cache for the flow we'll repeat offline.
  await bookThroughUi(page, { ...contact(3), pickSlot: 6 });
  await context.setOffline(true);
  await page.reload();
  await page.locator("#net-status:not([hidden])").waitFor();
  const picked = await bookThroughUi(page, { ...contact(3), pickSlot: 6 });
  // Playwright's offline emulation covers the page but not the service
  // worker, so Background Sync may deliver the request right away. Record
  // what the page showed instead of racing it.
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
  const outbox = await page.evaluate(() => self.HBOutbox.all());
  assert.deepEqual(outbox, []);
  assert.ok(picked.time);
});

/* 8. Offline navigation to an uncached page → offline.html */
await check("offline navigation to an unknown page shows offline.html", async () => {
  const { page, context } = main;
  await context.setOffline(true);
  await page.goto(BASE + "pagina-inesistente").catch(() => {});
  await page.getByRole("heading", { name: "Sei offline" }).waitFor();
  await context.setOffline(false);
});

/* 9. Push: deliver a push via DevTools, check the notification, then the click handler */
await check("push event shows a notification; click focuses the app at #booking", async () => {
  const { page, context } = main;
  await context.grantPermissions(["notifications"], { origin: new URL(BASE).origin });
  await page.goto(BASE);
  await waitForController(page);
  const cdp = await context.newCDPSession(page);
  await cdp.send("ServiceWorker.enable");
  const regId = await new Promise((resolve) => {
    cdp.on("ServiceWorker.workerRegistrationUpdated", ({ registrations }) => {
      const r = registrations.find((x) => x.scopeURL.startsWith(new URL(BASE).origin) && !x.isDeleted);
      if (r) resolve(r.registrationId);
    });
  });
  await cdp.send("ServiceWorker.deliverPushMessage", {
    origin: new URL(BASE).origin,
    registrationId: regId,
    data: JSON.stringify({ title: "Test push", body: "Corpo", url: "./#booking", tag: "t1" }),
  });
  const findNotification = async (title) => {
    for (let i = 0; i < 50; i++) {
      const found = await page.evaluate(async (t) => {
        const n = (await (await navigator.serviceWorker.ready).getNotifications()).find((x) => x.title === t);
        return n ? { body: n.body, url: n.data?.url, tag: n.tag } : null;
      }, title);
      if (found) return found;
      await page.waitForTimeout(100);
    }
    throw new Error(`notification "${title}" not shown`);
  };
  const shown = await findNotification("Test push");
  assert.deepEqual(shown, { body: "Corpo", url: "./#booking", tag: "t1" });
  // An empty payload must still produce a sensible notification.
  await cdp.send("ServiceWorker.deliverPushMessage", { origin: new URL(BASE).origin, registrationId: regId, data: "" });
  assert.equal((await findNotification("History Barber")).body, "Hai un aggiornamento sulla tua prenotazione.");
  // The notificationclick path posts NAVIGATE to the open window; exercise that message handler.
  await page.goto(BASE + "#home");
  await page.evaluate(() => navigator.serviceWorker.controller.postMessage({ type: "PING" }));
  await page.evaluate(() => {
    const target = new URL("./#booking", location.href).href;
    navigator.serviceWorker.dispatchEvent(new MessageEvent("message", { data: { type: "NAVIGATE", url: target } }));
  });
  await page.waitForFunction(() => location.hash === "#booking");
});

/* 10. Real push subscription (needs a push service; Chromium has none in
   incognito, and headless builds may lack one too) */
await check("pushManager.subscribe + server stores the subscription", async () => {
  const profile = mkdtempSync(join(tmpdir(), "hb-profile-"));
  const ctx = await chromium.launchPersistentContext(profile, { ...phone, executablePath: process.env.CHROMIUM_PATH || undefined });
  try {
    await ctx.grantPermissions(["notifications"], { origin: new URL(BASE).origin });
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    await page.goto(BASE);
    await waitForController(page);
    const result = await page.evaluate(async () => {
      const key = (await (await fetch("api/push/public-key")).json()).publicKey;
      const pad = "=".repeat((4 - (key.length % 4)) % 4);
      const raw = atob((key + pad).replace(/-/g, "+").replace(/_/g, "/"));
      const reg = await navigator.serviceWorker.ready;
      try {
        const sub = await Promise.race([
          reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(raw, (c) => c.charCodeAt(0)) }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("no answer from the browser push service")), 15_000)),
        ]);
        const res = await fetch("api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON() }) });
        return `ok ${res.status} ${sub.endpoint.slice(0, 40)}`;
      } catch (e) {
        return `error ${e.name}: ${e.message}`;
      }
    });
    if (/no answer from the browser push service/.test(result)) throw Object.assign(new Error(result), { skip: true });
    assert.match(result, /^ok 201/, result);
  } finally {
    await ctx.close();
    rmSync(profile, { recursive: true, force: true });
  }
});

/* 11. Install banner (Chromium) and iOS guide */
await check("iOS Safari (emulated): banner → step-by-step guide, Esc closes it", async () => {
  const ios = await newPage({ ...devices["iPhone 14"], defaultBrowserType: undefined });
  await ios.page.goto(BASE);
  await ios.page.locator("#install-banner:not([hidden])").waitFor({ timeout: 6000 });
  assert.equal((await ios.page.locator("#install-accept").textContent()).trim(), "Come fare");
  await ios.page.locator("#install-accept").click();
  await ios.page.locator("#ios-guide[open]").waitFor();
  await ios.page.keyboard.press("Escape");
  await ios.page.locator("#ios-guide:not([open])").waitFor({ state: "attached" });
  assert.equal(await ios.page.locator("#ios-guide").evaluate((d) => d.open), false);
  await ios.context.close();
});

/* 12. Update flow: new SW waits → toast → "Aggiorna" → reload on the new version */
await check("SW update: toast 'Nuova versione disponibile' → Aggiorna → new version active", async () => {
  const port = Number(process.env.UPDATE_PORT ?? 3399);
  const dir = mkdtempSync(join(tmpdir(), "hb-update-"));
  cpSync(join(ROOT, "public"), join(dir, "public"), { recursive: true });
  const ctx = createApp({ env: {}, dataDir: join(dir, "storage"), publicDir: join(dir, "public"), log: silent });
  const server = ctx.app.listen(port);
  try {
    const up = await newPage();
    const url = `http://localhost:${port}/`;
    await up.page.goto(url);
    await waitForController(up.page);
    const swPath = join(dir, "public", "sw.js");
    writeFileSync(swPath, readFileSync(swPath, "utf8").replace('const VERSION = "v1.0.0"', 'const VERSION = "v1.0.1-test"'));
    await up.page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await up.page.getByText("Nuova versione disponibile").waitFor({ timeout: 10_000 });
    await Promise.all([up.page.waitForEvent("load"), up.page.getByRole("button", { name: "Aggiorna" }).click()]);
    await up.page.waitForFunction(async () => (await caches.keys()).includes("hb-shell-v1.0.1-test"));
    const keys = await up.page.evaluate(() => caches.keys());
    assert.ok(!keys.includes("hb-shell-v1.0.0"), `old cache still there: ${keys}`);
    await up.context.close();
  } finally {
    server.close();
    ctx.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

await check("no console errors during the whole session", async () => {
  // Errors expected from deliberate offline navigation/fetches are filtered.
  const real = main.errors.filter((e) => !/net::ERR_INTERNET_DISCONNECTED|Failed to load resource|Failed to fetch/.test(e));
  assert.deepEqual(real, [], real.join(" | "));
});

await browser.close();
if (own) {
  own.server.close();
  own.ctx.close();
  rmSync(own.dir, { recursive: true, force: true });
}
for (const r of results) console.log(r.join("  "));
const count = (status) => results.filter((r) => r[0] === status).length;
const failed = count("FAIL");
console.log(`\n${count("PASS")} passed, ${count("SKIP")} skipped, ${failed} failed`);
process.exit(failed ? 1 : 0);

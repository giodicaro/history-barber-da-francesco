import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../server/index.js";
import { zonedToUtc } from "../public/js/shared/time.js";

// Monday 12 Oct 2026, 08:00 in Rome. Tests move the clock by assigning `clock`.
let clock = Date.UTC(2026, 9, 12, 6, 0);
const quiet = { info() {}, warn() {}, error() {} };
let ctx, server, base, dir;

before(async () => {
  dir = mkdtempSync(join(tmpdir(), "hb-test-"));
  ctx = createApp({ env: { RATE_LIMIT_WRITE: "1000" }, dataDir: dir, now: () => clock, log: quiet });
  server = ctx.app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(() => {
  server.close();
  ctx.close();
  rmSync(dir, { recursive: true, force: true });
});

const call = async (method, path, body, headers = {}) => {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
};

let n = 0;
const customer = () => {
  n += 1;
  return { name: `Cliente ${n}`, phone: `34800000${String(n).padStart(2, "0")}`, email: `c${n}@example.it`, privacy: true };
};
const booking = (over = {}) => ({ barberId: "francesco", serviceId: "taglio-uomo", date: "2026-10-13", time: "09:00", ...customer(), ...over });

test("availability lists slots computed on the server", async () => {
  const { status, body } = await call("GET", "/availability?date=2026-10-13&service=taglio-uomo&barber=any");
  assert.equal(status, 200);
  assert.equal(body.slots.length, 38);
  assert.deepEqual(body.slots[0].barberIds, ["francesco"]);
});

test("create a booking, read it with the token, not without", async () => {
  const created = await call("POST", "/bookings", booking({ time: "08:30" }));
  assert.equal(created.status, 201);
  assert.ok(created.body.token);
  const { id } = created.body.booking;
  assert.equal(created.body.booking.canModify, true);

  const ok = await call("GET", `/bookings/${id}`, null, { "X-Booking-Token": created.body.token });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.booking.phone, created.body.booking.phone);
  assert.equal((await call("GET", `/bookings/${id}`, null, { "X-Booking-Token": "nope" })).status, 404);
  assert.equal((await call("GET", `/bookings/${id}`)).status, 404);

  const slots = (await call("GET", "/availability?date=2026-10-13&service=taglio-uomo&barber=francesco")).body.slots;
  assert.ok(!slots.some((s) => s.time === "08:30"));
});

test("double-booking race: 10 parallel requests, exactly one wins", async () => {
  const results = await Promise.all(Array.from({ length: 10 }, () => call("POST", "/bookings", booking({ time: "10:00" }))));
  const statuses = results.map((r) => r.status).sort();
  assert.deepEqual(statuses, [201, 409, 409, 409, 409, 409, 409, 409, 409, 409]);
  assert.equal(results.find((r) => r.status === 409).body.error, "slot_taken");
});

test("an overlapping slot of another service is rejected too", async () => {
  // 10:00–10:30 is taken; a 45-min skin fade at 09:30 would run until 10:15.
  const res = await call("POST", "/bookings", booking({ time: "09:30", serviceId: "skin-fade" }));
  assert.equal(res.status, 409);
});

test("the DB trigger refuses overlaps even if the app check is bypassed", () => {
  const start = zonedToUtc("2026-10-13", 10 * 60, "Europe/Rome");
  assert.throws(
    () =>
      ctx.db.insertBooking({
        id: "raw", clientRequestId: null, barberId: "francesco", serviceId: "taglio-uomo",
        startUtc: start + 15 * 60_000, endUtc: start + 45 * 60_000,
        name: "x", phone: "x", email: "x", notes: "", createdAt: clock,
      }),
    /slot_taken/,
  );
});

test("validation errors come back per field (422)", async () => {
  const res = await call("POST", "/bookings", booking({ phone: "12", email: "bad", privacy: false }));
  assert.equal(res.status, 422);
  assert.deepEqual(Object.keys(res.body.fields).sort(), ["email", "phone", "privacy"]);
});

test("idempotent retry with the same clientRequestId returns the same booking", async () => {
  const body = booking({ time: "11:00", clientRequestId: "6f1d1c9e-1111-4222-8333-944455556666" });
  const first = await call("POST", "/bookings", body);
  const again = await call("POST", "/bookings", body);
  assert.equal(first.status, 201);
  assert.equal(again.status, 200);
  assert.equal(again.body.booking.id, first.body.booking.id);
  assert.equal(again.body.token, first.body.token);
});

test("max active bookings per phone/email", async () => {
  const me = customer();
  assert.equal((await call("POST", "/bookings", booking({ ...me, time: "15:00" }))).status, 201);
  assert.equal((await call("POST", "/bookings", booking({ ...me, time: "16:00" }))).status, 201);
  const third = await call("POST", "/bookings", booking({ ...me, time: "17:00" }));
  assert.equal(third.status, 429);
  assert.equal(third.body.error, "too_many_active");
  // Same email, different phone, still counted.
  const fourth = await call("POST", "/bookings", booking({ ...me, phone: "3399999999", time: "17:30" }));
  assert.equal(fourth.status, 429);
});

test("reschedule moves the booking and frees the old slot", async () => {
  const created = await call("POST", "/bookings", booking({ date: "2026-10-14", time: "09:00" }));
  const { id } = created.body.booking;
  const moved = await call("POST", `/bookings/${id}/reschedule`, { token: created.body.token, date: "2026-10-14", time: "09:15" });
  assert.equal(moved.status, 200);
  assert.equal(moved.body.booking.startUtc, zonedToUtc("2026-10-14", 9 * 60 + 15, "Europe/Rome"));
  const slots = (await call("GET", "/availability?date=2026-10-14&service=taglio-uomo&barber=francesco")).body.slots.map((s) => s.time);
  assert.ok(slots.includes("08:30"));
  assert.ok(!slots.includes("09:15"));
});

test("cancel works before the cutoff and is refused within 2 hours", async () => {
  const early = await call("POST", "/bookings", booking({ date: "2026-10-15", time: "09:00" }));
  const cancelled = await call("POST", `/bookings/${early.body.booking.id}/cancel`, { token: early.body.token });
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.body.booking.status, "cancelled");
  // The freed slot can be booked again.
  assert.equal((await call("POST", "/bookings", booking({ date: "2026-10-15", time: "09:00" }))).status, 201);

  const late = await call("POST", "/bookings", booking({ date: "2026-10-16", time: "10:00" }));
  const saved = clock;
  clock = zonedToUtc("2026-10-16", 8 * 60 + 30, "Europe/Rome"); // 90 min before
  try {
    const refused = await call("POST", `/bookings/${late.body.booking.id}/cancel`, { token: late.body.token });
    assert.equal(refused.status, 403);
    assert.equal(refused.body.error, "cutoff_passed");
    const view = await call("GET", `/bookings/${late.body.booking.id}`, null, { "X-Booking-Token": late.body.token });
    assert.equal(view.body.booking.canModify, false);
  } finally {
    clock = saved;
  }
});

test("push routes: disabled without VAPID keys, subscription needs the booking token", async () => {
  assert.equal((await call("GET", "/push/public-key")).status, 503);
  const sub = { endpoint: "https://push.example.com/abc", keys: { p256dh: "k", auth: "a" } };
  const created = await call("POST", "/bookings", booking({ date: "2026-10-17", time: "09:00" }));
  assert.equal((await call("POST", "/push/subscribe", { subscription: sub, bookingId: created.body.booking.id })).status, 404);
  assert.equal((await call("POST", "/push/subscribe", { subscription: sub, bookingId: created.body.booking.id, token: created.body.token })).status, 201);
  assert.equal(ctx.db.subscriptionsForBooking(created.body.booking.id).length, 1);
  // pushsubscriptionchange: links move to the new endpoint.
  const fresh = { endpoint: "https://push.example.com/def", keys: { p256dh: "k2", auth: "a2" } };
  assert.equal((await call("POST", "/push/subscribe", { subscription: fresh, oldEndpoint: sub.endpoint })).status, 201);
  assert.deepEqual(ctx.db.subscriptionsForBooking(created.body.booking.id).map((s) => s.endpoint), [fresh.endpoint]);
});

test("reminder scheduler: 24h and 2h windows, each sent once", async () => {
  const created = await call("POST", "/bookings", booking({ date: "2026-10-20", time: "10:00" }));
  const { id, startUtc } = created.body.booking;
  const saved = clock;
  try {
    clock = startUtc - 23 * 3_600_000;
    let due = ctx.db.dueReminders(clock);
    assert.ok(due.h24.some((b) => b.id === id));
    assert.ok(!due.h2.some((b) => b.id === id));
    await ctx.push.runReminders();
    assert.ok(!ctx.db.dueReminders(clock).h24.some((b) => b.id === id)); // flagged, not resent

    clock = startUtc - 90 * 60_000;
    due = ctx.db.dueReminders(clock);
    assert.ok(due.h2.some((b) => b.id === id));
    const payload = ctx.push.reminderPayload(created.body.booking, "2h");
    assert.match(payload.title, /^Tra 2 ore: Taglio uomo alle 10:00$/);
    assert.equal(payload.url, "./#booking");
  } finally {
    clock = saved;
  }
});

test("write rate limit answers 429 with Retry-After", async () => {
  const dir2 = mkdtempSync(join(tmpdir(), "hb-rl-"));
  const small = createApp({ env: { RATE_LIMIT_WRITE: "2" }, dataDir: dir2, now: () => clock, log: quiet });
  const srv = small.app.listen(0);
  await new Promise((r) => srv.once("listening", r));
  const url = `http://127.0.0.1:${srv.address().port}/api/push/unsubscribe`;
  const post = () => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  try {
    assert.equal((await post()).status, 200);
    assert.equal((await post()).status, 200);
    const third = await post();
    assert.equal(third.status, 429);
    assert.ok(Number(third.headers.get("retry-after")) > 0);
  } finally {
    srv.close();
    small.close();
    rmSync(dir2, { recursive: true, force: true });
  }
});

test("unknown API routes answer JSON 404; static files are served", async () => {
  assert.equal((await call("GET", "/nope")).status, 404);
  const res = await fetch(base.replace("/api", "/manifest.webmanifest"));
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /application\/manifest\+json/);
});

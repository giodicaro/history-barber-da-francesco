import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { computeSlots, computeDays, pickBarber } from "../public/js/shared/slots.js";
import { zonedToUtc, utcToZoned, tzOffset } from "../public/js/shared/time.js";
import { normalizePhone, validateCustomer } from "../public/js/shared/validation.js";

const base = JSON.parse(readFileSync(new URL("../public/data/shop.json", import.meta.url)));
const shopWith = (patch = {}) => ({ ...structuredClone(base), ...patch });
const twoBarbers = () => {
  const s = shopWith();
  s.barbers = [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
  ];
  return s;
};

// Monday 12 Oct 2026, 08:00 in Rome (CEST, UTC+2).
const MONDAY_8 = Date.UTC(2026, 9, 12, 6, 0);
const at = (iso) => Date.parse(iso);

test("Rome offset: +1h in winter, +2h in summer", () => {
  assert.equal(tzOffset(at("2026-01-15T12:00:00Z"), "Europe/Rome"), 3_600_000);
  assert.equal(tzOffset(at("2026-07-15T12:00:00Z"), "Europe/Rome"), 7_200_000);
});

test("zonedToUtc / utcToZoned round-trip around both DST switches", () => {
  const cases = [
    ["2026-03-28", 9 * 60, "2026-03-28T08:00:00.000Z"], // CET
    ["2026-03-29", 9 * 60, "2026-03-29T07:00:00.000Z"], // DST day, CEST
    ["2026-10-24", 9 * 60, "2026-10-24T07:00:00.000Z"], // CEST
    ["2026-10-25", 9 * 60, "2026-10-25T08:00:00.000Z"], // DST end, CET
    ["2026-10-25", 1 * 60, "2026-10-24T23:00:00.000Z"], // before the 03:00 → 02:00 switch
  ];
  for (const [date, minutes, iso] of cases) {
    const utc = zonedToUtc(date, minutes, "Europe/Rome");
    assert.equal(new Date(utc).toISOString(), iso, `${date} ${minutes}`);
    assert.deepEqual(utcToZoned(utc, "Europe/Rome"), { date, minutes });
  }
});

test("a normal Tuesday: 38 half-hour slots, the first at 08:30 local", () => {
  const slots = computeSlots({ shop: base, date: "2026-10-13", serviceId: "taglio-uomo", barberId: "francesco", bookings: [], now: MONDAY_8 });
  assert.equal(slots.length, 17 + 21);
  assert.equal(slots[0].time, "08:30");
  assert.equal(new Date(slots[0].startUtc).toISOString(), "2026-10-13T06:30:00.000Z");
  assert.equal(slots.at(-1).time, "19:30");
  // Nothing during the lunch break, and no service overruns it.
  assert.ok(!slots.some((s) => s.time >= "12:31" && s.time < "14:30"));
});

test("long services must end before the shift closes", () => {
  const slots = computeSlots({ shop: base, date: "2026-10-13", serviceId: "skin-fade-barba", barberId: "francesco", bookings: [], now: MONDAY_8 });
  const morning = slots.filter((s) => s.time < "13:00");
  assert.equal(morning.at(-1).time, "11:45"); // 11:45 + 75 min = 13:00
  assert.equal(slots.at(-1).time, "18:45");
});

test("closed weekdays, closed dates and days outside the window have no slots", () => {
  const args = { shop: base, serviceId: "taglio-uomo", barberId: "francesco", bookings: [], now: MONDAY_8 };
  assert.equal(computeSlots({ ...args, date: "2026-10-12" }).length, 0); // Monday
  assert.equal(computeSlots({ ...args, date: "2026-10-18" }).length, 0); // Sunday
  const closed = shopWith();
  closed.hours.closedDates = ["2026-10-13"];
  assert.equal(computeSlots({ ...args, shop: closed, date: "2026-10-13" }).length, 0);
  assert.equal(computeSlots({ ...args, date: "2026-10-11" }).length, 0); // past
  assert.equal(computeSlots({ ...args, date: "2026-11-03" }).length, 0); // beyond 21 days
  assert.equal(computeSlots({ ...args, date: "2026-02-30" }).length, 0); // invalid
});

test("past slots and the minimum notice are excluded", () => {
  // Tuesday 10:10 local: with 60 min notice the first slot is 11:15.
  const now = Date.UTC(2026, 9, 13, 8, 10);
  const slots = computeSlots({ shop: base, date: "2026-10-13", serviceId: "taglio-uomo", barberId: "francesco", bookings: [], now });
  assert.equal(slots[0].time, "11:15");
});

test("taken slots: any overlap blocks the start time", () => {
  const start = zonedToUtc("2026-10-13", 10 * 60, "Europe/Rome");
  const bookings = [{ barberId: "francesco", startUtc: start, endUtc: start + 30 * 60_000 }];
  const times = computeSlots({ shop: base, date: "2026-10-13", serviceId: "taglio-uomo", barberId: "francesco", bookings, now: MONDAY_8 }).map((s) => s.time);
  assert.ok(times.includes("09:30"));
  assert.ok(!times.includes("09:45"));
  assert.ok(!times.includes("10:00"));
  assert.ok(!times.includes("10:15"));
  assert.ok(times.includes("10:30"));
});

test("'any' barber: a slot stays open while one barber is free", () => {
  const shop = twoBarbers();
  const start = zonedToUtc("2026-10-13", 10 * 60, "Europe/Rome");
  const bookings = [{ barberId: "a", startUtc: start, endUtc: start + 30 * 60_000 }];
  const ten = computeSlots({ shop, date: "2026-10-13", serviceId: "taglio-uomo", barberId: "any", bookings, now: MONDAY_8 }).find((s) => s.time === "10:00");
  assert.deepEqual(ten.barberIds, ["b"]);
  assert.equal(pickBarber(shop, ["a", "b"], bookings), "b"); // least busy
  assert.equal(pickBarber(shop, ["a", "b"], []), "a"); // tie → shop order
});

test("DST days produce a full day of slots at the right instants", () => {
  const shop = shopWith();
  shop.hours.days[0].shifts = [["09:00", "12:00"]]; // open on Sundays for this test
  const spring = computeSlots({ shop, date: "2026-03-29", serviceId: "taglio-uomo", barberId: "francesco", bookings: [], now: at("2026-03-20T10:00:00Z") });
  assert.equal(spring.length, 11);
  assert.equal(new Date(spring[0].startUtc).toISOString(), "2026-03-29T07:00:00.000Z");
  assert.equal(spring[0].endUtc - spring[0].startUtc, 30 * 60_000);
  const autumn = computeSlots({ shop, date: "2026-10-25", serviceId: "taglio-uomo", barberId: "francesco", bookings: [], now: at("2026-10-20T10:00:00Z") });
  assert.equal(autumn.length, 11);
  assert.equal(new Date(autumn[0].startUtc).toISOString(), "2026-10-25T08:00:00.000Z");
});

test("computeDays covers the booking window and flags closed days", () => {
  const days = computeDays({ shop: base, serviceId: "taglio-uomo", barberId: "any", bookings: [], now: MONDAY_8 });
  assert.equal(days.length, 21);
  assert.equal(days[0].date, "2026-10-12");
  assert.equal(days[0].closed, true);
  assert.equal(days[1].available, 38);
  assert.equal(days.find((d) => d.date === "2026-11-01").closed, true); // closed date (Sunday anyway)
});

test("phone normalisation accepts Italian formats", () => {
  assert.equal(normalizePhone("348 697 6353"), "+393486976353");
  assert.equal(normalizePhone("+39 348-697.6353"), "+393486976353");
  assert.equal(normalizePhone("0039 041 123456"), "+39041123456");
  assert.equal(normalizePhone("12345"), null);
  assert.equal(normalizePhone("348abc"), null);
});

test("customer validation returns Italian messages per field", () => {
  const bad = validateCustomer({ name: "x", phone: "1", email: "no", privacy: false });
  assert.equal(bad.ok, false);
  assert.deepEqual(Object.keys(bad.errors).sort(), ["email", "name", "phone", "privacy"]);
  const good = validateCustomer({ name: "  Mario\u0007 Rossi ", phone: "348 1234567", email: "Mario@Example.IT", privacy: true });
  assert.equal(good.ok, true);
  assert.deepEqual(good.value, { name: "Mario Rossi", phone: "+393481234567", email: "mario@example.it", notes: "" });
});

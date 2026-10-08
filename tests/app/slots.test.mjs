// Regole condivise dell'app (orari, fusi, validazione) e coerenza con il sito.
// npm run test:app — Node 22.18+ (legge i .ts senza build).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { computeSlots, computeDays, pickBarber } from "../../public/app/js/shared/slots.js";
import { zonedToUtc, utcToZoned, tzOffset } from "../../public/app/js/shared/time.js";
import { normalizePhone, validateCustomer } from "../../public/app/js/shared/validation.js";
import { festivita, festivitaDellAnno } from "../../lib/festivi.ts";
import { normalizzaTelefono } from "../../lib/prenotazioni/telefono.ts";
import * as salone from "../../lib/salone.ts";

const base = JSON.parse(readFileSync(new URL("../../public/app/data/shop.json", import.meta.url)));
const shopWith = () => structuredClone(base);
const twoBarbers = () => {
  const s = shopWith();
  s.barbers = [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
  ];
  return s;
};

// Lunedì 12 ottobre 2026, 08:00 a Roma (CEST, UTC+2).
const MONDAY_8 = Date.UTC(2026, 9, 12, 6, 0);
const at = (iso) => Date.parse(iso);

test("shop.json è allineato a lib/salone.ts (npm run app:dati)", () => {
  assert.equal(base.booking.slotStepMinutes, salone.PASSO_SLOT_MINUTI);
  assert.equal(base.booking.minNoticeMinutes, salone.PREAVVISO_MINUTI);
  assert.equal(base.booking.maxDaysAhead, salone.GIORNI_PRENOTABILI + 1);
  assert.equal(base.booking.cancelCutoffMinutes, salone.MODIFICABILE_FINO_A_MINUTI);
  assert.equal(base.shop.phone, salone.salone.telefono);
  const bookable = salone.listino.flatMap((g) => g.servizi).filter((s) => s.prenotabile !== false);
  assert.deepEqual(
    base.services.map((s) => [s.id, s.price, s.durationMinutes, s.sample]),
    bookable.map((s) => [s.id, s.prezzo, s.durata, !salone.LISTINO_CONFERMATO]),
  );
});

test("festività italiane calcolate, Pasquetta compresa", () => {
  assert.equal(festivita("2026-04-06"), "Lunedì dell'Angelo"); // Pasqua 5 aprile 2026
  assert.equal(festivita("2027-03-29"), "Lunedì dell'Angelo"); // Pasqua 28 marzo 2027
  assert.equal(festivita("2026-12-08"), "Immacolata Concezione");
  assert.equal(festivita("2026-10-13"), null);
  assert.equal(festivitaDellAnno(2026).size, 11);
});

test("stessa regola del telefono nell'app e nel sito", () => {
  for (const n of ["348 697 6353", "+39 348-697.6353", "0039 041 123456", "041 5223344", "3486976353", "12345", "348abc", "2345678901", "393486976353"]) {
    assert.equal(normalizePhone(n), normalizzaTelefono(n), n);
  }
});

test("scarto di Roma: +1h d'inverno, +2h d'estate", () => {
  assert.equal(tzOffset(at("2026-01-15T12:00:00Z"), "Europe/Rome"), 3_600_000);
  assert.equal(tzOffset(at("2026-07-15T12:00:00Z"), "Europe/Rome"), 7_200_000);
});

test("zonedToUtc / utcToZoned attorno ai due cambi d'ora", () => {
  const cases = [
    ["2026-03-28", 9 * 60, "2026-03-28T08:00:00.000Z"],
    ["2026-03-29", 9 * 60, "2026-03-29T07:00:00.000Z"],
    ["2026-10-24", 9 * 60, "2026-10-24T07:00:00.000Z"],
    ["2026-10-25", 9 * 60, "2026-10-25T08:00:00.000Z"],
    ["2026-10-25", 1 * 60, "2026-10-24T23:00:00.000Z"],
  ];
  for (const [date, minutes, iso] of cases) {
    const utc = zonedToUtc(date, minutes, "Europe/Rome");
    assert.equal(new Date(utc).toISOString(), iso, `${date} ${minutes}`);
    assert.deepEqual(utcToZoned(utc, "Europe/Rome"), { date, minutes });
  }
});

test("un martedì normale: 20 orari ogni 30 minuti, il primo alle 08:30", () => {
  const slots = computeSlots({ shop: base, date: "2026-10-13", serviceId: "taglio-uomo", barberId: "francesco", bookings: [], now: MONDAY_8 });
  assert.equal(slots.length, 9 + 11);
  assert.equal(slots[0].time, "08:30");
  assert.equal(new Date(slots[0].startUtc).toISOString(), "2026-10-13T06:30:00.000Z");
  assert.equal(slots.at(-1).time, "19:30");
  assert.ok(!slots.some((s) => s.time > "12:30" && s.time < "14:30"));
});

test("un servizio lungo deve finire prima della chiusura del turno", () => {
  const slots = computeSlots({ shop: base, date: "2026-10-13", serviceId: "skin-fade-barba", barberId: "francesco", bookings: [], now: MONDAY_8 });
  assert.equal(slots.filter((s) => s.time < "13:00").at(-1).time, "11:30");
  assert.equal(slots.at(-1).time, "18:30");
});

test("niente orari nei giorni chiusi, nei festivi e fuori dalla finestra", () => {
  const args = { shop: base, serviceId: "taglio-uomo", barberId: "francesco", bookings: [], now: MONDAY_8 };
  assert.equal(computeSlots({ ...args, date: "2026-10-12" }).length, 0); // lunedì
  assert.equal(computeSlots({ ...args, date: "2026-10-18" }).length, 0); // domenica
  assert.equal(computeSlots({ ...args, date: "2026-10-11" }).length, 0); // passato
  assert.equal(computeSlots({ ...args, date: "2026-11-03" }).length, 0); // oltre i 21 giorni
  assert.equal(computeSlots({ ...args, date: "2026-02-30" }).length, 0); // data impossibile
  const dec = Date.UTC(2026, 11, 1, 9, 0);
  assert.equal(computeSlots({ ...args, now: dec, date: "2026-12-08" }).length, 0); // Immacolata, martedì
  assert.ok(computeSlots({ ...args, now: dec, date: "2026-12-09" }).length > 0);
});

test("preavviso minimo: alle 10:10 il primo orario è 11:30", () => {
  const now = Date.UTC(2026, 9, 13, 8, 10);
  const slots = computeSlots({ shop: base, date: "2026-10-13", serviceId: "taglio-uomo", barberId: "francesco", bookings: [], now });
  assert.equal(slots[0].time, "11:30");
});

test("un appuntamento preso toglie gli orari che si sovrappongono", () => {
  const start = zonedToUtc("2026-10-13", 10 * 60, "Europe/Rome");
  const bookings = [{ barberId: "francesco", startUtc: start, endUtc: start + 30 * 60_000 }];
  const times = computeSlots({ shop: base, date: "2026-10-13", serviceId: "taglio-uomo", barberId: "francesco", bookings, now: MONDAY_8 }).map((s) => s.time);
  assert.ok(times.includes("09:30"));
  assert.ok(!times.includes("10:00"));
  assert.ok(times.includes("10:30"));
});

test("'Primo disponibile': l'orario resta finché un barbiere è libero", () => {
  const shop = twoBarbers();
  const start = zonedToUtc("2026-10-13", 10 * 60, "Europe/Rome");
  const bookings = [{ barberId: "a", startUtc: start, endUtc: start + 30 * 60_000 }];
  const ten = computeSlots({ shop, date: "2026-10-13", serviceId: "taglio-uomo", barberId: "any", bookings, now: MONDAY_8 }).find((s) => s.time === "10:00");
  assert.deepEqual(ten.barberIds, ["b"]);
  assert.equal(pickBarber(shop, ["a", "b"], bookings), "b");
  assert.equal(pickBarber(shop, ["a", "b"], []), "a");
});

test("i giorni del cambio d'ora hanno tutti gli orari, agli istanti giusti", () => {
  const shop = shopWith();
  shop.hours.days[0].shifts = [["09:00", "12:00"]]; // aperto di domenica, solo per la prova
  const spring = computeSlots({ shop, date: "2026-03-29", serviceId: "taglio-uomo", barberId: "francesco", bookings: [], now: at("2026-03-20T10:00:00Z") });
  assert.equal(spring.length, 6);
  assert.equal(new Date(spring[0].startUtc).toISOString(), "2026-03-29T07:00:00.000Z");
  const autumn = computeSlots({ shop, date: "2026-10-25", serviceId: "taglio-uomo", barberId: "francesco", bookings: [], now: at("2026-10-20T10:00:00Z") });
  assert.equal(autumn.length, 6);
  assert.equal(new Date(autumn[0].startUtc).toISOString(), "2026-10-25T08:00:00.000Z");
});

test("computeDays copre oggi + 21 giorni e segna i giorni chiusi", () => {
  const days = computeDays({ shop: base, serviceId: "taglio-uomo", barberId: "any", bookings: [], now: MONDAY_8 });
  assert.equal(days.length, 22);
  assert.equal(days[0].date, "2026-10-12");
  assert.equal(days[0].closed, true);
  assert.equal(days[1].available, 20);
  assert.equal(days.at(-1).date, "2026-11-02");
});

test("validazione del cliente: messaggi in italiano campo per campo, niente email", () => {
  const bad = validateCustomer({ name: "x", phone: "1", privacy: false });
  assert.equal(bad.ok, false);
  assert.deepEqual(Object.keys(bad.errors).sort(), ["name", "phone", "privacy"]);
  const good = validateCustomer({ name: "  Mario\u0007 Rossi ", phone: "348 1234567", privacy: true });
  assert.equal(good.ok, true);
  assert.deepEqual(good.value, { name: "Mario Rossi", phone: "+393481234567", notes: "" });
});

// "Gestisci il tuo appuntamento": le regole pure (lib/prenotazioni/gestione.ts,
// codice.ts, calendario.ts). Si lancia con npm test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatoCodice, normalizzaCodice, ALFABETO_CODICE } from "../lib/prenotazioni/codice.ts";
import { fileCalendario, istanteInRoma, romaInIstante } from "../lib/prenotazioni/calendario.ts";
import {
  generaCodice,
  generaToken,
  impronta,
  improntaCodice,
  nomeBreve,
  occupatiSenza,
  puoGestire,
  slotPerSpostamento,
  TOKEN_GESTIONE,
} from "../lib/prenotazioni/gestione.ts";

const REGOLE = { margineMinuti: 120, spostamentiMax: 2 };
const h = (ore, minuti = 0) => ore * 60 + minuti;

test("il codice usa solo l'alfabeto senza caratteri ambigui", () => {
  for (const c of "0O1IL") assert.ok(!ALFABETO_CODICE.includes(c), `contiene ${c}`);
  for (let i = 0; i < 200; i++) {
    const c = generaCodice();
    assert.match(c, /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
  }
});

test("il codice si normalizza e si formatta", () => {
  assert.equal(normalizzaCodice(" k7m-4qx "), "K7M4QX");
  assert.equal(normalizzaCodice("k7m 4qx99"), "K7M4QX");
  assert.equal(formatoCodice("k7m4qx"), "K7M-4QX");
  assert.equal(formatoCodice("k7"), "K7");
});

test("token e impronte", () => {
  const t = generaToken();
  assert.match(t, TOKEN_GESTIONE);
  assert.notEqual(generaToken(), t);
  assert.match(impronta(t), /^[0-9a-f]{64}$/);
  // Il codice vale solo con il suo telefono, ed è indifferente al formato.
  assert.equal(improntaCodice("+393470001111", "k7m-4qx"), improntaCodice("+393470001111", "K7M4QX"));
  assert.notEqual(improntaCodice("+393470001111", "K7M4QX"), improntaCodice("+393470002222", "K7M4QX"));
});

test("ora di Roma ⇄ istante, anche con l'ora legale", () => {
  // 4 novembre (ora solare, UTC+1) e 4 luglio (ora legale, UTC+2).
  assert.equal(new Date(romaInIstante("2026-11-04", h(10))).toISOString(), "2026-11-04T09:00:00.000Z");
  assert.equal(new Date(romaInIstante("2026-07-04", h(10))).toISOString(), "2026-07-04T08:00:00.000Z");
  assert.deepEqual(istanteInRoma(Date.parse("2026-11-04T09:00:00Z")), { data: "2026-11-04", minuti: h(10) });
});

test("termine di 120 minuti: dentro, al limite, fuori", () => {
  const a = { data: "2026-11-04", inizio: h(10), spostamenti: 0 };
  const alle = (iso) => Date.parse(iso);
  const prima = puoGestire(a, alle("2026-11-04T06:59:00Z"), REGOLE); // 07:59 a Roma
  assert.equal(prima.disdicibile, true);
  assert.equal(prima.spostabile, true);
  assert.deepEqual(prima.termine, { data: "2026-11-04", minuti: h(8) });
  assert.equal(puoGestire(a, alle("2026-11-04T07:00:00Z"), REGOLE).disdicibile, true); // 08:00 esatte
  const dopo = puoGestire(a, alle("2026-11-04T07:01:00Z"), REGOLE); // 08:01
  assert.equal(dopo.disdicibile, false);
  assert.equal(dopo.spostabile, false);
  assert.equal(dopo.motivoBlocco, "termine");
});

test("termine a cavallo del cambio d'ora (25 ottobre 2026, 03:00 → 02:00)", () => {
  // Appuntamento alle 09:00 del 25/10 (ora solare, UTC+1): termine alle 07:00.
  // Alle 06:30 di Roma (05:30 UTC) mancano 2 h 30: si può ancora.
  const a = { data: "2026-10-25", inizio: h(9), spostamenti: 0 };
  assert.equal(puoGestire(a, Date.parse("2026-10-25T05:30:00Z"), REGOLE).disdicibile, true);
  // Appuntamento alle 03:30 del 25/10, dopo il cambio (ora solare): 02:30 UTC.
  // Alle 01:30 di Roma (ora legale, 23:30 UTC del 24) a orologio mancano 2 h,
  // ma davvero 3 h perché nel mezzo l'orologio torna indietro di un'ora: si
  // può ancora. Il termine si calcola sugli istanti, non sui minuti scritti.
  const s = puoGestire({ data: "2026-10-25", inizio: h(3, 30), spostamenti: 0 }, Date.parse("2026-10-24T23:30:00Z"), REGOLE);
  assert.equal(s.disdicibile, true);
  // Alle 00:45 UTC mancano davvero 1 h 45: oltre il termine.
  const s2 = puoGestire({ data: "2026-10-25", inizio: h(3, 30), spostamenti: 0 }, Date.parse("2026-10-25T00:45:00Z"), REGOLE);
  assert.equal(s2.disdicibile, false);
});

test("limite di spostamenti", () => {
  const presto = Date.parse("2026-11-01T08:00:00Z");
  const uno = puoGestire({ data: "2026-11-04", inizio: h(10), spostamenti: 1 }, presto, REGOLE);
  assert.equal(uno.spostabile, true);
  assert.equal(uno.spostamentiRimasti, 1);
  const due = puoGestire({ data: "2026-11-04", inizio: h(10), spostamenti: 2 }, presto, REGOLE);
  assert.equal(due.spostabile, false);
  assert.equal(due.disdicibile, true);
  assert.equal(due.motivoBlocco, "spostamenti");
});

test("spostando, l'appuntamento non occupa sé stesso", () => {
  // Martedì 3 novembre 2026: 10:00–10:50 è il suo, 11:00–11:30 di un altro.
  const occupati = [
    { id: "proprio", inizio: h(10), fine: h(10, 50) },
    { id: "altro", inizio: h(11), fine: h(11, 30) },
  ];
  assert.deepEqual(occupatiSenza(occupati, "proprio"), [{ inizio: h(11), fine: h(11, 30) }]);
  const slot = slotPerSpostamento({
    id: "proprio",
    data: "2026-11-03",
    giorno: 2,
    durata: 50,
    occupati,
    adesso: { data: "2026-11-01", minuti: h(9) },
  });
  const stato = (ora) => slot.find((s) => s.ora === ora);
  // 10:00 è il suo orario: senza contare sé stesso risulta libero.
  assert.equal(stato("10:00").disponibile, true);
  // 10:30 → 11:20 tocca l'appuntamento di un altro (11:00): resta occupato.
  assert.equal(stato("10:30").motivo, "occupato");
  assert.equal(stato("09:30").disponibile, true);
  // Senza togliere sé stesso, 09:30 (fino alle 10:20) risulterebbe occupato.
  const senzaRegola = slotPerSpostamento({ id: "nessuno", data: "2026-11-03", giorno: 2, durata: 50, occupati, adesso: { data: "2026-11-01", minuti: h(9) } });
  assert.equal(senzaRegola.find((s) => s.ora === "09:30").motivo, "occupato");
});

test("spostamento di mezz'ora sopra il proprio orario (servizio da 30 minuti)", () => {
  const occupati = [{ id: "proprio", inizio: h(10), fine: h(10, 30) }];
  const slot = slotPerSpostamento({ id: "proprio", data: "2026-11-03", giorno: 2, durata: 30, occupati, adesso: { data: "2026-11-01", minuti: h(9) } });
  assert.equal(slot.find((s) => s.ora === "10:30").disponibile, true);
  assert.equal(slot.find((s) => s.ora === "10:00").disponibile, true);
});

test("nome breve per gli avvisi", () => {
  assert.equal(nomeBreve("Mario Rossi"), "Mario R.");
  assert.equal(nomeBreve("  anna  maria verdi "), "anna V.");
  assert.equal(nomeBreve("Luca"), "Luca");
});

test("file .ics: orari in UTC, testo protetto, CRLF", () => {
  const ics = fileCalendario({
    uid: "x@history-barber",
    data: "2026-11-04",
    inizio: h(10),
    fine: h(10, 50),
    titolo: "Taglio, barba; e altro",
    luogo: "Via Ca' Rossa 47/A-B, Mestre",
    descrizione: "Per spostare: https://esempio.it/appuntamento/abc",
    adesso: Date.parse("2026-11-01T10:00:00Z"),
  });
  assert.match(ics, /DTSTART:20261104T090000Z\r\n/);
  assert.match(ics, /DTEND:20261104T095000Z\r\n/);
  assert.match(ics, /SUMMARY:Taglio\\, barba\\; e altro/);
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
});

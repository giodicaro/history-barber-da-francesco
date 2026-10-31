// Chiusure e ferie: la regola unica chiusoIl ("isClosed"), le validazioni,
// le unioni e i testi. Date pure "YYYY-MM-DD", nessun orario: anche a
// cavallo del cambio d'ora non scivola niente (test qui sotto).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  avvisoGiornoChiuso,
  chiusoIl,
  chiusureInVista,
  dataBreve,
  dataValida,
  giornoDopo,
  periodoParlato,
  sovrapposte,
  unione,
  validaChiusura,
} from "../lib/chiusure.ts";
import { calcolaStato } from "../lib/orari.ts";

const ferie = { id: "a", dal: "2026-08-10", al: "2026-08-24", motivo: "Ferie estive", attiva: true };

test("chiusoIl: estremi inclusi, fuori no", () => {
  assert.equal(chiusoIl("2026-08-09", [ferie]), null);
  assert.equal(chiusoIl("2026-08-10", [ferie])?.id, "a");
  assert.equal(chiusoIl("2026-08-15", [ferie])?.id, "a");
  assert.equal(chiusoIl("2026-08-24", [ferie])?.id, "a");
  assert.equal(chiusoIl("2026-08-25", [ferie]), null);
});

test("chiusoIl: una chiusura spenta non chiude; riaccesa sì", () => {
  assert.equal(chiusoIl("2026-08-15", [{ ...ferie, attiva: false }]), null);
  assert.equal(chiusoIl("2026-08-15", [{ ...ferie, attiva: true }])?.id, "a");
});

test("chiusoIl a cavallo del cambio d'ora (marzo e ottobre): nessuno slittamento", () => {
  const marzo = { id: "m", dal: "2026-03-28", al: "2026-03-30", attiva: true };
  assert.equal(chiusoIl("2026-03-27", [marzo]), null);
  assert.ok(chiusoIl("2026-03-29", [marzo])); // domenica del cambio
  assert.ok(chiusoIl("2026-03-30", [marzo]));
  assert.equal(chiusoIl("2026-03-31", [marzo]), null);
  const ottobre = { id: "o", dal: "2026-10-24", al: "2026-10-26", attiva: true };
  assert.equal(chiusoIl("2026-10-23", [ottobre]), null);
  assert.ok(chiusoIl("2026-10-25", [ottobre]));
  assert.ok(chiusoIl("2026-10-26", [ottobre]));
  assert.equal(chiusoIl("2026-10-27", [ottobre]), null);
  assert.equal(giornoDopo("2026-03-28"), "2026-03-29");
  assert.equal(giornoDopo("2026-03-29"), "2026-03-30");
  assert.equal(giornoDopo("2026-10-25"), "2026-10-26");
  assert.equal(giornoDopo("2026-12-31"), "2027-01-01");
});

test("validaChiusura: fine prima dell'inizio, passato, date vere", () => {
  const oggi = "2026-07-01";
  assert.deepEqual(validaChiusura({ dal: "2026-08-10", al: "2026-08-24" }, oggi), {});
  assert.equal(validaChiusura({ dal: "2026-08-24", al: "2026-08-10" }, oggi).al, "La data di fine viene prima della data di inizio");
  assert.equal(validaChiusura({ dal: "2026-06-01", al: "2026-06-10" }, oggi).al, "Questo periodo è già passato");
  // In corso (iniziata ieri, finisce domani): si può ancora modificare.
  assert.deepEqual(validaChiusura({ dal: "2026-06-30", al: "2026-07-02" }, oggi), {});
  assert.ok(validaChiusura({ dal: "2026-02-30", al: "2026-03-01" }, oggi).dal);
  assert.equal(dataValida("2026-02-28"), true);
  assert.equal(dataValida("2026-02-30"), false);
  assert.equal(dataValida("15/08/2026"), false);
});

test("sovrapposte e unione: anche i periodi attaccati si uniscono", () => {
  assert.equal(sovrapposte({ dal: "2026-08-10", al: "2026-08-15" }, { dal: "2026-08-14", al: "2026-08-20" }), true);
  assert.equal(sovrapposte({ dal: "2026-08-10", al: "2026-08-15" }, { dal: "2026-08-16", al: "2026-08-20" }), true);
  assert.equal(sovrapposte({ dal: "2026-08-10", al: "2026-08-15" }, { dal: "2026-08-17", al: "2026-08-20" }), false);
  assert.deepEqual(unione([{ dal: "2026-08-14", al: "2026-08-20" }, { dal: "2026-08-10", al: "2026-08-15" }]), { dal: "2026-08-10", al: "2026-08-20" });
});

test("chiusureInVista: le finite spariscono, le spente non si vedono", () => {
  const lista = [
    { id: "vecchia", dal: "2026-01-01", al: "2026-01-06", attiva: true },
    { id: "spenta", dal: "2026-09-01", al: "2026-09-02", attiva: false },
    ferie,
  ];
  assert.deepEqual(chiusureInVista(lista, "2026-08-20").map((c) => c.id), ["a"]);
  assert.deepEqual(chiusureInVista(lista, "2026-08-24").map((c) => c.id), ["a"]);
  assert.deepEqual(chiusureInVista(lista, "2026-08-25").map((c) => c.id), []);
});

test("testi per i clienti e per l'admin", () => {
  assert.equal(dataBreve("2026-08-15"), "15/08/2026");
  assert.equal(periodoParlato(ferie), "dal 10 al 24 agosto");
  assert.equal(periodoParlato({ dal: "2026-12-28", al: "2027-01-06" }), "dal 28 dicembre al 6 gennaio");
  assert.equal(periodoParlato({ dal: "2026-08-15", al: "2026-08-15" }), "il 15 agosto");
  assert.equal(avvisoGiornoChiuso(ferie), "Il salone è chiuso in questa data (Ferie estive). Scegli un altro giorno.");
  assert.equal(avvisoGiornoChiuso({}), "Il salone è chiuso in questa data. Scegli un altro giorno.");
});

test("Aperto ora: durante le ferie dice chiuso e riapre dopo", () => {
  // Mercoledì 12 agosto 2026, ore 10 a Roma (8 UTC, ora legale).
  const s = calcolaStato(new Date("2026-08-12T08:00:00Z"), [ferie]);
  assert.equal(s.aperto, false);
  assert.equal(s.ferie, "Ferie estive");
  // Si riapre martedì 25 agosto (lunedì 24 è ancora ferie, e il lunedì è chiuso).
  assert.match(s.riapre, /^il 25\/8 alle/);
  // Senza chiusure, alla stessa ora è aperto.
  assert.equal(calcolaStato(new Date("2026-08-12T08:00:00Z")).aperto, true);
});

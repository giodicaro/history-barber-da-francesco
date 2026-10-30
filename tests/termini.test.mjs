// Correzioni del 30/10/2026: regole che non si contraddicono (C1),
// ripensamento (C2), motivi degli orari (C5), cambio d'ora (C6).
// Orari fissi: niente Date.now(). Ottobre dopo il 25 è ora solare (UTC+1).
import { test } from "node:test";
import assert from "node:assert/strict";
import { puoGestire, slotPerSpostamento } from "../lib/prenotazioni/gestione.ts";
import { generaSlot } from "../lib/prenotazioni/slot.ts";
import {
  MARGINE_GESTIONE_MINUTI,
  PREAVVISO_MINUTI,
  RIPENSAMENTO_MINUTI,
  SPOSTAMENTI_MAX,
  ULTIMO_AVVISO_MINUTI,
} from "../lib/salone.ts";

const REGOLE = {
  margineMinuti: MARGINE_GESTIONE_MINUTI,
  spostamentiMax: SPOSTAMENTI_MAX,
  ripensamentoMinuti: RIPENSAMENTO_MINUTI,
  ultimoAvvisoMinuti: ULTIMO_AVVISO_MINUTI,
};
const h = (ore, minuti = 0) => ore * 60 + minuti;
const utc = (iso) => Date.parse(iso);

test("T4: il termine per modificare non supera mai il preavviso di prenotazione", () => {
  // Se fallisce: qualcuno ha reso MARGINE_GESTIONE_MINUTI più lungo di
  // PREAVVISO_MINUTI, e le prenotazioni fatte fra i due nascerebbero bloccate.
  assert.ok(
    MARGINE_GESTIONE_MINUTI <= PREAVVISO_MINUTI,
    `MARGINE_GESTIONE_MINUTI (${MARGINE_GESTIONE_MINUTI}) > PREAVVISO_MINUTI (${PREAVVISO_MINUTI})`,
  );
  // Il valore atteso dai test qui sotto (60 e 15/20): se cambiano, vanno
  // ricalcolati gli orari dei casi.
  assert.equal(MARGINE_GESTIONE_MINUTI, 60);
  assert.equal(RIPENSAMENTO_MINUTI, 15);
  assert.equal(ULTIMO_AVVISO_MINUTI, 20);
});

// Il caso registrato in produzione: Taglio bambino ven 30/10 alle 17:30,
// prenotato alle 16:11.
const registrato = { data: "2026-10-30", inizio: h(17, 30), spostamenti: 0, creataIl: "2026-10-30T15:11:00Z" };

test("T1: prenotato alle 16:11 per le 17:30 → modificabile subito, termine 16:30", () => {
  // Termine normale: 17:30 − 60 = 16:30. Ripensamento: primo fra 16:11 + 15 =
  // 16:26 e 17:30 − 20 = 17:10 → 16:26, prima del normale: vale 16:30.
  const s = puoGestire(registrato, utc("2026-10-30T15:11:00Z"), REGOLE); // 16:11
  assert.equal(s.disdicibile, true);
  assert.equal(s.spostabile, true);
  assert.equal(s.motivoBlocco, undefined);
  assert.deepEqual(s.termine, { data: "2026-10-30", minuti: h(16, 30) });
  assert.equal(s.inRipensamento, false);
  assert.equal(s.fineRipensamento, undefined);
});

test("T2: lo stesso alle 16:31 → bloccato per termine (16:30), ripensamento finito alle 16:26", () => {
  assert.equal(puoGestire(registrato, utc("2026-10-30T15:30:00Z"), REGOLE).spostabile, true); // 16:30 esatte
  const s = puoGestire(registrato, utc("2026-10-30T15:31:00Z"), REGOLE); // 16:31
  assert.equal(s.disdicibile, false);
  assert.equal(s.spostabile, false);
  assert.equal(s.motivoBlocco, "termine");
});

test("T3: creato alle 17:05 per le 17:30 (dall'agenda) → modificabile fino alle 17:10", () => {
  // Termine normale 16:30, già passato. Ripensamento: primo fra 17:05 + 15 =
  // 17:20 e 17:30 − 20 = 17:10 → 17:10.
  const a = { ...registrato, creataIl: "2026-10-30T16:05:00Z" };
  const appena = puoGestire(a, utc("2026-10-30T16:05:00Z"), REGOLE); // 17:05
  assert.equal(appena.spostabile, true);
  assert.equal(appena.inRipensamento, true);
  assert.deepEqual(appena.termine, { data: "2026-10-30", minuti: h(17, 10) });
  assert.deepEqual(appena.fineRipensamento, { data: "2026-10-30", minuti: h(17, 10) });
  assert.equal(puoGestire(a, utc("2026-10-30T16:10:00Z"), REGOLE).disdicibile, true); // 17:10 → sì
  const tardi = puoGestire(a, utc("2026-10-30T16:11:00Z"), REGOLE); // 17:11 → no
  assert.equal(tardi.disdicibile, false);
  assert.equal(tardi.motivoBlocco, "termine");
});

test("ripensamento con spostamenti esauriti: si disdice, non si sposta", () => {
  const s = puoGestire({ ...registrato, spostamenti: SPOSTAMENTI_MAX }, utc("2026-10-30T15:11:00Z"), REGOLE);
  assert.equal(s.disdicibile, true);
  assert.equal(s.spostabile, false);
  assert.equal(s.motivoBlocco, "spostamenti");
});

test("senza creataIl (credenziali v1 lette da un archivio vecchio) niente ripensamento", () => {
  const senza = { ...registrato, creataIl: undefined };
  assert.equal(puoGestire(senza, utc("2026-10-30T15:31:00Z"), REGOLE).disdicibile, false);
});

test("T5: generaSlot alle 16:11 di venerdì → passato, preavviso, libero, chiusura", () => {
  // 16:11 + 60 di preavviso = 17:11. Servizio da 50 minuti: alle 19:30
  // finirebbe dopo le 20:00.
  const slot = generaSlot({ data: "2026-10-30", giorno: 5, durata: 50, occupati: [], adesso: { data: "2026-10-30", minuti: h(16, 11) } });
  const motivo = (ora) => slot.find((s) => s.ora === ora);
  assert.equal(motivo("16:00").motivo, "passato");
  assert.equal(motivo("16:30").motivo, "preavviso");
  assert.equal(motivo("17:00").motivo, "preavviso");
  assert.equal(motivo("17:30").disponibile, true);
  assert.equal(motivo("17:30").motivo, undefined);
  assert.equal(motivo("19:30").motivo, "chiusura");
  // Un altro giorno: niente "passato" né "preavviso".
  const domani = generaSlot({ data: "2026-10-31", giorno: 6, durata: 30, occupati: [], adesso: { data: "2026-10-30", minuti: h(16, 11) } });
  assert.ok(domani.every((s) => s.motivo !== "passato" && s.motivo !== "preavviso"));
});

test("T5: un orario occupato resta \"occupato\" anche dentro il preavviso", () => {
  const slot = generaSlot({ data: "2026-10-30", giorno: 5, durata: 30, occupati: [{ inizio: h(16, 30), fine: h(17) }], adesso: { data: "2026-10-30", minuti: h(16, 11) } });
  assert.equal(slot.find((s) => s.ora === "16:30").motivo, "occupato");
});

test("T6: spostamento di 30 minuti sopra il proprio orario, nel giorno stesso", () => {
  // Servizio da 50 minuti alle 17:30 (17:30–18:20): spostarlo alle 18:00
  // (18:00–18:50) si sovrappone al vecchio orario, ma il vecchio orario è sé
  // stesso e non conta. Un altro appuntamento alle 19:00 invece sì.
  const slot = slotPerSpostamento({
    id: "io",
    data: "2026-10-30",
    giorno: 5,
    durata: 50,
    occupati: [
      { id: "io", inizio: h(17, 30), fine: h(18, 20) },
      { id: "altro", inizio: h(19), fine: h(19, 30) },
    ],
    adesso: { data: "2026-10-30", minuti: h(16, 11) },
  });
  assert.equal(slot.find((s) => s.ora === "18:00").disponibile, true);
  assert.equal(slot.find((s) => s.ora === "18:30").motivo, "occupato");
});

test("T7: cambio d'ora di ottobre (25/10/2026, 03:00 → 02:00)", () => {
  // Appuntamento alle 03:30 (ora solare, UTC+1) = 02:30 UTC. Termine 60
  // minuti prima a orologio vero: 01:30 UTC = 02:30 di Roma (la seconda volta
  // che l'orologio segna le 02:30).
  const a = { data: "2026-10-25", inizio: h(3, 30), spostamenti: 0 };
  const s = puoGestire(a, utc("2026-10-25T01:29:00Z"), REGOLE);
  assert.equal(s.disdicibile, true);
  assert.deepEqual(s.termine, { data: "2026-10-25", minuti: h(2, 30) });
  assert.equal(puoGestire(a, utc("2026-10-25T01:31:00Z"), REGOLE).disdicibile, false);
});

test("T7: cambio d'ora di marzo (29/03/2026, 02:00 → 03:00), con ripensamento", () => {
  // Appuntamento alle 03:30 (ora legale, UTC+2) = 01:30 UTC. Termine normale
  // 00:30 UTC = 01:30 di Roma (ancora ora solare): a orologio sembrano due
  // ore prima, davvero è una.
  const a = { data: "2026-03-29", inizio: h(3, 30), spostamenti: 0 };
  assert.deepEqual(puoGestire(a, utc("2026-03-29T00:00:00Z"), REGOLE).termine, { data: "2026-03-29", minuti: h(1, 30) });
  // Creato alle 00:50 UTC (01:50 di Roma): ripensamento fino al primo fra
  // 01:05 UTC e 01:10 UTC → 01:05 UTC = 03:05 di Roma. A orologio 75 minuti
  // dopo la prenotazione, davvero 15.
  const b = { ...a, creataIl: "2026-03-29T00:50:00Z" };
  const s = puoGestire(b, utc("2026-03-29T01:05:00Z"), REGOLE);
  assert.equal(s.disdicibile, true);
  assert.equal(s.inRipensamento, true);
  assert.deepEqual(s.termine, { data: "2026-03-29", minuti: h(3, 5) });
  assert.equal(puoGestire(b, utc("2026-03-29T01:06:00Z"), REGOLE).disdicibile, false);
});

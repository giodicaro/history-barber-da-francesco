// "Il mio appuntamento": cookie firmato del cliente (lib/prenotazioni/cliente.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  chiaveCliente,
  clienteDalCookie,
  firmato,
  intestazioneCookie,
  leggiCookie,
  leggiSfida,
  sfidaFirmata,
  DURATA_COOKIE_S,
} from "../lib/prenotazioni/cliente.ts";

const SEGRETO = "un-segreto-di-prova-lungo-almeno-32-caratteri!";
const chiave = chiaveCliente(SEGRETO);

test("chiave derivata: spenta senza segreto o con un segreto corto", () => {
  assert.equal(chiaveCliente(undefined), null);
  assert.equal(chiaveCliente("corto"), null);
  assert.equal(chiave.length, 32);
  // È derivata: non coincide con il segreto, e cambia col segreto.
  assert.notDeepEqual(chiave, Buffer.from(SEGRETO).subarray(0, 32));
  assert.notDeepEqual(chiaveCliente(SEGRETO + "x"), chiave);
});

test("cookie firmato: valido, manomesso, con un'altra chiave", () => {
  const id = randomUUID();
  const cookie = firmato(id, chiave);
  assert.equal(clienteDalCookie(cookie, chiave), id);
  // Un carattere cambiato nell'id o nella firma: come assente.
  const altroId = (id[0] === "a" ? "b" : "a") + cookie.slice(1);
  assert.equal(clienteDalCookie(altroId, chiave), null);
  const altraFirma = cookie.slice(0, -1) + (cookie.at(-1) === "A" ? "B" : "A");
  assert.equal(clienteDalCookie(altraFirma, chiave), null);
  assert.equal(clienteDalCookie(cookie, chiaveCliente(SEGRETO + "x")), null);
  // Firma giusta ma valore che non è un UUID: rifiutato.
  assert.equal(clienteDalCookie(firmato("non-un-uuid", chiave), chiave), null);
  assert.equal(clienteDalCookie(undefined, chiave), null);
  assert.equal(clienteDalCookie("senza-punto", chiave), null);
});

test("sfida delle passkey: scopo, cliente e scadenza", () => {
  const adesso = Date.parse("2026-11-01T10:00:00Z");
  const c = sfidaFirmata({ scopo: "registra", sfida: "abc", clienteId: "id-1", adesso }, chiave);
  assert.deepEqual(leggiSfida(c, "registra", chiave, adesso + 60_000), { sfida: "abc", clienteId: "id-1" });
  assert.equal(leggiSfida(c, "accedi", chiave, adesso), null);
  assert.equal(leggiSfida(c, "registra", chiave, adesso + 6 * 60_000), null);
  const a = sfidaFirmata({ scopo: "accedi", sfida: "xyz", adesso }, chiave);
  assert.deepEqual(leggiSfida(a, "accedi", chiave, adesso), { sfida: "xyz", clienteId: null });
});

test("intestazione Set-Cookie e lettura", () => {
  const h = intestazioneCookie("hb_cliente", "v.f", { maxAge: DURATA_COOKIE_S, sicuro: true });
  assert.equal(h, "hb_cliente=v.f; Path=/; Max-Age=34560000; HttpOnly; SameSite=Lax; Secure");
  assert.ok(!intestazioneCookie("x", "y", { maxAge: 0, sicuro: false }).includes("Secure"));
  assert.equal(leggiCookie("a=1; hb_cliente=abc.def; b=2", "hb_cliente"), "abc.def");
  assert.equal(leggiCookie(null, "hb_cliente"), undefined);
});

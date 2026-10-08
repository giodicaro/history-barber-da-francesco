// Validazione della configurazione dell'accesso all'agenda (lib/auth-config.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { configAccesso, rispostaNonDisponibile } from "../../lib/auth-config.ts";

const con = (vars, fn) => {
  const prima = { ADMIN_PASSWORD: process.env.ADMIN_PASSWORD, AUTH_SECRET: process.env.AUTH_SECRET };
  for (const [k, v] of Object.entries(vars)) v === undefined ? delete process.env[k] : (process.env[k] = v);
  try { return fn(); } finally {
    for (const [k, v] of Object.entries(prima)) v === undefined ? delete process.env[k] : (process.env[k] = v);
  }
};
const segreto = "a".repeat(64);

test("fail-closed: variabili mancanti o segreto corto → accesso negato", () => {
  assert.equal(con({ ADMIN_PASSWORD: undefined, AUTH_SECRET: undefined }, configAccesso).ok, false);
  assert.equal(con({ ADMIN_PASSWORD: "password-lunga-di-prova", AUTH_SECRET: undefined }, configAccesso).ok, false);
  const corto = con({ ADMIN_PASSWORD: "password-lunga-di-prova", AUTH_SECRET: "troppo-corto" }, configAccesso);
  assert.equal(corto.ok, false);
  assert.match(corto.problemi.join(), /AUTH_SECRET troppo corto/);
});

test("configurazione valida; spazi e a capo incollati vengono tolti", () => {
  const c = con({ ADMIN_PASSWORD: "  password-lunga-di-prova\n", AUTH_SECRET: `${segreto}\n` }, configAccesso);
  assert.deepEqual(c, { ok: true, password: "password-lunga-di-prova", segreto });
});

test("la risposta per l'utente è generica: 503, nessun nome di variabile", async () => {
  const r = rispostaNonDisponibile();
  assert.equal(r.status, 503);
  const testo = await r.text();
  assert.doesNotMatch(testo, /ADMIN_PASSWORD|AUTH_SECRET|env/i);
});

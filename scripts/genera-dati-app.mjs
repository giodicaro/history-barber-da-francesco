// Scrive public/app/data/shop.json da lib/salone.ts: la copia statica dei
// dati che l'app usa offline e in modalità demo. Online l'app li chiede a
// GET /app/api/shop, che li costruisce dalla stessa fonte.
// Gira da solo prima di `dev` e `build` (package.json); a mano: npm run app:dati
// Node 22.18+ legge i .ts senza build: i tre moduli importati non hanno import.

import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

let s, festivitaDellAnno, costruisciDatiApp;
try {
  s = await import("../lib/salone.ts");
  ({ festivitaDellAnno } = await import("../lib/festivi.ts"));
  ({ costruisciDatiApp } = await import("../lib/app-dati.ts"));
} catch (e) {
  // Node troppo vecchio per leggere i .ts: si tiene il file già nel repository
  // (l'app online usa comunque i dati dell'API) invece di far fallire la build.
  console.warn(`[app:dati] salto la rigenerazione (${e.code ?? e.message}): resta il shop.json esistente`);
  process.exit(0);
}

const anno = new Date().getFullYear();
const chiusure = s.CHIUSO_NEI_FESTIVI
  ? [anno, anno + 1].flatMap((a) => [...festivitaDellAnno(a).keys()]).sort()
  : [];

const dati = costruisciDatiApp({
  salone: s.salone,
  orari: s.orari,
  listino: s.listino,
  operatori: s.operatori,
  preavvisoMinuti: s.PREAVVISO_MINUTI,
  giorniPrenotabili: s.GIORNI_PRENOTABILI,
  passoMinuti: s.PASSO_SLOT_MINUTI,
  modificabileFinoAMinuti: s.MODIFICABILE_FINO_A_MINUTI,
  prenotazioniAttiveMax: s.PRENOTAZIONI_ATTIVE_MAX,
  listinoConfermato: s.LISTINO_CONFERMATO,
  chiusure,
});

const file = fileURLToPath(new URL("../public/app/data/shop.json", import.meta.url));
const testo = `${JSON.stringify(dati, null, 2)}\n`;
let prima = "";
try {
  prima = readFileSync(file, "utf8");
} catch {}
if (prima !== testo) {
  writeFileSync(file, testo);
  console.log("public/app/data/shop.json aggiornato da lib/salone.ts");
}

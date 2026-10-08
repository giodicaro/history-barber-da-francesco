/* Festività nazionali italiane, calcolate: nessun elenco da aggiornare ogni
   anno. Mestre è nel Comune di Venezia, il cui patrono (San Marco, 25 aprile)
   coincide con la Liberazione.

   Modulo senza import, come lib/salone.ts: lo legge anche lo script che
   genera i dati dell'app (scripts/genera-dati-app.mjs) con Node, senza build. */

/** Domenica di Pasqua (calendario gregoriano, algoritmo di Meeus/Jones/Butcher). */
function pasqua(anno: number): { mese: number; giorno: number } {
  const a = anno % 19;
  const b = Math.floor(anno / 100);
  const c = anno % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mese = Math.floor((h + l - 7 * m + 114) / 31);
  const giorno = ((h + l - 7 * m + 114) % 31) + 1;
  return { mese, giorno };
}

const iso = (anno: number, mese: number, giorno: number) =>
  `${anno}-${String(mese).padStart(2, "0")}-${String(giorno).padStart(2, "0")}`;

/** Festività nazionali di un anno: data ISO → nome. */
export function festivitaDellAnno(anno: number): Map<string, string> {
  const p = pasqua(anno);
  const lunedi = new Date(Date.UTC(anno, p.mese - 1, p.giorno + 1));
  return new Map([
    [iso(anno, 1, 1), "Capodanno"],
    [iso(anno, 1, 6), "Epifania"],
    [lunedi.toISOString().slice(0, 10), "Lunedì dell'Angelo"],
    [iso(anno, 4, 25), "Festa della Liberazione e San Marco"],
    [iso(anno, 5, 1), "Festa dei Lavoratori"],
    [iso(anno, 6, 2), "Festa della Repubblica"],
    [iso(anno, 8, 15), "Ferragosto"],
    [iso(anno, 11, 1), "Ognissanti"],
    [iso(anno, 12, 8), "Immacolata Concezione"],
    [iso(anno, 12, 25), "Natale"],
    [iso(anno, 12, 26), "Santo Stefano"],
  ]);
}

const cache = new Map<number, Map<string, string>>();

/** Nome della festività se la data ISO ("YYYY-MM-DD") è festiva, altrimenti null. */
export function festivita(data: string): string | null {
  const anno = Number(data.slice(0, 4));
  if (!cache.has(anno)) cache.set(anno, festivitaDellAnno(anno));
  return cache.get(anno)!.get(data) ?? null;
}

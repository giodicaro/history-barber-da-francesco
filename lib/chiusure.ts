/* Chiusure e ferie: le regole, senza database (le usano server e browser).

   Una chiusura è un periodo "dal … al …", date incluse, in giornate del
   salone (ora di Roma) scritte "YYYY-MM-DD". Le date si confrontano come
   testo: in quel formato l'ordine alfabetico è l'ordine del calendario, e non
   c'è nessun orario che possa scivolare di un giorno col fuso o con l'ora
   legale. I dati stanno nella tabella chiusure (db/schema.ts). */

export interface Chiusura {
  id: string;
  /** Primo giorno chiuso, "YYYY-MM-DD". */
  dal: string;
  /** Ultimo giorno chiuso, incluso. */
  al: string;
  /** Facoltativo: lo vedono anche i clienti ("Ferie estive"). */
  motivo?: string;
  /** Spenta: resta in elenco ma non chiude niente. */
  attiva: boolean;
}

/** La versione pubblica, quella che vede il sito: niente interruttore. */
export type ChiusuraPubblica = Pick<Chiusura, "id" | "dal" | "al" | "motivo">;

const DATA = /^\d{4}-\d{2}-\d{2}$/;

/** True se la stringa è una data vera ("2026-02-30" no). */
export function dataValida(data: string): boolean {
  if (!DATA.test(data)) return false;
  const d = new Date(`${data}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === data;
}

/** La chiusura attiva che copre questo giorno, o null. È "isClosed(date)":
    l'unica regola, usata da slot, prenotazione, spostamento, agenda e sito. */
export function chiusoIl<T extends Pick<Chiusura, "dal" | "al"> & { attiva?: boolean }>(data: string, chiusure: readonly T[]): T | null {
  return chiusure.find((c) => c.attiva !== false && c.dal <= data && data <= c.al) ?? null;
}

/** Le chiusure ancora da finire (in corso o future), in ordine di inizio. */
export function chiusureInVista<T extends Pick<Chiusura, "dal" | "al"> & { attiva?: boolean }>(chiusure: readonly T[], oggi: string): T[] {
  return chiusure.filter((c) => c.attiva !== false && c.al >= oggi).sort((a, b) => a.dal.localeCompare(b.dal));
}

/** Due periodi che si toccano o si sovrappongono (anche giorni attaccati:
    10–15 e 16–20 si possono unire in 10–20). */
export function sovrapposte(a: Pick<Chiusura, "dal" | "al">, b: Pick<Chiusura, "dal" | "al">): boolean {
  return a.dal <= giornoDopo(b.al) && b.dal <= giornoDopo(a.al);
}

/** Il periodo che le contiene tutte (per "unisci"). */
export function unione(periodi: readonly Pick<Chiusura, "dal" | "al">[]): { dal: string; al: string } {
  return {
    dal: periodi.map((p) => p.dal).sort()[0],
    al: periodi.map((p) => p.al).sort().at(-1)!,
  };
}

export function giornoDopo(data: string): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export type ErroriChiusura = Partial<Record<"dal" | "al" | "motivo", string>>;

/** Controlli di una chiusura nuova o modificata. Il passato non si chiude:
    una chiusura tutta prima di oggi non serve a niente. */
export function validaChiusura(d: { dal: string; al: string; motivo?: string }, oggi: string): ErroriChiusura {
  const errori: ErroriChiusura = {};
  if (!dataValida(d.dal)) errori.dal = "Scegli la data di inizio";
  if (!dataValida(d.al)) errori.al = "Scegli la data di fine";
  if (!errori.dal && !errori.al) {
    if (d.al < d.dal) errori.al = "La data di fine viene prima della data di inizio";
    else if (d.al < oggi) errori.al = "Questo periodo è già passato";
  }
  if ((d.motivo ?? "").trim().length > 80) errori.motivo = "Al massimo 80 caratteri";
  return errori;
}

/* ── Come si scrive ─────────────────────────────────────────────────────── */

const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

/** "15/08/2026": il formato delle date dell'admin. */
export const dataBreve = (data: string) => `${data.slice(8, 10)}/${data.slice(5, 7)}/${data.slice(0, 4)}`;

/** "15 agosto": per i clienti. */
export const dataParlata = (data: string) => `${Number(data.slice(8, 10))} ${MESI[Number(data.slice(5, 7)) - 1]}`;

/** "il 15 agosto" oppure "dal 10 al 24 agosto" / "dal 28 dicembre al 6 gennaio". */
export function periodoParlato(c: Pick<Chiusura, "dal" | "al">): string {
  if (c.dal === c.al) return `il ${dataParlata(c.dal)}`;
  const stessoMese = c.dal.slice(0, 7) === c.al.slice(0, 7);
  return stessoMese ? `dal ${Number(c.dal.slice(8, 10))} al ${dataParlata(c.al)}` : `dal ${dataParlata(c.dal)} al ${dataParlata(c.al)}`;
}

/** "Il salone è chiuso in questa data (Ferie estive). Scegli un altro giorno." */
export const avvisoGiornoChiuso = (c: Pick<Chiusura, "motivo">) =>
  `Il salone è chiuso in questa data${c.motivo ? ` (${c.motivo})` : ""}. Scegli un altro giorno.`;

import { createHash, randomBytes } from "node:crypto";
import { generaSlot, type Intervallo } from "./slot";
import { romaInIstante, istanteInRoma } from "./calendario";
import { ALFABETO_CODICE, LUNGHEZZA_CODICE, normalizzaCodice } from "./codice";
import type { BookingSlot } from "./tipi";

/* "Gestisci il tuo appuntamento": regole pure, senza database né rete.

   Credenziali (D1). Il telefono da solo non è un segreto: lo conoscono amici
   e colleghi. Alla prenotazione dal sito si generano un token per il link e
   un codice di 6 caratteri; nel database ne finiscono solo le impronte. Si
   cerca sempre per impronta, mai per valore in chiaro. */

/** Token del link personale: 32 byte casuali, base64url (43 caratteri). */
export const TOKEN_GESTIONE = /^[A-Za-z0-9_-]{43}$/;

export const sha256 = (testo: string) => createHash("sha256").update(testo).digest("hex");

/** Codice casuale senza sbilanciamenti: si scartano i byte oltre l'ultimo
    multiplo esatto dell'alfabeto, così ogni simbolo ha la stessa probabilità. */
export function generaCodice(): string {
  const limite = 256 - (256 % ALFABETO_CODICE.length);
  let codice = "";
  while (codice.length < LUNGHEZZA_CODICE) {
    for (const b of randomBytes(LUNGHEZZA_CODICE * 2)) {
      if (b < limite && codice.length < LUNGHEZZA_CODICE) codice += ALFABETO_CODICE[b % ALFABETO_CODICE.length];
    }
  }
  return codice;
}

export const generaToken = () => randomBytes(32).toString("base64url");

/** Impronta del token del link. */
export const impronta = (token: string) => sha256(`gestione:${token}`);

/** Impronta del codice, legata al telefono (già normalizzato, "+39…"). */
export const improntaCodice = (telefono: string, codice: string) => sha256(`${telefono}:${normalizzaCodice(codice)}`);

/** Le credenziali di un appuntamento nuovo: in chiaro per il cliente (una
    volta sola), in impronta per il database. */
export function nuoveCredenziali(telefono: string) {
  const token = generaToken();
  const codice = generaCodice();
  return { token, codice, gestioneHash: impronta(token), codiceHash: improntaCodice(telefono, codice) };
}

/* ── Termine e limite (D3, D4) ──────────────────────────────────────────── */

export type MotivoBlocco = "termine" | "spostamenti";

export interface StatoGestione {
  /** Si può ancora disdire. */
  disdicibile: boolean;
  /** Si può ancora spostare. */
  spostabile: boolean;
  /** Perché qualcosa non si può più fare (il termine vince sul limite). */
  motivoBlocco?: MotivoBlocco;
  spostamentiRimasti: number;
  /** Ultimo momento utile, in ora di Roma. */
  termine: { data: string; minuti: number };
}

/** Cosa può fare il cliente adesso. Il termine si misura sugli istanti veri
    (ora di Roma → UTC): la notte del cambio d'ora non sposta il limite. */
export function puoGestire(
  a: { data: string; inizio: number; spostamenti: number },
  adessoIstante: number,
  regole: { margineMinuti: number; spostamentiMax: number },
): StatoGestione {
  const inizio = romaInIstante(a.data, a.inizio);
  const termineIstante = inizio - regole.margineMinuti * 60000;
  const entroTermine = adessoIstante <= termineIstante;
  const spostamentiRimasti = Math.max(0, regole.spostamentiMax - a.spostamenti);
  return {
    disdicibile: entroTermine,
    spostabile: entroTermine && spostamentiRimasti > 0,
    ...(!entroTermine ? { motivoBlocco: "termine" as const } : spostamentiRimasti === 0 ? { motivoBlocco: "spostamenti" as const } : {}),
    spostamentiRimasti,
    termine: istanteInRoma(termineIstante),
  };
}

/* ── Spostamento (D4) ───────────────────────────────────────────────────── */

/** Gli occupati del giorno senza l'appuntamento che si sta spostando:
    altrimenti spostarlo di mezz'ora sopra il suo vecchio orario risulterebbe
    "occupato" da sé stesso. */
export function occupatiSenza(occupati: (Intervallo & { id: string })[], id: string): Intervallo[] {
  return occupati.filter((o) => o.id !== id).map(({ inizio, fine }) => ({ inizio, fine }));
}

/** Gli orari proponibili per spostare un appuntamento: stessa regola del
    sito (generaSlot: turni, festivi, preavviso, chiusura), stessa durata,
    senza l'appuntamento stesso fra gli occupati. */
export function slotPerSpostamento(opzioni: {
  id: string;
  data: string;
  giorno: number;
  durata: number;
  occupati: (Intervallo & { id: string })[];
  adesso: { data: string; minuti: number };
}): BookingSlot[] {
  return generaSlot({
    data: opzioni.data,
    giorno: opzioni.giorno,
    durata: opzioni.durata,
    occupati: occupatiSenza(opzioni.occupati, opzioni.id),
    adesso: opzioni.adesso,
  });
}

/** "Mario Rossi" → "Mario R.": negli avvisi basta per riconoscerlo. */
export function nomeBreve(nome: string): string {
  const [primo, ...altri] = nome.trim().split(/\s+/);
  const ultimo = altri.at(-1);
  return ultimo ? `${primo} ${ultimo[0].toUpperCase()}.` : primo;
}

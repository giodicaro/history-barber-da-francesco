import { createHash, randomBytes } from "node:crypto";
import { romaInIstante, istanteInRoma } from "./calendario";
import { ALFABETO_CODICE, LUNGHEZZA_CODICE, normalizzaCodice } from "./codice";

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

/* ── Termine (D3) ──────────────────────────────────────────── */

export interface StatoGestione {
  /** Si può ancora disdire. */
  disdicibile: boolean;
  /** Perché non si può più disdire. */
  motivoBlocco?: "termine";
  /** Ultimo momento utile, in ora di Roma: il più tardo fra il termine
      normale e la fine del ripensamento. */
  termine: { data: string; minuti: number };
  /** Fine del ripensamento, se cade dopo il termine normale. */
  fineRipensamento?: { data: string; minuti: number };
  /** Adesso vale solo il ripensamento ("Hai cambiato idea?"). */
  inRipensamento: boolean;
}

export interface RegoleGestione {
  margineMinuti: number;
  /** Minuti dopo la creazione in cui si può sempre modificare (C2). */
  ripensamentoMinuti?: number;
  /** ...purché all'inizio ne manchino almeno tanti. */
  ultimoAvvisoMinuti?: number;
}

/** Cosa può fare il cliente adesso. Il termine si misura sugli istanti veri
    (ora di Roma → UTC): la notte del cambio d'ora non sposta il limite.

    Due finestre, vale la più lunga:
    - termine normale: inizio − margine;
    - ripensamento: fino al primo fra creazione + ripensamento e
      inizio − ultimo avviso. Senza creataIl il ripensamento non c'è. */
export function puoGestire(
  a: { data: string; inizio: number; creataIl?: string | number },
  adessoIstante: number,
  regole: RegoleGestione,
): StatoGestione {
  const inizio = romaInIstante(a.data, a.inizio);
  const normale = inizio - regole.margineMinuti * 60000;
  const creata = a.creataIl === undefined ? NaN : new Date(a.creataIl).getTime();
  const ripensamento = Number.isFinite(creata)
    ? Math.min(creata + (regole.ripensamentoMinuti ?? 0) * 60000, inizio - (regole.ultimoAvvisoMinuti ?? 0) * 60000)
    : -Infinity;
  const termineIstante = Math.max(normale, ripensamento);
  const entroTermine = adessoIstante <= termineIstante;
  return {
    disdicibile: entroTermine,
    ...(!entroTermine ? { motivoBlocco: "termine" as const } : {}),
    termine: istanteInRoma(termineIstante),
    ...(ripensamento > normale ? { fineRipensamento: istanteInRoma(ripensamento) } : {}),
    inRipensamento: entroTermine && adessoIstante > normale,
  };
}

/** "Mario Rossi" → "Mario R.": negli avvisi basta per riconoscerlo. */
export function nomeBreve(nome: string): string {
  const [primo, ...altri] = nome.trim().split(/\s+/);
  const ultimo = altri.at(-1);
  return ultimo ? `${primo} ${ultimo[0].toUpperCase()}.` : primo;
}

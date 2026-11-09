import { createHash } from "node:crypto";
import { romaInIstante, istanteInRoma } from "./calendario";

/* "Gestisci il tuo appuntamento": regole pure, senza database né rete.

   Link personale della v1 (D1): nel database ne finisce solo l'impronta e si
   cerca sempre per impronta, mai per valore in chiaro. */

/** Token del link personale: 32 byte casuali, base64url (43 caratteri). */
export const TOKEN_GESTIONE = /^[A-Za-z0-9_-]{43}$/;

export const sha256 = (testo: string) => createHash("sha256").update(testo).digest("hex");

/** Impronta del token del link. */
export const impronta = (token: string) => sha256(`gestione:${token}`);

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

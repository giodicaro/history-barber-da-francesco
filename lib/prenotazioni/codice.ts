/* Il codice personale dell'appuntamento (6 caratteri, es. "K7M-4QX").

   Senza import: lo usano sia il browser (campo che maiuscola e mette il
   trattino mentre si scrive) sia il server (che lo genera e lo verifica).

   L'alfabeto toglie i caratteri che si confondono letti a voce o su uno
   schermo piccolo: niente 0/O, 1/I/L. Restano 31 simboli: 31^6 ≈ 887 milioni
   di combinazioni, e il codice vale solo insieme al telefono giusto. */

export const ALFABETO_CODICE = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const LUNGHEZZA_CODICE = 6;

/** Maiuscolo, senza trattini, spazi e caratteri fuori alfabeto. */
export function normalizzaCodice(grezzo: string): string {
  return grezzo
    .toUpperCase()
    .split("")
    .filter((c) => ALFABETO_CODICE.includes(c))
    .join("")
    .slice(0, LUNGHEZZA_CODICE);
}

/** "K7M4QX" → "K7M-4QX": per leggerlo, non per salvarlo. */
export function formatoCodice(codice: string): string {
  const c = normalizzaCodice(codice);
  return c.length > 3 ? `${c.slice(0, 3)}-${c.slice(3)}` : c;
}

export const codiceCompleto = (codice: string) => normalizzaCodice(codice).length === LUNGHEZZA_CODICE;

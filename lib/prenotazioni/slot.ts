import { formatoOra } from "@/lib/orari";
import { orari, PREAVVISO_MINUTI, type Turno } from "@/lib/salone";
import type { BookingSlot } from "./tipi";

/* Generazione degli orari prenotabili. Funzioni pure: niente rete, niente
   database, niente Date.now(). Tutto quello che serve arriva come argomento,
   così l'algoritmo è verificabile e non dipende dal fuso di chi chiama. */

/** Ogni quanti minuti si propone un orario. */
export const PASSO = 30;

export interface Intervallo {
  inizio: number;
  fine: number;
}

export interface OpzioniSlot {
  /** Data della giornata, "YYYY-MM-DD". */
  data: string;
  /** Giorno della settimana della data (0 = domenica). */
  giorno: number;
  /** Minuti di poltrona del servizio scelto. */
  durata: number;
  /** Appuntamenti già presi, in minuti dalla mezzanotte. */
  occupati: Intervallo[];
  /** "Adesso" secondo l'ora di Roma: serve per scartare gli orari passati. */
  adesso: { data: string; minuti: number };
  /** Minuti minimi di preavviso. */
  preavviso?: number;
}

export function turniDelGiorno(giorno: number): Turno[] {
  return orari[giorno]?.turni ?? [];
}

/** True se i due intervalli si toccano (fine esclusa: 9:00-9:30 e 9:30-10:00 convivono). */
export const siSovrappongono = (a: Intervallo, b: Intervallo) =>
  a.inizio < b.fine && b.inizio < a.fine;

/* Un orario è proponibile se:
   - il servizio ci sta dentro il turno, chiusura compresa (un taglio da 45
     minuti alle 12:30 sforerebbe le 13:00: non si propone);
   - non si sovrappone a un appuntamento già preso;
   - non è già passato, con un margine di preavviso.
   Gli orari scartati restano nella lista con il motivo: il widget li mostra
   barrati, così il cliente vede che la giornata è piena e non vuota. */
export function generaSlot({
  data,
  giorno,
  durata,
  occupati,
  adesso,
  preavviso = PREAVVISO_MINUTI,
}: OpzioniSlot): BookingSlot[] {
  const turni = turniDelGiorno(giorno);
  const oggi = data === adesso.data;
  const limite = oggi ? adesso.minuti + preavviso : -Infinity;
  const slot: BookingSlot[] = [];

  for (const turno of turni) {
    for (let inizio = turno.apre; inizio + durata <= turno.chiude; inizio += PASSO) {
      const candidato = { inizio, fine: inizio + durata };
      const motivo = occupati.some((o) => siSovrappongono(candidato, o))
        ? "occupato"
        : inizio < limite
          ? "passato"
          : undefined;
      slot.push({ ora: formatoOra(inizio), disponibile: !motivo, motivo });
    }
    // Un orario che sforerebbe la chiusura non viene generato dal ciclo: lo
    // aggiungiamo lo stesso, spento, perché nell'ultima mezz'ora il cliente
    // capisca che il salone è aperto ma il servizio non ci sta più.
    const ultimo = turno.chiude - PASSO;
    const ultimoUtile = Math.floor((turno.chiude - durata - turno.apre) / PASSO) * PASSO + turno.apre;
    for (let inizio = Math.max(turno.apre, ultimoUtile + PASSO); inizio <= ultimo; inizio += PASSO) {
      slot.push({ ora: formatoOra(inizio), disponibile: false, motivo: "chiusura" });
    }
  }

  return slot.sort((a, b) => a.ora.localeCompare(b.ora));
}

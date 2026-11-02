import { useSyncExternalStore } from "react";
import type { ChiusuraPubblica } from "./chiusure";

/* Le chiusure per le pagine pubbliche, lette UNA volta da GET /api/chiusure
   dopo il caricamento (la home resta statica): notizia in home, footer,
   stato "Aperto ora", giorni spenti nel widget. Stesso
   schema di useMiei in lib/gestione.ts. */

export type StatoChiusure = { caricato: boolean; oggi: string; chiusure: ChiusuraPubblica[] };

const INIZIALE: StatoChiusure = { caricato: false, oggi: "", chiusure: [] };
let stato = INIZIALE;
let richiesta: Promise<void> | null = null;
const ascoltatori = new Set<() => void>();

function carica() {
  richiesta ??= fetch("/api/chiusure")
    .then((r) => (r.ok ? r.json() : null))
    .then((corpo: { oggi: string; chiusure: ChiusuraPubblica[] } | null) => {
      stato = { caricato: true, oggi: corpo?.oggi ?? "", chiusure: corpo?.chiusure ?? [] };
    })
    .catch(() => {
      stato = { ...INIZIALE, caricato: true };
    })
    .finally(() => ascoltatori.forEach((f) => f()));
  return richiesta;
}

function iscrivi(f: () => void) {
  ascoltatori.add(f);
  void carica();
  return () => ascoltatori.delete(f);
}

export const useChiusure = () => useSyncExternalStore(iscrivi, () => stato, () => INIZIALE);

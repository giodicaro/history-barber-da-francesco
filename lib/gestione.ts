import { useSyncExternalStore } from "react";

/* "Il mio appuntamento": innesto fra i bottoni sparsi nel sito (hero, barra,
   menu, footer) e il foglio GestioneWidget, sullo stesso schema di
   lib/prenotazione.ts: un evento sulla finestra.

   In più tiene lo stato del cliente per i bottoni ("Mer 4 nov · 10:00"),
   letto UNA volta da GET /api/appuntamento/miei dopo il caricamento: la
   home resta statica e non legge i cookie sul server. */

export type OrigineGestione = "hero" | "navbar" | "menu" | "footer" | "prenotazione" | "link";

export const EVENTO_GESTIONE = "gestione:apri";
const EVENTO = EVENTO_GESTIONE;

// Come in lib/prenotazione.ts: il foglio si carica dopo la pagina, e una
// richiesta arrivata prima resta qui finché non ascolta.
let inAttesa: OrigineGestione | null = null;
let inAscolto = 0;

export function apriGestione(origine: OrigineGestione) {
  if (typeof window === "undefined") return;
  if (inAscolto === 0) inAttesa = origine;
  window.dispatchEvent(new CustomEvent<OrigineGestione>(EVENTO, { detail: origine }));
}

export function ascoltaGestione(reagisci: (origine: OrigineGestione) => void) {
  const gestore = (e: Event) => reagisci((e as CustomEvent<OrigineGestione>).detail ?? "hero");
  window.addEventListener(EVENTO, gestore);
  inAscolto++;
  if (inAttesa) {
    const origine = inAttesa;
    inAttesa = null;
    setTimeout(() => reagisci(origine), 0);
  }
  return () => {
    inAscolto--;
    window.removeEventListener(EVENTO, gestore);
  };
}

/* ── Stato del cliente per i bottoni ──────────────────────────────────── */

export type StatoMiei = {
  caricato: boolean;
  /** Riconoscimento acceso sul server (c'è AUTH_SECRET). */
  attivo: boolean;
  riconosciuto: boolean;
  prossimo?: { data: string; ora: string; servizio: string };
  totale: number;
};

const INIZIALE: StatoMiei = { caricato: false, attivo: true, riconosciuto: false, totale: 0 };
let stato: StatoMiei = INIZIALE;
let richiesta: Promise<void> | null = null;
const ascoltatori = new Set<() => void>();

/** Rilegge lo stato (dopo una prenotazione, una disdetta, un accesso). */
export function aggiornaMiei(): Promise<void> {
  richiesta = fetch("/api/appuntamento/miei", { cache: "no-store", credentials: "same-origin" })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      stato = d
        ? { caricato: true, attivo: d.attivo !== false, riconosciuto: Boolean(d.riconosciuto), prossimo: d.prossimo, totale: d.totale ?? 0 }
        : { ...INIZIALE, caricato: true };
    })
    .catch(() => {
      stato = { ...INIZIALE, caricato: true };
    })
    .finally(() => ascoltatori.forEach((a) => a()));
  return richiesta;
}

function iscrivi(avvisa: () => void) {
  ascoltatori.add(avvisa);
  // Il primo che guarda fa partire la lettura, una volta per pagina.
  if (!richiesta) void aggiornaMiei();
  return () => ascoltatori.delete(avvisa);
}

export const useMiei = () => useSyncExternalStore(iscrivi, () => stato, () => INIZIALE);

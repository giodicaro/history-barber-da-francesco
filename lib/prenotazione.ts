/* Innesto fra i bottoni "Prenota" sparsi nel sito e il widget di prenotazione.

   I bottoni non conoscono il widget e il widget non conosce i bottoni: in
   mezzo passa un evento sulla finestra. Così BookButton resta un componente
   minuscolo e il widget si monta una volta sola, in fondo alla pagina.

   Per scelta del committente non ci sono piattaforme esterne: il sistema è
   qui dentro (components/BookingWidget.tsx + app/api/bookings). */

export type OrigineCta = "navbar" | "menu" | "hero" | "listino" | "footer" | "gestione";

export const EVENTO_PRENOTAZIONE = "prenotazione:apri";
const EVENTO = EVENTO_PRENOTAZIONE;

// Il widget si carica dopo la pagina (components/FogliDifferiti.tsx): una
// richiesta arrivata prima che ascolti resta qui e gli viene consegnata
// appena si monta. Un tocco su "Prenota" non va mai perso.
let inAttesa: OrigineCta | null = null;
let ascoltatori = 0;

export function apriPrenotazione(origine: OrigineCta) {
  // Sul server non c'è finestra: la funzione è chiamata solo da eventi del
  // browser, ma la guardia tiene il modulo importabile ovunque.
  if (typeof window === "undefined") return;
  if (ascoltatori === 0) inAttesa = origine;
  window.dispatchEvent(new CustomEvent<OrigineCta>(EVENTO, { detail: origine }));
}

export function ascoltaPrenotazione(reagisci: (origine: OrigineCta) => void) {
  const gestore = (e: Event) => reagisci((e as CustomEvent<OrigineCta>).detail ?? "hero");
  window.addEventListener(EVENTO, gestore);
  ascoltatori++;
  if (inAttesa) {
    const origine = inAttesa;
    inAttesa = null;
    setTimeout(() => reagisci(origine), 0);
  }
  return () => {
    ascoltatori--;
    window.removeEventListener(EVENTO, gestore);
  };
}

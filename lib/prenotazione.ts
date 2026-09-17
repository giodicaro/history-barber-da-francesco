/* Innesto fra i bottoni "Prenota" sparsi nel sito e il widget di prenotazione.

   I bottoni non conoscono il widget e il widget non conosce i bottoni: in
   mezzo passa un evento sulla finestra. Così BookButton resta un componente
   minuscolo e il widget si monta una volta sola, in fondo alla pagina.

   Per scelta del committente non ci sono piattaforme esterne: il sistema è
   qui dentro (components/BookingWidget.tsx + app/api/bookings). */

export type OrigineCta = "navbar" | "menu" | "hero" | "listino" | "footer";

const EVENTO = "prenotazione:apri";

export function apriPrenotazione(origine: OrigineCta) {
  // Sul server non c'è finestra: la funzione è chiamata solo da eventi del
  // browser, ma la guardia tiene il modulo importabile ovunque.
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<OrigineCta>(EVENTO, { detail: origine }));
}

export function ascoltaPrenotazione(reagisci: (origine: OrigineCta) => void) {
  const gestore = (e: Event) => reagisci((e as CustomEvent<OrigineCta>).detail ?? "hero");
  window.addEventListener(EVENTO, gestore);
  return () => window.removeEventListener(EVENTO, gestore);
}

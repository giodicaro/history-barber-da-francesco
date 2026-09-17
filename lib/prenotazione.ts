/* Punto d'innesto del futuro sistema di prenotazione.

   Per scelta del committente oggi i bottoni "Prenota" non portano da nessuna
   parte: niente Fresha, niente WhatsApp, niente piattaforme esterne. Quando il
   sistema nativo sarà pronto, basterà implementare questa funzione (aprire un
   modale, navigare a /prenota, ...) e tutti i bottoni del sito la useranno. */

export type OrigineCta = "navbar" | "menu" | "hero" | "listino" | "footer";

export function apriPrenotazione(origine: OrigineCta) {
  void origine;
}

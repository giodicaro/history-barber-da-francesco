/* Tipi condivisi fra widget (client), API e agenda (server).
   Un solo posto per la forma dei dati: se cambia qui, TypeScript segnala
   tutti i punti da aggiornare. */

/** Servizio scelto dal cliente, come lo vede il widget. */
export interface ServiceOption {
  id: string;
  nome: string;
  dettaglio: string;
  /** Euro, senza decimali. */
  prezzo: number;
  /** Minuti di poltrona: decidono la lunghezza dell'appuntamento. */
  durata: number;
  /** "da" = prezzo variabile. I supplementi ("+") non sono prenotabili. */
  prefisso?: "da" | "+";
  /** Titolo della categoria del listino (Taglio, Barba, Combo). */
  categoria: string;
}

/** Dati che il cliente compila nell'ultimo passo. */
export interface CustomerData {
  nome: string;
  /** Normalizzato in +39XXXXXXXXXX dalla validazione. */
  telefono: string;
  note?: string;
}

/** Un orario proposto dall'API. */
export interface BookingSlot {
  /** "HH:MM" di inizio. */
  ora: string;
  disponibile: boolean;
  /** Perché non è disponibile: utile in sviluppo e per l'agenda. */
  motivo?: "occupato" | "passato" | "chiusura";
}

/** Risposta di GET /api/bookings. */
export interface RispostaSlot {
  data: string;
  /** 0 = domenica, come Date.getDay(). */
  giorno: number;
  giornoNome: string;
  aperto: boolean;
  servizio: Pick<ServiceOption, "id" | "nome" | "durata" | "prezzo">;
  slot: BookingSlot[];
  /** Quanti slot restano liberi: il widget ci scrive "ultimi posti". */
  liberi: number;
}

/** Cliente come lo registra l'agenda. Il telefono manca solo negli
    appuntamenti inseriti a mano da Francesco (cliente di passaggio). */
export interface ClienteAgenda {
  nome: string;
  telefono?: string;
  note?: string;
}

/** Appuntamento salvato. */
export interface Prenotazione {
  tipo: "appuntamento";
  id: string;
  /** Data della giornata di salone, "YYYY-MM-DD". */
  data: string;
  /** Inizio e fine in minuti dalla mezzanotte: i confronti restano interi. */
  inizio: number;
  fine: number;
  servizioId: string;
  servizioNome: string;
  prezzo: number;
  operatoreId: string;
  cliente: ClienteAgenda;
  /** Da quale bottone del sito è partita, oppure "agenda" se l'ha inserita Francesco. */
  origine?: string;
  /** ISO 8601 UTC. */
  creataIl: string;
}

/** Fascia in cui la poltrona non si prenota: pausa, commissione, ferie. */
export interface Blocco {
  tipo: "blocco";
  id: string;
  data: string;
  inizio: number;
  fine: number;
  operatoreId: string;
  /** Scritto da Francesco, facoltativo: "Pausa", "Dentista"… */
  motivo?: string;
  creataIl: string;
}

/** Tutto ciò che occupa un pezzo di agenda. */
export type VoceAgenda = Prenotazione | Blocco;

/** Prenotazione in arrivo dal sito, già validata. */
export type RichiestaPrenotazione = Omit<Prenotazione, "id" | "creataIl" | "tipo">;

/** Voce nuova o modificata dall'agenda, già validata. */
export type NuovaVoce = Omit<Prenotazione, "id" | "creataIl"> | Omit<Blocco, "id" | "creataIl">;

/** Esito di una validazione: o i dati puliti, o l'elenco degli errori. */
export type Esito<T> =
  | { ok: true; dati: T }
  | { ok: false; errori: Record<string, string> };

/* ── Agenda: Server Action ⇄ client ─────────────────────────────────────── */

/** Campi del modulo "appuntamento" dell'agenda. */
export interface DatiAppuntamento {
  data: string;
  /** "HH:MM" di inizio. */
  ora: string;
  /** Minuti. */
  durata: number;
  /** Id del listino, oppure SERVIZIO_LIBERO con il nome in `servizioNome`. */
  servizioId: string;
  servizioNome?: string;
  prezzo: number;
  nome: string;
  telefono?: string;
}

/** Campi del modulo "blocca". */
export interface DatiBlocco {
  data: string;
  ora: string;
  durata: number;
  motivo?: string;
}

/** Risposta di ogni Server Action dell'agenda. */
export type EsitoAzione =
  | { ok: true }
  | { ok: false; errore: string; campi?: Record<string, string> };

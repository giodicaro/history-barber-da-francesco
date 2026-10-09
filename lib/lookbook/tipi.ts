/* Tipi del Lookbook personale, condivisi fra server, pagine e componenti.

   Le foto non viaggiano mai dentro questi oggetti: qui c'è solo il loro id,
   e i byte si chiedono a una rotta a parte (/api/lookbook/foto/<id> per il
   barbiere, /stile/<token>/foto/<id> per il cliente). Così l'elenco dei look
   resta leggero e le immagini si possono mettere in cache. */

/** Le tre inquadrature, nell'ordine in cui si scattano: la nuca serve di più. */
export const POSIZIONI = ["dietro", "profilo", "davanti"] as const;
export type Posizione = (typeof POSIZIONI)[number];

export const NOMI_POSIZIONE: Record<Posizione, string> = {
  dietro: "Dietro",
  profilo: "Profilo",
  davanti: "Davanti",
};

export type TipoImmagine = "image/webp" | "image/jpeg";

/** Le note tecniche di un taglio. Tutte facoltative. */
export interface NoteLook {
  sfumatura?: string;
  sopra?: string;
  barba?: string;
  prodotto?: string;
  note?: string;
}

export const CAMPI_NOTE = ["sfumatura", "sopra", "barba", "prodotto", "note"] as const;
export type CampoNota = (typeof CAMPI_NOTE)[number];

export const NOMI_CAMPO: Record<CampoNota, string> = {
  sfumatura: "Sfumatura",
  sopra: "Sopra",
  barba: "Barba",
  prodotto: "Prodotto",
  note: "Note",
};

export interface FotoLook {
  id: string;
  posizione: Posizione;
}

export interface Look extends NoteLook {
  id: string;
  /** Giornata di salone, "YYYY-MM-DD". */
  data: string;
  preferito: boolean;
  /** In ordine di POSIZIONI. */
  foto: FotoLook[];
}

export interface ClienteLookbook {
  id: string;
  nome: string;
  /** +39…, se lasciato. */
  telefono?: string;
  token: string;
  /** ISO 8601. */
  consensoIl: string;
  creatoIl: string;
}

/** Riga dell'elenco schede del barbiere. */
export interface RigaElenco {
  id: string;
  nome: string;
  telefono?: string;
  looks: number;
  /** Data dell'ultimo look, se c'è. */
  ultimo?: string;
  /** Id della miniatura dell'ultimo look, per riconoscerlo a colpo d'occhio. */
  copertina?: string;
}

/** Ciò che vede il cliente: niente token né telefono nelle props. */
export interface StileCliente {
  nome: string;
  looks: Look[];
}

/** Risposta delle Server Action e di POST /api/lookbook. */
export type EsitoLookbook<T = object> =
  | ({ ok: true } & T)
  | { ok: false; errore: string; campi?: Record<string, string> };

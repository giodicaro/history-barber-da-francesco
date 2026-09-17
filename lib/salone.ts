/* Sorgente unica dei contenuti del sito. Cambiare un prezzo, un orario o una
   foto significa toccare solo questo file.

   Provenienza dei dati (settembre 2026):
   - indirizzo, telefono e orari: scheda Fresha pubblica del salone, che però
     non è gestita dal salone stesso;
   - "solo su appuntamento" e "rivenditore autorizzato Depot": bio Instagram;
   - servizi e prezzi: NESSUNA FONTE PUBBLICA. Fresha non pubblica un listino
     per questo salone, quindi voci e prezzi qui sotto sono indicativi e
     vanno confermati con Francesco prima di andare online. */

export const salone = {
  nome: "History Barber",
  firma: "da Francesco",
  nomeCompleto: "History Barber da Francesco",
  via: "Via Ca' Rossa 47/A-B",
  cap: "30173",
  citta: "Mestre",
  provincia: "VE",
  telefono: "348 697 6353",
  telefonoHref: "tel:+393486976353",
  mappeHref:
    "https://www.google.com/maps/search/?api=1&query=History+Barber+da+Francesco+Via+Ca%27+Rossa+47+Mestre",
  instagram: "history_barber_da_francesco_",
  instagramHref: "https://www.instagram.com/history_barber_da_francesco_/",
  // Obbligatoria sul sito di un'attività italiana: il footer la mostra solo
  // quando è compilata, per non esporre un segnaposto.
  partitaIva: "",
} as const;

/* ── Orari ──────────────────────────────────────────────────────────────── */

// Indice come Date.getDay(): 0 = domenica. Ogni turno è in minuti dalla
// mezzanotte, perché la pausa pranzo spezza la giornata in due.
export type Turno = { apre: number; chiude: number };

const h = (ore: number, minuti = 0) => ore * 60 + minuti;

export const orari: { giorno: string; breve: string; turni: Turno[] }[] = [
  { giorno: "Domenica", breve: "Dom", turni: [] },
  { giorno: "Lunedì", breve: "Lun", turni: [] },
  {
    giorno: "Martedì",
    breve: "Mar",
    turni: [
      { apre: h(8, 30), chiude: h(13) },
      { apre: h(14, 30), chiude: h(20) },
    ],
  },
  {
    giorno: "Mercoledì",
    breve: "Mer",
    turni: [
      { apre: h(8, 30), chiude: h(13) },
      { apre: h(14, 30), chiude: h(20) },
    ],
  },
  {
    giorno: "Giovedì",
    breve: "Gio",
    turni: [
      { apre: h(8, 30), chiude: h(13) },
      { apre: h(14, 30), chiude: h(20) },
    ],
  },
  {
    giorno: "Venerdì",
    breve: "Ven",
    turni: [
      { apre: h(8, 30), chiude: h(13) },
      { apre: h(14, 30), chiude: h(20) },
    ],
  },
  {
    giorno: "Sabato",
    breve: "Sab",
    turni: [
      { apre: h(8, 30), chiude: h(13) },
      { apre: h(14, 30), chiude: h(19) },
    ],
  },
];

// La settimana del barbiere si legge da lunedì: la tabella segue quell'ordine,
// i calcoli restano sull'indice di getDay().
export const ordineSettimana = [1, 2, 3, 4, 5, 6, 0];

/* ── Listino ────────────────────────────────────────────────────────────── */

export type Servizio = {
  nome: string;
  dettaglio: string;
  prezzo: number;
  // "da" per i servizi a prezzo variabile, "+" per i supplementi.
  prefisso?: "da" | "+";
};

export type GruppoListino = {
  id: string;
  titolo: string;
  servizi: Servizio[];
};

// ⚠️ PREZZI INDICATIVI, DA CONFERMARE. Vedi il commento in cima al file.
export const listino: GruppoListino[] = [
  {
    id: "taglio",
    titolo: "Taglio",
    servizi: [
      { nome: "Taglio uomo", dettaglio: "Forbice e macchinetta, shampoo e styling", prezzo: 18 },
      { nome: "Skin fade", dettaglio: "Sfumatura a zero, rifinita a rasoio", prezzo: 20 },
      { nome: "Rasatura testa", dettaglio: "Macchinetta e rasoio, panno caldo", prezzo: 15 },
      { nome: "Taglio bambino", dettaglio: "Fino a 12 anni", prezzo: 13 },
      { nome: "Disegno rasato", dettaglio: "Linee e grafiche a rasoio, in aggiunta al taglio", prezzo: 5, prefisso: "+" },
    ],
  },
  {
    id: "barba",
    titolo: "Barba",
    servizi: [
      { nome: "Rifinitura barba", dettaglio: "Contorni e lunghezza a macchinetta", prezzo: 10 },
      { nome: "Barba completa", dettaglio: "Panno caldo, rasoio a mano libera, olio", prezzo: 15 },
    ],
  },
  {
    id: "combo",
    titolo: "Combo",
    servizi: [
      { nome: "Taglio + barba", dettaglio: "Taglio uomo e rifinitura barba", prezzo: 26 },
      { nome: "Skin fade + barba completa", dettaglio: "Il servizio completo, con panno caldo", prezzo: 32 },
      { nome: "Papà + figlio", dettaglio: "Taglio uomo e taglio bambino, stesso appuntamento", prezzo: 29 },
    ],
  },
];

/* ── Portfolio ──────────────────────────────────────────────────────────── */

export type Lavoro = {
  titolo: string;
  // Il dettaglio tecnico che un cliente riconosce: numeri del rialzo, attrezzo.
  tecnica: string;
  alt: string;
  // Percorso in /public. Finché è assente, la casella mostra un segnaposto
  // dichiarato invece di un'immagine rotta.
  src?: string;
};

export const portfolio: Lavoro[] = [
  { titolo: "Skin fade", tecnica: "0 → 3 · rasoio", alt: "Sfumatura a zero sulla nuca, capelli corti sopra" },
  { titolo: "Crop texturizzato", tecnica: "Forbice · 1 ai lati", alt: "Taglio corto con frangia texturizzata" },
  { titolo: "Disegno rasato", tecnica: "Lametta · linea singola", alt: "Linea rasata sul lato della testa" },
  { titolo: "Barba scolpita", tecnica: "Panno caldo · rasoio", alt: "Barba corta con contorni netti" },
  { titolo: "Mid fade", tecnica: "0,5 → 2 · macchinetta", alt: "Sfumatura media con capelli pettinati all'indietro" },
  { titolo: "Taglio classico", tecnica: "Forbice · riga laterale", alt: "Taglio classico con riga di lato" },
  { titolo: "Primo taglio", tecnica: "Forbice · bambino", alt: "Bambino durante il taglio sulla poltrona" },
  { titolo: "Buzz cut", tecnica: "Macchinetta · 1", alt: "Capelli rasati corti e uniformi" },
];

// Foto di sfondo della prima schermata. Assente = segnaposto scuro.
// Immagine generata con Higgsfield (2752×1536, 16:9): non ritrae un cliente
// del salone, da sostituire con una foto vera quando arriva.
// Sul mobile se ne vede solo una fascia verticale larga circa il 22%:
// "posizione" (object-position) la sposta sul soggetto. Con la testa centrata
// al 57,5% della larghezza, la fascia è centrata con x = 60%.
export const fotoHero: { src?: string; alt: string; posizione?: string } = {
  src: "/images/hero-sfumatura.webp",
  alt: "Nuca di un uomo con sfumatura netta e riga rasata, vapore da un panno caldo",
  posizione: "60% 50%",
};

/* ── Navigazione ────────────────────────────────────────────────────────── */

export const vociMenu = [
  { id: "chi-siamo", etichetta: "Chi Siamo" },
  { id: "portfolio", etichetta: "Portfolio" },
  { id: "listino", etichetta: "Listino" },
  { id: "contatti", etichetta: "Contatti" },
] as const;

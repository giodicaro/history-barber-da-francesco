/* Dati del salone nel formato dell'app clienti (public/app/data/shop.json).

   La fonte resta una sola, lib/salone.ts: questa funzione la traduce nella
   forma che legge l'app. La usano
   - l'API dell'app (GET /app/api/shop), a ogni richiesta;
   - scripts/genera-dati-app.mjs, che scrive la copia statica in
     public/app/data/shop.json (usata offline e in modalità demo).
   Per questo il modulo non ha import: Node lo carica così com'è. */

type Turno = { apre: number; chiude: number };

export interface FonteDatiApp {
  salone: {
    nome: string;
    firma: string;
    via: string;
    cap: string;
    citta: string;
    provincia: string;
    telefono: string;
    telefonoHref: string;
    mappeHref: string;
    instagram: string;
    instagramHref: string;
  };
  orari: { giorno: string; breve: string; turni: Turno[] }[];
  listino: {
    id: string;
    titolo: string;
    servizi: { id: string; nome: string; dettaglio: string; prezzo: number; durata: number; prefisso?: string; prenotabile?: false }[];
  }[];
  operatori: { id: string; nome: string; ruolo?: string }[];
  preavvisoMinuti: number;
  giorniPrenotabili: number;
  passoMinuti: number;
  modificabileFinoAMinuti: number;
  prenotazioniAttiveMax: number;
  listinoConfermato: boolean;
  /** Giornate di chiusura per festività, ISO. */
  chiusure: string[];
}

const ora = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function costruisciDatiApp(f: FonteDatiApp) {
  const s = f.salone;
  return {
    _readme:
      "File generato da lib/salone.ts con `npm run app:dati`: non modificarlo a mano. Prezzi e durate con sample:true sono indicativi finché LISTINO_CONFERMATO è false.",
    shop: {
      name: s.nome,
      signature: s.firma,
      tagline: "Barbiere a Mestre, solo su appuntamento",
      street: s.via,
      postalCode: s.cap,
      city: s.citta,
      province: s.provincia,
      phone: s.telefono,
      phoneHref: s.telefonoHref,
      instagram: s.instagram,
      instagramUrl: s.instagramHref,
      mapsUrl: s.mappeHref,
      timezone: "Europe/Rome",
      notes: ["Rivenditore autorizzato Depot"],
    },
    hours: {
      days: f.orari.map((g) => ({ label: g.giorno, short: g.breve, shifts: g.turni.map((t) => [ora(t.apre), ora(t.chiude)]) })),
      closedDates: f.chiusure,
    },
    booking: {
      slotStepMinutes: f.passoMinuti,
      minNoticeMinutes: f.preavvisoMinuti,
      // Oggi compreso: il sito propone oggi + GIORNI_PRENOTABILI giorni.
      maxDaysAhead: f.giorniPrenotabili + 1,
      cancelCutoffMinutes: f.modificabileFinoAMinuti,
      maxActivePerContact: f.prenotazioniAttiveMax,
    },
    barbers: f.operatori.map((o) => ({ id: o.id, name: o.nome, ...(o.ruolo ? { role: o.ruolo } : {}) })),
    categories: f.listino.map((g) => ({ id: g.id, title: g.titolo })),
    // Solo i servizi prenotabili da soli: i supplementi si chiedono in salone.
    services: f.listino.flatMap((g) =>
      g.servizi
        .filter((x) => x.prenotabile !== false)
        .map((x) => ({
          id: x.id,
          category: g.id,
          name: x.nome,
          description: x.dettaglio,
          durationMinutes: x.durata,
          price: x.prezzo,
          ...(x.prefisso === "da" ? { pricePrefix: "da" } : {}),
          sample: !f.listinoConfermato,
        })),
    ),
  };
}

export type DatiApp = ReturnType<typeof costruisciDatiApp>;

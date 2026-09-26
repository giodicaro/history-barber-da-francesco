import { formatoOra, giornoDellaData, sommaGiorni } from "@/lib/orari";
import { orari, type Turno } from "@/lib/salone";
import type { VoceAgenda } from "./tipi";

/* Regole dell'agenda di /admin. Funzioni pure, usate sia dalla pagina server
   sia dai moduli nel browser: niente rete, niente database. */

/** Minuti di una riga libera della timeline. */
export const MINUTI_RIGA = 30;

/** Ogni quanti minuti si può far iniziare un appuntamento dall'agenda. */
export const PASSO_AGENDA = 15;

/** Id del servizio "fuori listino": il nome lo scrive Francesco. */
export const SERVIZIO_LIBERO = "altro";

/** Durate proposte nel menu, in minuti. Comprendono quelle del listino. */
export const DURATE = [15, 20, 30, 45, 50, 60, 75, 90, 120, 150, 180, 240];

export const durataLeggibile = (minuti: number) => {
  const ore = Math.floor(minuti / 60);
  const resto = minuti % 60;
  if (!ore) return `${resto} min`;
  return resto ? `${ore} h ${resto}` : `${ore} h`;
};

export const turniDellaData = (data: string): Turno[] => orari[giornoDellaData(data)].turni;

export const aperto = (data: string) => turniDellaData(data).length > 0;

/** Il primo giorno di apertura prima (-1) o dopo (+1) la data: le frecce
    saltano domenica e lunedì, e qualunque altro giorno di chiusura. */
export function giornoApertoVicino(data: string, verso: 1 | -1): string {
  let d = data;
  for (let i = 0; i < 7; i++) {
    d = sommaGiorni(d, verso);
    if (aperto(d)) return d;
  }
  return sommaGiorni(data, verso);
}

/** Orari di inizio proponibili nel menu: ogni quarto d'ora dentro i turni. */
export function orariDiInizio(data: string): number[] {
  return turniDellaData(data).flatMap((t) => {
    const elenco: number[] = [];
    for (let m = t.apre; m < t.chiude; m += PASSO_AGENDA) elenco.push(m);
    return elenco;
  });
}

/** Il turno che contiene l'orario, se c'è. */
export const turnoDi = (data: string, minuti: number) =>
  turniDellaData(data).find((t) => minuti >= t.apre && minuti < t.chiude);

/* ── Timeline ───────────────────────────────────────────────────────────── */

export type Riga =
  | { tipo: "libero"; inizio: number; fine: number }
  | { tipo: "voce"; voce: VoceAgenda }
  | { tipo: "pausa"; inizio: number; fine: number };

/* La giornata come la si legge alla cassa: dentro ogni turno, le voci con la
   loro durata vera e i buchi spezzati sulla griglia della mezz'ora. Un taglio
   da 45 minuti alle 9:00 occupa una sola scheda, alta quanto dura, e la riga
   libera successiva parte alle 9:45 e finisce alle 10:00: si vede subito che
   c'è un quarto d'ora.

   Una voce fuori dai turni (inserita prima di un cambio d'orario) compare lo
   stesso, fra i turni: l'agenda non nasconde mai un cliente. */
export function costruisciTimeline(voci: VoceAgenda[], turni: Turno[]): Riga[] {
  const ordinate = [...voci].sort((a, b) => a.inizio - b.inizio);
  const mostrate = new Set<string>();
  const righe: Riga[] = [];

  const liberi = (da: number, a: number) => {
    let m = da;
    while (m < a) {
      const fineRiga = Math.min(a, (Math.floor(m / MINUTI_RIGA) + 1) * MINUTI_RIGA);
      righe.push({ tipo: "libero", inizio: m, fine: fineRiga });
      m = fineRiga;
    }
  };

  turni.forEach((turno, i) => {
    if (i > 0) {
      const precedente = turni[i - 1];
      // Voci inserite nella pausa pranzo: stanno fra i due turni.
      for (const v of ordinate) {
        if (!mostrate.has(v.id) && v.inizio >= precedente.chiude && v.inizio < turno.apre) {
          righe.push({ tipo: "voce", voce: v });
          mostrate.add(v.id);
        }
      }
      righe.push({ tipo: "pausa", inizio: precedente.chiude, fine: turno.apre });
    }
    let cursore = turno.apre;
    for (const v of ordinate) {
      if (mostrate.has(v.id) || v.fine <= turno.apre || v.inizio >= turno.chiude) continue;
      if (v.inizio > cursore) liberi(cursore, v.inizio);
      righe.push({ tipo: "voce", voce: v });
      mostrate.add(v.id);
      cursore = Math.max(cursore, v.fine);
    }
    liberi(cursore, turno.chiude);
  });

  // Quello che resta è fuori orario (prima dell'apertura, dopo la chiusura,
  // o in un giorno di chiusura): in coda, in ordine.
  const fuori = ordinate.filter((v) => !mostrate.has(v.id));
  if (fuori.length) {
    const prima = fuori.filter((v) => turni.length && v.inizio < turni[0].apre);
    const dopo = fuori.filter((v) => !prima.includes(v));
    return [...prima.map((voce) => ({ tipo: "voce" as const, voce })), ...righe, ...dopo.map((voce) => ({ tipo: "voce" as const, voce }))];
  }
  return righe;
}

/* ── Numeri del giorno ──────────────────────────────────────────────────── */

const sovrapposizione = (a: { inizio: number; fine: number }, t: Turno) =>
  Math.max(0, Math.min(a.fine, t.chiude) - Math.max(a.inizio, t.apre));

export interface Statistiche {
  appuntamenti: number;
  /** Euro previsti: somma dei prezzi degli appuntamenti. */
  previsto: number;
  /** Quota del tempo prenotabile occupata da clienti, 0–100. */
  poltrona: number;
  /** Minuti ancora liberi dentro i turni. */
  minutiLiberi: number;
}

/* "Poltrona" = minuti di clienti ÷ minuti in cui si poteva lavorare. I blocchi
   escono dal denominatore: una pausa voluta non abbassa la percentuale. */
export function statistiche(voci: VoceAgenda[], turni: Turno[]): Statistiche {
  const dentro = (v: VoceAgenda) => turni.reduce((s, t) => s + sovrapposizione(v, t), 0);
  const appuntamenti = voci.filter((v) => v.tipo === "appuntamento");
  const minutiApertura = turni.reduce((s, t) => s + (t.chiude - t.apre), 0);
  const minutiBloccati = voci.filter((v) => v.tipo === "blocco").reduce((s, v) => s + dentro(v), 0);
  const minutiClienti = appuntamenti.reduce((s, v) => s + dentro(v), 0);
  const prenotabili = minutiApertura - minutiBloccati;
  return {
    appuntamenti: appuntamenti.length,
    previsto: appuntamenti.reduce((s, v) => s + v.prezzo, 0),
    poltrona: prenotabili > 0 ? Math.min(100, Math.round((minutiClienti / prenotabili) * 100)) : 0,
    minutiLiberi: Math.max(0, prenotabili - minutiClienti),
  };
}

/** La voce che si sovrapporrebbe a un intervallo, esclusa quella in modifica. */
export const primaSovrapposta = (
  voci: VoceAgenda[],
  intervallo: { inizio: number; fine: number },
  escludi?: string,
) => voci.find((v) => v.id !== escludi && v.inizio < intervallo.fine && intervallo.inizio < v.fine);

export const etichettaVoce = (v: VoceAgenda) =>
  `${v.tipo === "blocco" ? (v.motivo ?? "Blocco") : v.cliente.nome} (${formatoOra(v.inizio)}–${formatoOra(v.fine)})`;

import { festivita } from "./festivi";
import { CHIUSO_NEI_FESTIVI, orari, type Turno } from "./salone";

export type StatoApertura =
  | { aperto: true; chiudeAlle: string }
  /** ferie: oggi chiuso per una chiusura di Francesco (motivo, o ""). */
  | { aperto: false; riapre: string; ferie?: string };

// Minuti dalla mezzanotte ⇄ "HH:MM". Esportate perché le usano anche l'API di
// prenotazione e l'agenda: un solo posto dove si decide il formato dell'ora.
export const formatoOra = (minuti: number) =>
  `${String(Math.floor(minuti / 60)).padStart(2, "0")}:${String(minuti % 60).padStart(2, "0")}`;

export function minutiDaOra(ora: string) {
  const [h, m] = ora.split(":").map(Number);
  return h * 60 + m;
}

// Creare un Intl.DateTimeFormat costa molto più che usarlo: uno solo, creato
// alla prima chiamata e poi riusato (sul telefono era chiamato a ogni lettura
// dello stato "Aperto ora").
let formatoRoma: Intl.DateTimeFormat | undefined;

// Il salone è a Mestre: l'ora che conta è quella di Roma, non quella del
// telefono di chi guarda il sito da un altro fuso.
export function oraDiRoma(adesso = new Date()) {
  formatoRoma ??= new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parti = formatoRoma.formatToParts(adesso);
  const valore = (tipo: string) => parti.find((p) => p.type === tipo)?.value ?? "";
  const giorni = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    giorno: giorni.indexOf(valore("weekday")),
    minuti: Number(valore("hour")) * 60 + Number(valore("minute")),
    // Data di Roma in formato ISO: è la "giornata" a cui appartengono gli
    // appuntamenti, indipendente dal fuso di chi guarda il sito.
    data: `${valore("year")}-${valore("month")}-${valore("day")}`,
  };
}

// Giorno della settimana (0 = domenica) di una data ISO, letta come giornata
// del salone. Mezzogiorno UTC cade sempre nello stesso giorno a Roma, sia con
// l'ora solare sia con quella legale.
export function giornoDellaData(data: string) {
  return new Date(`${data}T12:00:00Z`).getUTCDay();
}

// Somma giorni a una data ISO restando su date "civili", senza fusi orari.
export function sommaGiorni(data: string, giorni: number) {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + giorni);
  return d.toISOString().slice(0, 10);
}

/** Festività in cui il salone è chiuso (null se aperto o se si lavora nei festivi). */
export const festivitaChiusa = (data: string) => (CHIUSO_NEI_FESTIVI ? festivita(data) : null);

/** Turni di una giornata precisa: quelli della settimana, nessuno nei festivi. */
export function turniDellaGiornata(data: string): Turno[] {
  return festivitaChiusa(data) ? [] : orari[giornoDellaData(data)].turni;
}

/** Lo stato "Aperto ora / Chiuso ora · Riapre …". Con le chiusure decise da
    Francesco (ferie) i giorni chiusi saltano, e se oggi è chiuso per una di
    quelle lo stato lo dice (ferie, con il motivo se c'è). */
export function calcolaStato(
  adesso = new Date(),
  chiusure: readonly { dal: string; al: string; motivo?: string }[] = [],
): StatoApertura {
  const { data, minuti } = oraDiRoma(adesso);
  const chiusa = (giornata: string) => chiusure.find((c) => c.dal <= giornata && giornata <= c.al);
  const turniDi = (giornata: string) => (chiusa(giornata) ? [] : turniDellaGiornata(giornata));
  const ferie = chiusa(data);
  const conFerie = ferie ? { ferie: ferie.motivo ?? "" } : {};

  const turnoInCorso = turniDi(data).find(
    (t) => minuti >= t.apre && minuti < t.chiude,
  );
  if (turnoInCorso) return { aperto: true, chiudeAlle: formatoOra(turnoInCorso.chiude) };

  // Prossima apertura: prima il resto di oggi (la pausa pranzo), poi i giorni
  // seguenti. Due mesi coprono anche le ferie più lunghe.
  for (let avanti = 0; avanti < 62; avanti++) {
    const giornata = sommaGiorni(data, avanti);
    const g = giornoDellaData(giornata);
    const turno = turniDi(giornata).find((t) => avanti > 0 || t.apre > minuti);
    if (!turno) continue;
    // Oltre la settimana il nome del giorno non basta: "il 25/8".
    const quando =
      avanti === 0
        ? "oggi"
        : avanti === 1
          ? "domani"
          : avanti < 7
            ? orari[g].breve.toLowerCase()
            : `il ${Number(giornata.slice(8, 10))}/${Number(giornata.slice(5, 7))}`;
    // Spazio unificatore: se la riga non basta, "alle 14:30" va a capo intero.
    return { aperto: false, riapre: `${quando} alle\u00a0${formatoOra(turno.apre)}`, ...conFerie };
  }
  return { aperto: false, riapre: "", ...conFerie };
}

export function turniLeggibili(turni: { apre: number; chiude: number }[]) {
  if (turni.length === 0) return "Chiuso";
  return turni.map((t) => `${formatoOra(t.apre)}–${formatoOra(t.chiude)}`).join(" / ");
}

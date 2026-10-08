import { festivita } from "./festivi";
import { CHIUSO_NEI_FESTIVI, orari, type Turno } from "./salone";

export type StatoApertura =
  | { aperto: true; chiudeAlle: string }
  | { aperto: false; riapre: string };

// Minuti dalla mezzanotte ⇄ "HH:MM". Esportate perché le usano anche l'API di
// prenotazione e l'agenda: un solo posto dove si decide il formato dell'ora.
export const formatoOra = (minuti: number) =>
  `${String(Math.floor(minuti / 60)).padStart(2, "0")}:${String(minuti % 60).padStart(2, "0")}`;

export function minutiDaOra(ora: string) {
  const [h, m] = ora.split(":").map(Number);
  return h * 60 + m;
}

// Il salone è a Mestre: l'ora che conta è quella di Roma, non quella del
// telefono di chi guarda il sito da un altro fuso.
export function oraDiRoma(adesso = new Date()) {
  const parti = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(adesso);
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

export function calcolaStato(adesso = new Date()): StatoApertura {
  const { data, minuti } = oraDiRoma(adesso);

  const turnoInCorso = turniDellaGiornata(data).find(
    (t) => minuti >= t.apre && minuti < t.chiude,
  );
  if (turnoInCorso) return { aperto: true, chiudeAlle: formatoOra(turnoInCorso.chiude) };

  // Prossima apertura: prima il resto di oggi (la pausa pranzo), poi i giorni
  // seguenti. Due settimane bastano anche con un ponte di festività.
  for (let avanti = 0; avanti < 14; avanti++) {
    const giornata = sommaGiorni(data, avanti);
    const g = giornoDellaData(giornata);
    const turno = turniDellaGiornata(giornata).find((t) => avanti > 0 || t.apre > minuti);
    if (!turno) continue;
    const quando = avanti === 0 ? "oggi" : avanti === 1 ? "domani" : orari[g].breve.toLowerCase();
    // Spazio unificatore: se la riga non basta, "alle 14:30" va a capo intero.
    return { aperto: false, riapre: `${quando} alle\u00a0${formatoOra(turno.apre)}` };
  }
  return { aperto: false, riapre: "" };
}

export function turniLeggibili(turni: { apre: number; chiude: number }[]) {
  if (turni.length === 0) return "Chiuso";
  return turni.map((t) => `${formatoOra(t.apre)}–${formatoOra(t.chiude)}`).join(" / ");
}

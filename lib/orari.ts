import { orari } from "./salone";

export type StatoApertura =
  | { aperto: true; chiudeAlle: string }
  | { aperto: false; riapre: string };

const formatoOra = (minuti: number) =>
  `${String(Math.floor(minuti / 60)).padStart(2, "0")}:${String(minuti % 60).padStart(2, "0")}`;

// Il salone è a Mestre: l'ora che conta è quella di Roma, non quella del
// telefono di chi guarda il sito da un altro fuso.
export function oraDiRoma(adesso = new Date()) {
  const parti = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(adesso);
  const valore = (tipo: string) => parti.find((p) => p.type === tipo)?.value ?? "";
  const giorni = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    giorno: giorni.indexOf(valore("weekday")),
    minuti: Number(valore("hour")) * 60 + Number(valore("minute")),
  };
}

export function calcolaStato(adesso = new Date()): StatoApertura {
  const { giorno, minuti } = oraDiRoma(adesso);

  const turnoInCorso = orari[giorno].turni.find(
    (t) => minuti >= t.apre && minuti < t.chiude,
  );
  if (turnoInCorso) return { aperto: true, chiudeAlle: formatoOra(turnoInCorso.chiude) };

  // Prossima apertura: prima il resto di oggi (la pausa pranzo), poi i giorni
  // seguenti. Sette giri bastano sempre, perché la settimana ha giorni aperti.
  for (let avanti = 0; avanti < 7; avanti++) {
    const g = (giorno + avanti) % 7;
    const turno = orari[g].turni.find((t) => avanti > 0 || t.apre > minuti);
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

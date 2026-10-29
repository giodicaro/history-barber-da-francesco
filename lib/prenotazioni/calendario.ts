/* Ora di Roma ⇄ istante assoluto, e il file .ics "Aggiungi al calendario".

   Senza import, valido nel browser e sul server. Gli appuntamenti sono
   giornate di salone ("YYYY-MM-DD") più minuti dalla mezzanotte di Roma: per
   confrontarli con "adesso" o scriverli in un calendario serve l'istante
   vero, che cambia di un'ora fra ora solare e ora legale. Su Vercel il server
   gira in UTC, il telefono del cliente nel suo fuso: nessuno dei due conta. */

const FUSO = "Europe/Rome";

const parti = new Intl.DateTimeFormat("en-GB", {
  timeZone: FUSO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Di quanti minuti Roma è avanti rispetto a UTC in quell'istante (60 o 120). */
function scartoRoma(istante: number): number {
  const p = Object.fromEntries(parti.formatToParts(new Date(istante)).map((x) => [x.type, x.value]));
  const comeUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  return Math.round((comeUtc - Math.floor(istante / 60000) * 60000) / 60000);
}

/** Istante (ms) di una data e ora di Roma. Nell'ora che non esiste (la notte
    del passaggio all'ora legale) restituisce quella subito dopo. */
export function romaInIstante(data: string, minuti: number): number {
  const [a, m, g] = data.split("-").map(Number);
  const comeUtc = Date.UTC(a, m - 1, g, 0, minuti);
  // Due passaggi: lo scarto si legge vicino all'istante giusto, e cambia solo
  // nelle due notti all'anno del cambio d'ora.
  let istante = comeUtc - scartoRoma(comeUtc) * 60000;
  istante = comeUtc - scartoRoma(istante) * 60000;
  return istante;
}

/** Data e minuti di Roma di un istante. */
export function istanteInRoma(istante: number): { data: string; minuti: number } {
  const p = Object.fromEntries(parti.formatToParts(new Date(istante)).map((x) => [x.type, x.value]));
  return { data: `${p.year}-${p.month}-${p.day}`, minuti: +p.hour * 60 + +p.minute };
}

const dueCifre = (n: number) => String(n).padStart(2, "0");
const formatoIcs = (istante: number) => {
  const d = new Date(istante);
  return `${d.getUTCFullYear()}${dueCifre(d.getUTCMonth() + 1)}${dueCifre(d.getUTCDate())}T${dueCifre(d.getUTCHours())}${dueCifre(d.getUTCMinutes())}00Z`;
};

// Testo dentro un .ics: virgole, punti e virgola, a capo e barre vanno protetti.
const protetto = (t: string) => t.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n");

/** Contenuto di un file .ics con l'appuntamento. Orari in UTC ("Z"): ogni
    calendario li mostra giusti nel fuso del telefono, senza tabelle dei fusi. */
export function fileCalendario(a: {
  uid: string;
  data: string;
  inizio: number;
  fine: number;
  titolo: string;
  luogo: string;
  descrizione: string;
  adesso?: number;
}): string {
  const righe = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//History Barber da Francesco//Appuntamento//IT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${a.uid}`,
    `DTSTAMP:${formatoIcs(a.adesso ?? Date.now())}`,
    `DTSTART:${formatoIcs(romaInIstante(a.data, a.inizio))}`,
    `DTEND:${formatoIcs(romaInIstante(a.data, a.fine))}`,
    `SUMMARY:${protetto(a.titolo)}`,
    `LOCATION:${protetto(a.luogo)}`,
    `DESCRIPTION:${protetto(a.descrizione)}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Appuntamento dal barbiere",
    "TRIGGER:-PT2H",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  // Lo standard vuole CRLF.
  return righe.join("\r\n") + "\r\n";
}

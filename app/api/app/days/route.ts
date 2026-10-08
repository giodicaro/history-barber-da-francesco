import { giorni, promemoriaDiPassaggio, rispondi } from "@/lib/prenotazioni/app";

/** Giorni prenotabili con il numero di orari liberi: GET ?service=&barber= */
export function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  promemoriaDiPassaggio();
  return rispondi(async () => ({ days: await giorni({ service: q.get("service"), barber: q.get("barber") }) }));
}

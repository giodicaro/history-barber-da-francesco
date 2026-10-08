import { disponibilita, rispondi } from "@/lib/prenotazioni/app";

/** Orari liberi di un giorno: GET ?date=YYYY-MM-DD&service=&barber= (barber=any per "Primo disponibile"). */
export function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  return rispondi(async () => {
    const date = q.get("date");
    const slots = await disponibilita({ date, service: q.get("service"), barber: q.get("barber") });
    return { date, slots: slots.map(({ time, startUtc, barberIds }) => ({ time, startUtc, barberIds })) };
  });
}

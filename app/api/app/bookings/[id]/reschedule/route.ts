import { controllaFrequenza, leggiCorpo, rispondi, sposta } from "@/lib/prenotazioni/app";

/** Spostamento dal cliente: { date, time }. Avvisa Francesco. */
export async function POST(request: Request, ctx: RouteContext<"/api/app/bookings/[id]/reschedule">) {
  const { id } = await ctx.params;
  return rispondi(async () => {
    controllaFrequenza(request);
    const corpo = await leggiCorpo(request);
    return { booking: await sposta(id, request.headers.get("X-Booking-Token") ?? corpo.token, corpo) };
  });
}

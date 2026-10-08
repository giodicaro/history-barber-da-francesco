import { controllaFrequenza, disdici, leggiCorpo, rispondi } from "@/lib/prenotazioni/app";

/** Disdetta dal cliente, fino a MODIFICABILE_FINO_A_MINUTI prima. Avvisa Francesco. */
export async function POST(request: Request, ctx: RouteContext<"/api/app/bookings/[id]/cancel">) {
  const { id } = await ctx.params;
  return rispondi(async () => {
    controllaFrequenza(request);
    const corpo = await leggiCorpo(request);
    return { booking: await disdici(id, request.headers.get("X-Booking-Token") ?? corpo.token) };
  });
}

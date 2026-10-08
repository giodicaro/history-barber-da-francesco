import { prenotazioneAutorizzata, presenta, rispondi } from "@/lib/prenotazioni/app";

/** La prenotazione del cliente, con il token del suo link (header X-Booking-Token). */
export async function GET(request: Request, ctx: RouteContext<"/api/app/bookings/[id]">) {
  const { id } = await ctx.params;
  return rispondi(async () => ({ booking: presenta(await prenotazioneAutorizzata(id, request.headers.get("X-Booking-Token"))) }));
}

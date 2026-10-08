import {
  collegaPromemoria,
  controllaFrequenza,
  ErroreApp,
  leggiCorpo,
  prenotazioneAutorizzata,
  rispondi,
  salvaIscrizioneCliente,
} from "@/lib/prenotazioni/app";
import { iscrizioneValida } from "@/lib/prenotazioni/notifiche";

/** Iscrive il telefono del cliente ai promemoria. { subscription, bookingId?, token?, oldEndpoint? }
    Collegare un appuntamento richiede il token del suo link. */
export async function POST(request: Request) {
  return rispondi(async () => {
    controllaFrequenza(request);
    const { subscription, bookingId, oldEndpoint, token } = await leggiCorpo(request);
    if (!iscrizioneValida(subscription)) throw new ErroreApp(422, "invalid_subscription", "Iscrizione non valida.");
    if (typeof bookingId === "string" && bookingId) await prenotazioneAutorizzata(bookingId, request.headers.get("X-Booking-Token") ?? token);
    await salvaIscrizioneCliente(subscription, typeof oldEndpoint === "string" ? oldEndpoint : undefined);
    if (typeof bookingId === "string" && bookingId) await collegaPromemoria(bookingId, subscription.endpoint);
    return { ok: true };
  }, 201);
}

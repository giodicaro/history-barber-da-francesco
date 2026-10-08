import { controllaFrequenza, creaPrenotazione, ErroreApp, leggiCorpo, promemoriaDiPassaggio } from "@/lib/prenotazioni/app";

/** Nuova prenotazione dall'app: 201 creata · 200 richiesta ripetuta · 409 orario preso ·
    422 dati non validi (campo per campo) · 429 troppe prenotazioni o richieste. */
export async function POST(request: Request) {
  const intestazioni = { "Cache-Control": "no-store" };
  try {
    controllaFrequenza(request);
    const esito = await creaPrenotazione(await leggiCorpo(request));
    promemoriaDiPassaggio();
    return Response.json({ booking: esito.booking, token: esito.token }, { status: esito.replayed ? 200 : 201, headers: intestazioni });
  } catch (e) {
    if (e instanceof ErroreApp)
      return Response.json({ error: e.codice, message: e.message, fields: e.campi }, { status: e.stato, headers: intestazioni });
    console.error("[app] prenotazione non salvata", e);
    return Response.json({ error: "server_error", message: "Non siamo riusciti a salvare la prenotazione. Riprova." }, { status: 500, headers: intestazioni });
  }
}

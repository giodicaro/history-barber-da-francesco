import { oraDiRoma } from "@/lib/orari";
import { appuntamentiDelCliente } from "@/lib/prenotazioni/archivio";
import { riepilogo } from "@/lib/prenotazioni/gestione-dati";
import { clienteDaRichiesta, cookieCliente, NO_STORE, riconoscimentoAttivo } from "@/lib/prenotazioni/riconoscimento";

/* GET /api/appuntamento/miei — il minimo per il bottone "Il mio
   appuntamento" della home: il prossimo appuntamento e quanti sono.

   La home resta statica (app/page.tsx non legge i cookie): questo stato
   arriva dopo il caricamento. Senza cookie, o con un cookie non valido,
   risponde { riconosciuto: false }, mai un errore. */

export async function GET(richiesta: Request) {
  const clienteId = clienteDaRichiesta(richiesta);
  if (!clienteId) {
    return Response.json({ attivo: riconoscimentoAttivo(), riconosciuto: false }, { headers: NO_STORE });
  }
  let elenco: Awaited<ReturnType<typeof appuntamentiDelCliente>> = [];
  try {
    elenco = await appuntamentiDelCliente(clienteId, oraDiRoma().data);
  } catch {
    // Database irraggiungibile: per il bottone basta "non so".
    return Response.json({ attivo: true, riconosciuto: false }, { headers: NO_STORE });
  }
  const prossimo = elenco.map((a) => riepilogo(a)).find((a) => a.data > oraDiRoma().data || a.fine > oraDiRoma().minuti);
  const risposta = Response.json(
    {
      attivo: true,
      riconosciuto: true,
      totale: elenco.length,
      ...(prossimo ? { prossimo: { data: prossimo.data, ora: prossimo.ora, servizio: prossimo.servizio } } : {}),
    },
    { headers: NO_STORE },
  );
  // Ogni visita rinnova i 400 giorni.
  const cookie = cookieCliente(clienteId);
  if (cookie) risposta.headers.append("Set-Cookie", cookie);
  return risposta;
}

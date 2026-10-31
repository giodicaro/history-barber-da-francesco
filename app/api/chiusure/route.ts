import { chiusureInVista, type ChiusuraPubblica } from "@/lib/chiusure";
import { oraDiRoma } from "@/lib/orari";
import { chiusureAttiveDa } from "@/lib/prenotazioni/chiusure";

/* GET /api/chiusure: le chiusure attive in corso o future, per il sito.
   Le legge il browser dopo il caricamento (la home resta statica): la notizia
   in home, i giorni spenti nel widget e nello spostamento, lo stato "Aperto
   ora". Una chiusura finita non c'è più: sparisce da sola. Solo date e
   motivo, niente di più. */

export const dynamic = "force-dynamic";

export async function GET() {
  const oggi = oraDiRoma().data;
  let chiusure: ChiusuraPubblica[] = [];
  try {
    chiusure = chiusureInVista(await chiusureAttiveDa(oggi), oggi).map(({ id, dal, al, motivo }) => ({
      id,
      dal,
      al,
      ...(motivo ? { motivo } : {}),
    }));
  } catch (e) {
    // Senza chiusure il sito funziona come prima: meglio di un errore.
    console.error("[chiusure] lettura non riuscita", e);
  }
  return Response.json(
    { oggi, chiusure },
    {
      headers: {
        // Il browser ricontrolla sempre (niente copie vecchie servite al cliente).
        "Cache-Control": "public, max-age=0, must-revalidate",
        // La rete di Vercel tiene la risposta 30 secondi: una chiusura nuova
        // arriva sul sito quasi subito, senza una lettura del database a ogni
        // visita. stale-while-revalidate solo qui: nel browser lasciava una
        // richiesta di controllo appesa.
        "CDN-Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    },
  );
}

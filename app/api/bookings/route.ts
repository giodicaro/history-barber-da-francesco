import { formatoOra, giornoDellaData, oraDiRoma } from "@/lib/orari";
import { avvisaTitolare } from "@/lib/prenotazioni/avvisi";
import { ConflittoOrario, occupatiDelGiorno, salvaPrenotazione } from "@/lib/prenotazioni/archivio";
import { generaSlot } from "@/lib/prenotazioni/slot";
import type { RispostaSlot } from "@/lib/prenotazioni/tipi";
import { analizzaRichiesta, servizioPerId, servizioPrenotabile } from "@/lib/prenotazioni/validazione";
import { listino, operatori, orari } from "@/lib/salone";

/* API delle prenotazioni.

   GET  /api/bookings?date=YYYY-MM-DD&servizio=<id>[&operatore=<id>]
        → orari proposti per quel giorno e quel servizio.
   POST /api/bookings
        → salva l'appuntamento e avvisa il titolare.

   Le Route Handler non sono in cache: ogni richiesta rilegge l'agenda. */

const primoPrenotabile = () =>
  listino.flatMap((g) => g.servizi).find(servizioPrenotabile)!;

const json = (dati: unknown, stato = 200) =>
  Response.json(dati, {
    status: stato,
    // L'agenda cambia da un minuto all'altro: nessuna cache, da nessuna parte.
    headers: { "Cache-Control": "no-store" },
  });

export async function GET(request: Request) {
  const parametri = new URL(request.url).searchParams;
  const adesso = oraDiRoma();
  const data = parametri.get("date") ?? adesso.data;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(Date.parse(`${data}T12:00:00Z`))) {
    return json({ errore: "Parametro 'date' non valido: serve YYYY-MM-DD" }, 400);
  }

  const servizio = servizioPerId(parametri.get("servizio") ?? "") ?? primoPrenotabile();
  if (!servizioPrenotabile(servizio)) {
    return json({ errore: "Servizio non prenotabile da solo" }, 400);
  }

  const operatoreId = parametri.get("operatore") ?? operatori[0].id;
  if (!operatori.some((o) => o.id === operatoreId)) {
    return json({ errore: "Operatore non riconosciuto" }, 400);
  }

  const giorno = giornoDellaData(data);
  const occupati = await occupatiDelGiorno(data, operatoreId);
  const slot = generaSlot({ data, giorno, durata: servizio.durata, occupati, adesso });

  const risposta: RispostaSlot = {
    data,
    giorno,
    giornoNome: orari[giorno].giorno,
    aperto: orari[giorno].turni.length > 0,
    servizio: { id: servizio.id, nome: servizio.nome, durata: servizio.durata, prezzo: servizio.prezzo },
    slot,
    liberi: slot.filter((s) => s.disponibile).length,
  };
  return json(risposta);
}

/* Freno agli abusi: l'endpoint è pubblico e senza login, quindi un singolo
   indirizzo IP non può riempire l'agenda a raffica. È un argine minimo, sta in
   memoria come l'archivio: con un database vero va sostituito da un limite
   serio (Vercel KV, Upstash) e da una verifica del numero via SMS. */
const RICHIESTE_MAX = 5;
const FINESTRA_MS = 10 * 60 * 1000;
const tentativi = ((globalThis as { __tentativiPrenotazione?: Map<string, number[]> })
  .__tentativiPrenotazione ??= new Map<string, number[]>());

function troppeRichieste(ip: string) {
  const adesso = Date.now();
  const recenti = (tentativi.get(ip) ?? []).filter((t) => adesso - t < FINESTRA_MS);
  tentativi.set(ip, [...recenti, adesso]);
  return recenti.length >= RICHIESTE_MAX;
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "sconosciuto";
  if (troppeRichieste(ip)) {
    return json({ errore: "Troppe prenotazioni ravvicinate. Riprova fra qualche minuto." }, 429);
  }

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return json({ errore: "Corpo della richiesta non leggibile" }, 400);
  }

  const adesso = oraDiRoma();
  const operatoreId =
    typeof (corpo as { operatoreId?: unknown })?.operatoreId === "string"
      ? (corpo as { operatoreId: string }).operatoreId
      : operatori[0].id;
  const dataRichiesta =
    typeof (corpo as { data?: unknown })?.data === "string" ? (corpo as { data: string }).data : adesso.data;
  const occupati = /^\d{4}-\d{2}-\d{2}$/.test(dataRichiesta)
    ? await occupatiDelGiorno(dataRichiesta, operatoreId)
    : [];

  const esito = analizzaRichiesta(corpo, { adesso, occupati });
  if (!esito.ok) return json({ errore: "Dati non validi", campi: esito.errori }, 400);

  try {
    const prenotazione = await salvaPrenotazione(esito.dati);
    // L'avviso non deve mai far fallire la prenotazione già salvata.
    try {
      await avvisaTitolare(prenotazione);
    } catch (e) {
      console.error("[prenotazione] avviso al titolare non riuscito", e);
    }
    return json(
      {
        ok: true,
        prenotazione: {
          id: prenotazione.id,
          data: prenotazione.data,
          ora: formatoOra(prenotazione.inizio),
          finisceAlle: formatoOra(prenotazione.fine),
          servizio: prenotazione.servizioNome,
          prezzo: prenotazione.prezzo,
        },
      },
      201,
    );
  } catch (e) {
    if (e instanceof ConflittoOrario) {
      return json({ errore: "Qualcuno ha appena preso questo orario. Scegline un altro." }, 409);
    }
    console.error("[prenotazione] salvataggio non riuscito", e);
    return json({ errore: "Non siamo riusciti a salvare la prenotazione. Riprova." }, 500);
  }
}

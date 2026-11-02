import { after } from "next/server";
import { formatoOra, giornoDellaData, oraDiRoma, turniDellaGiornata } from "@/lib/orari";
import { avvisaTitolare } from "@/lib/prenotazioni/avvisi";
import { notificaPrenotazione } from "@/lib/prenotazioni/notifiche";
import { AppuntamentoGiaAttivo, ConflittoOrario, occupatiDelGiorno, salvaPrenotazione, telefonoConAppuntamentoAttivo } from "@/lib/prenotazioni/archivio";
import { randomUUID } from "node:crypto";
import { clienteDaRichiesta, cookieCliente, origineValida, riconoscimentoAttivo } from "@/lib/prenotazioni/riconoscimento";
import { avvisoGiornoChiuso } from "@/lib/chiusure";
import { chiusuraDelGiorno } from "@/lib/prenotazioni/chiusure";
import { generaSlot } from "@/lib/prenotazioni/slot";
import type { RispostaSlot } from "@/lib/prenotazioni/tipi";
import { analizzaRichiesta, servizioPerId, servizioPrenotabile } from "@/lib/prenotazioni/validazione";
import { listino, operatori, orari } from "@/lib/salone";

/* API delle prenotazioni.

   GET  /api/bookings?date=YYYY-MM-DD&servizio=<id>[&operatore=<id>]
        → orari proposti per quel giorno e quel servizio.
   POST /api/bookings
        → salva l'appuntamento (uno solo attivo per numero, 409 altrimenti),
          avvisa il titolare e (se il cliente non ha
          spuntato "Non è il mio telefono") scrive il cookie hb_cliente che
          lo fa ritrovare in "Il mio appuntamento": vedi
          lib/prenotazioni/riconoscimento.ts.

   Le Route Handler non sono in cache: ogni richiesta rilegge l'agenda. */

/* Niente data e ora dell'appuntamento esistente: chiunque può scrivere il
   numero di un altro. */
const GIA_ATTIVO = {
  errore:
    "Risulta già un appuntamento attivo per questo numero. Puoi disdirlo da 'Gestisci il tuo appuntamento' e poi prenotare di nuovo, oppure contattare il salone.",
  codice: "gia-attivo",
};

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
  // Ferie e chiusure decise da Francesco: nessun orario quel giorno.
  const chiusura = await chiusuraDelGiorno(data);
  const occupati = chiusura ? [] : await occupatiDelGiorno(data, operatoreId);
  const slot = chiusura ? [] : generaSlot({ data, giorno, durata: servizio.durata, occupati, adesso });

  const risposta: RispostaSlot = {
    data,
    giorno,
    giornoNome: orari[giorno].giorno,
    aperto: !chiusura && turniDellaGiornata(data).length > 0,
    servizio: { id: servizio.id, nome: servizio.nome, durata: servizio.durata, prezzo: servizio.prezzo },
    slot,
    liberi: slot.filter((s) => s.disponibile).length,
    ...(chiusura ? { chiusura: { ...(chiusura.motivo ? { motivo: chiusura.motivo } : {}) } } : {}),
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
  const telefonoInviato = (corpo as { cliente?: { telefono?: unknown } })?.cliente?.telefono;
  if (typeof telefonoInviato === "string" && (await telefonoConAppuntamentoAttivo(telefonoInviato, adesso))) {
    return json(GIA_ATTIVO, 409);
  }

  const operatoreId =
    typeof (corpo as { operatoreId?: unknown })?.operatoreId === "string"
      ? (corpo as { operatoreId: string }).operatoreId
      : operatori[0].id;
  const dataRichiesta =
    typeof (corpo as { data?: unknown })?.data === "string" ? (corpo as { data: string }).data : adesso.data;
  const occupati = /^\d{4}-\d{2}-\d{2}$/.test(dataRichiesta)
    ? await occupatiDelGiorno(dataRichiesta, operatoreId)
    : [];

  // Giorno chiuso (ferie): rifiutato anche se qualcuno aggira il sito.
  const chiusura = /^\d{4}-\d{2}-\d{2}$/.test(dataRichiesta) ? await chiusuraDelGiorno(dataRichiesta) : null;
  if (chiusura) return json({ errore: avvisoGiornoChiuso(chiusura), campi: { data: avvisoGiornoChiuso(chiusura) } }, 400);

  const esito = analizzaRichiesta(corpo, { adesso, occupati });
  if (!esito.ok) return json({ errore: "Dati non validi", campi: esito.errori }, 400);

  try {
    // "Il mio appuntamento": il cliente già riconosciuto da questo browser
    // tiene il suo identificativo (tutti i suoi appuntamenti insieme), gli
    // altri ne ricevono uno nuovo. Con "Non è il mio telefono" (ricorda:
    // false) niente cookie e niente legame. Il cookie lo scrive solo il
    // server, e solo per richieste partite da questo sito.
    const ricorda = (corpo as { ricorda?: unknown })?.ricorda !== false && riconoscimentoAttivo() && origineValida(request);
    const clienteId = ricorda ? (clienteDaRichiesta(request) ?? randomUUID()) : null;
    const prenotazione = await salvaPrenotazione(esito.dati, adesso, clienteId ? { clienteId } : {});
    // L'avviso parte DOPO aver risposto al cliente: "after" tiene viva la
    // funzione quel tanto che basta, senza far aspettare chi ha prenotato.
    // Due canali in parallelo: Telegram e la notifica sul telefono di chi
    // usa l'agenda. Nessuno dei due lancia, ma la rete di sicurezza resta.
    after(async () => {
      const esiti = await Promise.allSettled([avvisaTitolare(prenotazione), notificaPrenotazione(prenotazione)]);
      for (const e of esiti) {
        if (e.status === "rejected") console.error("[prenotazione] avviso al titolare non riuscito", e.reason);
      }
    });
    const risposta = json(
      {
        ok: true,
        riconosciuto: Boolean(clienteId),
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
    const cookie = clienteId ? cookieCliente(clienteId) : null;
    if (cookie) risposta.headers.append("Set-Cookie", cookie);
    return risposta;
  } catch (e) {
    if (e instanceof AppuntamentoGiaAttivo) return json(GIA_ATTIVO, 409);
    if (e instanceof ConflittoOrario) {
      return json({ errore: "Qualcuno ha appena preso questo orario. Scegline un altro." }, 409);
    }
    console.error("[prenotazione] salvataggio non riuscito", e);
    return json({ errore: "Non siamo riusciti a salvare la prenotazione. Riprova." }, 500);
  }
}

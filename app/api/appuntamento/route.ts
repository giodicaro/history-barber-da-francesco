import { after } from "next/server";
import { oraDiRoma } from "@/lib/orari";
import { avvisaModifica, testoModifica, type ModificaCliente } from "@/lib/prenotazioni/avvisi";
import { appuntamentiDelCliente, disdiciAppuntamento } from "@/lib/prenotazioni/archivio";
import { codiceErrore } from "@/lib/prenotazioni/db";
import { nomeBreve } from "@/lib/prenotazioni/gestione";
import { leggiCredenziale, riepilogo, statoDi, trovaAppuntamento } from "@/lib/prenotazioni/gestione-dati";
import { notificaModifica } from "@/lib/prenotazioni/notifiche";
import {
  clienteDaRichiesta,
  cookieCliente,
  cookieDimentica,
  NO_STORE,
  origineValida,
  riconoscimentoAttivo,
} from "@/lib/prenotazioni/riconoscimento";
import { salone } from "@/lib/salone";

/* POST /api/appuntamento — "Il mio appuntamento".

   Corpo: { azione, credenziale? }.
   - azione "elenco": gli appuntamenti futuri del cliente riconosciuto dal
     cookie hb_cliente (v2);
   - azione "dimentica": cancella il cookie ("Dimentica questo dispositivo");
   - azioni "leggi" | "disdici" su un appuntamento:
     credenziale { prenotazioneId } con il cookie del suo cliente (v2),
     oppure { token } della v1, che vale finché il suo appuntamento non è
     passato.

   L'orario lo cambia solo il salone, dall'agenda: "orari" e "sposta" (pagine
   rimaste aperte da prima, o chiamate dirette) ricevono 403. Il server decide
   il termine da sé a ogni richiesta. Ogni POST deve arrivare da questo sito
   (Origin). Nei log niente cookie, token, codici, telefoni. */

const json = (dati: unknown, stato = 200, cookie?: string | null) => {
  const r = Response.json(dati, { status: stato, headers: NO_STORE });
  if (cookie) r.headers.append("Set-Cookie", cookie);
  return r;
};

const NON_TROVATO = {
  errore: `Non troviamo questo appuntamento. Per aiuto chiama il salone al ${salone.telefono}.`,
};

function avvisa(m: ModificaCliente, dataAgenda: string, id: string) {
  // Dopo la risposta al cliente: un avviso che non parte non deve mai far
  // fallire una disdetta.
  after(async () => {
    const titolo = `Disdetta · ${m.nome}`;
    const esiti = await Promise.allSettled([
      avvisaModifica(m),
      notificaModifica(titolo, testoModifica(m), dataAgenda, `gestione-${id}`),
    ]);
    for (const e of esiti) if (e.status === "rejected") console.error("[gestione] avviso non riuscito");
  });
}

export async function POST(request: Request) {
  if (!origineValida(request)) return json({ errore: "Richiesta non valida." }, 403);
  let corpo: Record<string, unknown>;
  try {
    corpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ errore: "Richiesta non leggibile." }, 400);
  }
  const azione = String(corpo?.azione ?? "");
  const clienteId = clienteDaRichiesta(request);
  // Ogni uso rinnova il cookie: 400 giorni dall'ultima visita.
  const rinnovo = clienteId ? cookieCliente(clienteId) : null;

  if (azione === "dimentica") return json({ ok: true }, 200, cookieDimentica());

  if (azione === "elenco") {
    if (!riconoscimentoAttivo()) return json({ attivo: false, riconosciuto: false });
    if (!clienteId) return json({ attivo: true, riconosciuto: false });
    const elenco = await appuntamentiDelCliente(clienteId, oraDiRoma().data);
    return json({ attivo: true, riconosciuto: true, appuntamenti: elenco.map((a) => riepilogo(a)) }, 200, rinnovo);
  }

  if (azione === "orari" || azione === "sposta") {
    return json({ errore: `Per cambiare orario contatta il salone al ${salone.telefono}.` }, 403);
  }

  const credenziale = leggiCredenziale(corpo?.credenziale);
  if (!credenziale || !["leggi", "disdici"].includes(azione)) {
    return json({ errore: "Richiesta non valida." }, 400);
  }
  // v2: l'appartenenza al cliente si controlla nello SQL (id + cliente_id).
  const proprietario = "prenotazioneId" in credenziale ? clienteId : null;

  let a;
  try {
    a = await trovaAppuntamento(credenziale, proprietario);
  } catch (e) {
    console.error("[gestione] lettura non riuscita", codiceErrore(e));
    return json({ errore: "Non riusciamo a leggere l'appuntamento. Riprova fra poco." }, 500);
  }
  if (!a) return json(NON_TROVATO, 404);

  if (azione === "leggi") return json({ appuntamento: riepilogo(a) }, 200, rinnovo);

  const stato = statoDi(a);
  if (!stato.disdicibile) return json({ errore: "Ormai è tardi per disdire online: chiama il salone.", motivoBlocco: stato.motivoBlocco }, 403);
  const tolto = await disdiciAppuntamento(a.id, proprietario);
  if (!tolto) return json({ errore: "Questo appuntamento non c'è più." }, 404);
  avvisa(
    { tipo: "disdetta", nome: nomeBreve(tolto.cliente.nome), data: tolto.data, inizio: tolto.inizio, servizio: tolto.servizioNome },
    tolto.data,
    tolto.id,
  );
  return json({ ok: true, disdetto: { data: tolto.data, ora: riepilogo(tolto).ora, servizio: tolto.servizioNome } }, 200, rinnovo);
}

import { after } from "next/server";
import { minutiDaOra, oraDiRoma } from "@/lib/orari";
import { avvisaModifica, testoModifica, type ModificaCliente } from "@/lib/prenotazioni/avvisi";
import {
  appuntamentiDelCliente,
  ConflittoOrario,
  disdiciAppuntamento,
  passkeyDelCliente,
  spostaAppuntamento,
} from "@/lib/prenotazioni/archivio";
import { codiceErrore } from "@/lib/prenotazioni/db";
import { nomeBreve } from "@/lib/prenotazioni/gestione";
import {
  dataSpostabile,
  leggiCredenziale,
  orariPerSpostamento,
  prossimiGiorniLiberi,
  riepilogo,
  statoDi,
  trovaAppuntamento,
} from "@/lib/prenotazioni/gestione-dati";
import { notificaModifica } from "@/lib/prenotazioni/notifiche";
import {
  clienteDaRichiesta,
  cookieCliente,
  cookieDimentica,
  freno,
  NO_STORE,
  origineValida,
  riconoscimentoAttivo,
} from "@/lib/prenotazioni/riconoscimento";
import { salone, SPOSTAMENTI_MAX } from "@/lib/salone";

/* POST /api/appuntamento — "Il mio appuntamento".

   Corpo: { azione, credenziale?, data?, ora? }.
   - azione "elenco": gli appuntamenti futuri del cliente riconosciuto dal
     cookie hb_cliente (v2);
   - azione "dimentica": cancella il cookie ("Dimentica questo dispositivo");
   - azioni "leggi" | "orari" | "sposta" | "disdici" su un appuntamento:
     credenziale { prenotazioneId } con il cookie del suo cliente (v2),
     oppure { token } / { telefono, codice } della v1, che valgono finché i
     loro appuntamenti non sono passati.

   Il server decide tutto da sé a ogni richiesta (termine, limite, orari) e
   sull'orario l'ultima parola è del vincolo del database. Ogni POST deve
   arrivare da questo sito (Origin). Nei log niente cookie, token, codici,
   telefoni. */

const json = (dati: unknown, stato = 200, cookie?: string | null) => {
  const r = Response.json(dati, { status: stato, headers: NO_STORE });
  if (cookie) r.headers.append("Set-Cookie", cookie);
  return r;
};

const NON_TROVATO = {
  errore: `Non troviamo questo appuntamento. Per aiuto chiama il salone al ${salone.telefono}.`,
};

// v1: tentativi con telefono + codice. Un argine per istanza (bible §11).
const troppiTentativi = freno("gestione-codice", 10, 10 * 60 * 1000);

function avvisa(m: ModificaCliente, dataAgenda: string, id: string) {
  // Dopo la risposta al cliente: un avviso che non parte non deve mai far
  // fallire una disdetta o uno spostamento.
  after(async () => {
    const titolo = m.tipo === "disdetta" ? `Disdetta · ${m.nome}` : `Spostato · ${m.nome}`;
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
    const [elenco, passkey] = await Promise.all([appuntamentiDelCliente(clienteId, oraDiRoma().data), passkeyDelCliente(clienteId)]);
    return json({ attivo: true, riconosciuto: true, appuntamenti: elenco.map((a) => riepilogo(a)), conFaceId: passkey.length > 0 }, 200, rinnovo);
  }

  const credenziale = leggiCredenziale(corpo?.credenziale);
  if (!credenziale || !["leggi", "orari", "sposta", "disdici"].includes(azione)) {
    return json({ errore: "Richiesta non valida." }, 400);
  }
  if ("telefono" in credenziale && troppiTentativi(request)) {
    return json({ errore: "Troppi tentativi. Riprova fra qualche minuto o chiama il salone." }, 429);
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

  const stato = statoDi(a);

  if (azione === "leggi") return json({ appuntamento: riepilogo(a) }, 200, rinnovo);

  if (azione === "orari") {
    const data = String(corpo.data ?? "");
    if (!stato.spostabile) return json({ errore: "Questo appuntamento non si può più spostare online.", motivoBlocco: stato.motivoBlocco }, 403);
    if (!dataSpostabile(data)) return json({ errore: "Giorno non valido." }, 400);
    const orari = await orariPerSpostamento(a, data);
    return json({ ...orari, ...(orari.liberi === 0 ? { prossimiGiorni: await prossimiGiorniLiberi(a, data) } : {}) });
  }

  if (azione === "disdici") {
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

  // ── sposta ──
  if (!stato.spostabile) {
    return json({ errore: "Questo appuntamento non si può più spostare online: chiama il salone.", motivoBlocco: stato.motivoBlocco }, 403);
  }
  const data = String(corpo.data ?? "");
  const ora = String(corpo.ora ?? "");
  if (!dataSpostabile(data) || !/^\d{2}:\d{2}$/.test(ora)) return json({ errore: "Giorno o orario non valido." }, 400);

  const conAlternative = async () =>
    json(
      {
        errore: "Spiacenti, l'orario scelto non è più disponibile.",
        alternative: await orariPerSpostamento(a, data),
        prossimiGiorni: await prossimiGiorniLiberi(a, data),
      },
      409,
    );

  const proposti = await orariPerSpostamento(a, data);
  const scelto = proposti.slot.find((s) => s.ora === ora);
  if (!scelto) return json({ errore: "Orario fuori dagli orari di apertura." }, 400);
  const inizio = minutiDaOra(ora);
  if (data === a.data && inizio === a.inizio) return json({ errore: "È già il tuo orario." }, 400);
  if (!scelto.disponibile) {
    if (scelto.motivo === "occupato") return conAlternative();
    return json({ errore: "Questo orario non si può prenotare." }, 400);
  }

  let nuovo;
  try {
    nuovo = await spostaAppuntamento(a.id, { data, inizio, fine: inizio + (a.fine - a.inizio) }, SPOSTAMENTI_MAX, proprietario);
  } catch (e) {
    if (e instanceof ConflittoOrario) return conAlternative();
    console.error("[gestione] spostamento non riuscito", codiceErrore(e));
    return json({ errore: "Non siamo riusciti a spostare l'appuntamento. Riprova." }, 500);
  }
  if (!nuovo) {
    // Fra la lettura e la scrittura: o è stato disdetto, o il limite è
    // stato raggiunto da un'altra scheda.
    const ancora = await trovaAppuntamento(credenziale, proprietario);
    return ancora
      ? json({ errore: "Hai già usato tutti gli spostamenti: chiama il salone.", motivoBlocco: "spostamenti" }, 403)
      : json({ errore: "Questo appuntamento non c'è più." }, 404);
  }
  avvisa(
    { tipo: "spostamento", nome: nomeBreve(nuovo.cliente.nome), da: { data: a.data, inizio: a.inizio }, a: { data: nuovo.data, inizio: nuovo.inizio } },
    nuovo.data,
    nuovo.id,
  );
  return json({ appuntamento: riepilogo(nuovo), da: { data: a.data, ora: riepilogo(a).ora } }, 200, rinnovo);
}

import { after } from "next/server";
import { minutiDaOra } from "@/lib/orari";
import { avvisaModifica, testoModifica, type ModificaCliente } from "@/lib/prenotazioni/avvisi";
import { ConflittoOrario, disdiciAppuntamento, spostaAppuntamento } from "@/lib/prenotazioni/archivio";
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
import { codiceErrore } from "@/lib/prenotazioni/db";
import { salone, SPOSTAMENTI_MAX } from "@/lib/salone";

/* POST /api/appuntamento — "Gestisci il tuo appuntamento".

   Un solo POST, anche per leggere: le credenziali (token del link, oppure
   telefono + codice) non devono stare in un indirizzo, che finisce nei log
   e nella cronologia. Corpo: { azione, credenziale, data?, ora? }.

   azione: "leggi" | "orari" | "sposta" | "disdici".

   Il server decide tutto da sé a ogni richiesta (termine, limite di
   spostamenti, orari proponibili) e sull'orario l'ultima parola è del
   vincolo del database. Token, codice e telefono non vanno mai nei log. */

const json = (dati: unknown, stato = 200) =>
  Response.json(dati, { status: stato, headers: { "Cache-Control": "no-store" } });

const NON_TROVATO = {
  errore: `Non troviamo un appuntamento con questi dati. Controlla il codice, oppure chiama il salone al ${salone.telefono}.`,
};

/* Freno ai tentativi con telefono + codice: 10 ogni 10 minuti per IP, in
   memoria come quello di /api/bookings. È un argine (ogni istanza di
   Vercel ha il suo contatore): 887 milioni di codici per numero restano
   comunque fuori portata a mano. */
const TENTATIVI_MAX = 10;
const FINESTRA_MS = 10 * 60 * 1000;
const tentativi = ((globalThis as { __tentativiGestione?: Map<string, number[]> }).__tentativiGestione ??= new Map());

function troppiTentativi(ip: string) {
  const adesso = Date.now();
  const recenti = (tentativi.get(ip) ?? []).filter((t: number) => adesso - t < FINESTRA_MS);
  tentativi.set(ip, [...recenti, adesso]);
  return recenti.length >= TENTATIVI_MAX;
}

function avvisa(m: ModificaCliente, dataAgenda: string, id: string) {
  // Dopo la risposta al cliente, come per le prenotazioni: un avviso che non
  // parte non deve mai far fallire una disdetta o uno spostamento.
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
  let corpo: Record<string, unknown>;
  try {
    corpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ errore: "Richiesta non leggibile." }, 400);
  }
  const azione = corpo?.azione;
  const credenziale = leggiCredenziale(corpo?.credenziale);
  if (!credenziale || !["leggi", "orari", "sposta", "disdici"].includes(String(azione))) {
    return json({ errore: "Richiesta non valida." }, 400);
  }

  if ("telefono" in credenziale) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "sconosciuto";
    if (troppiTentativi(ip)) return json({ errore: "Troppi tentativi. Riprova fra qualche minuto o chiama il salone." }, 429);
  }

  let a;
  try {
    a = await trovaAppuntamento(credenziale);
  } catch (e) {
    console.error("[gestione] lettura non riuscita", codiceErrore(e));
    return json({ errore: "Non riusciamo a leggere l'appuntamento. Riprova fra poco." }, 500);
  }
  if (!a) return json(NON_TROVATO, 404);

  const stato = statoDi(a);

  if (azione === "leggi") return json({ appuntamento: riepilogo(a) });

  if (azione === "orari") {
    const data = String(corpo.data ?? "");
    if (!stato.spostabile) return json({ errore: "Questo appuntamento non si può più spostare online.", motivoBlocco: stato.motivoBlocco }, 403);
    if (!dataSpostabile(data)) return json({ errore: "Giorno non valido." }, 400);
    const orari = await orariPerSpostamento(a, data);
    return json({ ...orari, ...(orari.liberi === 0 ? { prossimiGiorni: await prossimiGiorniLiberi(a, data) } : {}) });
  }

  if (azione === "disdici") {
    if (!stato.disdicibile) return json({ errore: "Ormai è tardi per disdire online: chiama il salone.", motivoBlocco: stato.motivoBlocco }, 403);
    const tolto = await disdiciAppuntamento(a.id);
    if (!tolto) return json({ errore: "Questo appuntamento non c'è più." }, 404);
    avvisa(
      { tipo: "disdetta", nome: nomeBreve(tolto.cliente.nome), data: tolto.data, inizio: tolto.inizio, servizio: tolto.servizioNome },
      tolto.data,
      tolto.id,
    );
    return json({ ok: true, disdetto: { data: tolto.data, ora: riepilogo(tolto).ora, servizio: tolto.servizioNome } });
  }

  // ── sposta ──
  if (!stato.spostabile) {
    return json({ errore: "Questo appuntamento non si può più spostare online: chiama il salone.", motivoBlocco: stato.motivoBlocco }, 403);
  }
  const data = String(corpo.data ?? "");
  const ora = String(corpo.ora ?? "");
  if (!dataSpostabile(data) || !/^\d{2}:\d{2}$/.test(ora)) return json({ errore: "Giorno o orario non valido." }, 400);

  const conAlternative = async () => {
    const alternative = await orariPerSpostamento(a, data);
    return json(
      {
        errore: "Spiacenti, l'orario scelto non è più disponibile.",
        alternative,
        prossimiGiorni: await prossimiGiorniLiberi(a, data),
      },
      409,
    );
  };

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
    nuovo = await spostaAppuntamento(a.id, { data, inizio, fine: inizio + (a.fine - a.inizio) }, SPOSTAMENTI_MAX);
  } catch (e) {
    if (e instanceof ConflittoOrario) return conAlternative();
    console.error("[gestione] spostamento non riuscito", codiceErrore(e));
    return json({ errore: "Non siamo riusciti a spostare l'appuntamento. Riprova." }, 500);
  }
  if (!nuovo) {
    // Fra la lettura e la scrittura: o è stato disdetto, o il limite è
    // stato raggiunto da un'altra scheda.
    const ancora = await trovaAppuntamento(credenziale);
    return ancora
      ? json({ errore: "Hai già usato tutti gli spostamenti: chiama il salone.", motivoBlocco: "spostamenti" }, 403)
      : json({ errore: "Questo appuntamento non c'è più." }, 404);
  }
  avvisa(
    { tipo: "spostamento", nome: nomeBreve(nuovo.cliente.nome), da: { data: a.data, inizio: a.inizio }, a: { data: nuovo.data, inizio: nuovo.inizio } },
    nuovo.data,
    nuovo.id,
  );
  return json({ appuntamento: riepilogo(nuovo), da: { data: a.data, ora: riepilogo(a).ora } });
}

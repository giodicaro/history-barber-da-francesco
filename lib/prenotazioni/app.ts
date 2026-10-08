import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { costruisciDatiApp } from "@/lib/app-dati";
import { configAccesso } from "@/lib/auth-config";
import { festivitaDellAnno } from "@/lib/festivi";
import { festivitaChiusa, formatoOra, giornoDellaData, minutiDaOra, oraDiRoma, sommaGiorni } from "@/lib/orari";
import {
  CHIUSO_NEI_FESTIVI,
  GIORNI_PRENOTABILI,
  LISTINO_CONFERMATO,
  MODIFICABILE_FINO_A_MINUTI,
  PREAVVISO_MINUTI,
  PRENOTAZIONI_ATTIVE_MAX,
  listino,
  operatori,
  orari,
  salone,
} from "@/lib/salone";
import { avvisaTitolare, avvisaTitolareConTesto } from "./avvisi";
import { conVincolo, ConflittoOrario, voce } from "./archivio";
import { codiceErrore, db } from "./db";
import { inviaAIscrizioni, inviaATutti, notificaPrenotazione, type Iscrizione, type RigaIscrizione } from "./notifiche";
import { generaSlot, PASSO, type Intervallo } from "./slot";
import { normalizzaTelefono } from "./telefono";
import type { Prenotazione } from "./tipi";
import { servizioPerId, servizioPrenotabile } from "./validazione";

/* L'app dei clienti (PWA in /app) sopra la stessa agenda di Francesco.

   Tutto passa dalla tabella `prenotazioni`: un appuntamento preso dall'app
   compare subito nell'agenda (origine "app"), un blocco o un appuntamento
   inserito da Francesco toglie l'orario all'app, e il vincolo di esclusione
   del database resta l'unico arbitro delle sovrapposizioni.

   In più rispetto al widget del sito:
   - il cliente riceve un link segreto per spostare o disdire da solo
     (fino a MODIFICABILE_FINO_A_MINUTI prima), e Francesco ne è avvisato;
   - i promemoria push 24 ore e 2 ore prima, per chi li attiva;
   - una richiesta ripetuta (coda offline) non crea doppioni. */

export const ANY = "any";
const MINUTO = 60_000;
const ORIGINE = "app";

export class ErroreApp extends Error {
  constructor(
    public stato: number,
    public codice: string,
    messaggio: string,
    public campi?: Record<string, string>,
  ) {
    super(messaggio);
  }
}

const occupato = () => new ErroreApp(409, "slot_taken", "Questo orario non è più disponibile. Scegline un altro.");

/* ── Ora di Roma → istante ──────────────────────────────────────────────── */

const formatoRoma = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Rome",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function scartoRoma(istante: number): number {
  const p = Object.fromEntries(formatoRoma.formatToParts(new Date(istante)).map((x) => [x.type, Number(x.value)]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - (istante - (istante % 1000));
}

/** Giornata + minuti a Roma → istante UTC in ms. Corregge lo scarto se fra la
    stima e il risultato cade il cambio dell'ora legale. */
export function istanteRoma(data: string, minuti: number): number {
  const [a, m, g] = data.split("-").map(Number);
  const ingenuo = Date.UTC(a, m - 1, g) + minuti * MINUTO;
  const primo = scartoRoma(ingenuo);
  let utc = ingenuo - primo;
  const secondo = scartoRoma(utc);
  if (secondo !== primo) utc = ingenuo - secondo;
  return utc;
}

/* ── Link segreto del cliente ───────────────────────────────────────────── */

// HMAC dell'id: si verifica senza salvarlo, e una richiesta ripetuta dalla
// coda offline riceve lo stesso token. Chiave: BOOKING_SECRET se c'è,
// altrimenti AUTH_SECRET (già presente per l'agenda).
let segretoDiRiserva: string | undefined;
function segreto(): string {
  const config = configAccesso();
  const s = process.env.BOOKING_SECRET?.trim() || (config.ok ? config.segreto : undefined);
  if (s) return s;
  if (!segretoDiRiserva) {
    segretoDiRiserva = randomBytes(32).toString("base64url");
    console.warn("[app] né BOOKING_SECRET né AUTH_SECRET: i link dei clienti valgono fino al riavvio");
  }
  return segretoDiRiserva;
}

export const tokenPer = (id: string) => createHmac("sha256", segreto()).update(`app-booking:${id}`).digest("base64url");

function tokenValido(id: string, token: unknown) {
  const atteso = Buffer.from(tokenPer(id));
  const dato = Buffer.from(typeof token === "string" ? token : "");
  return dato.length === atteso.length && timingSafeEqual(dato, atteso);
}

/* ── Dati del salone per l'app ──────────────────────────────────────────── */

/** Festività di chiusura da oggi a fine anno prossimo. */
function chiusure(oggi: string): string[] {
  if (!CHIUSO_NEI_FESTIVI) return [];
  const anno = Number(oggi.slice(0, 4));
  return [anno, anno + 1].flatMap((a) => [...festivitaDellAnno(a).keys()]).filter((d) => d >= oggi).sort();
}

export function datiApp() {
  return costruisciDatiApp({
    salone,
    orari,
    listino,
    operatori,
    preavvisoMinuti: PREAVVISO_MINUTI,
    giorniPrenotabili: GIORNI_PRENOTABILI,
    passoMinuti: PASSO,
    modificabileFinoAMinuti: MODIFICABILE_FINO_A_MINUTI,
    prenotazioniAttiveMax: PRENOTAZIONI_ATTIVE_MAX,
    listinoConfermato: LISTINO_CONFERMATO,
    chiusure: chiusure(oraDiRoma().data),
  });
}

/* ── Orari liberi ───────────────────────────────────────────────────────── */

type Occupazione = Intervallo & { id: string; operatoreId: string; data: string };

async function occupazioni(da: string, a: string): Promise<Occupazione[]> {
  const righe = await (await db()).query<{ id: string; operatore_id: string; data: string; inizio: number; fine: number }>(
    `select id, operatore_id, to_char(data, 'YYYY-MM-DD') as data, inizio, fine
     from prenotazioni where data between $1::date and $2::date`,
    [da, a],
  );
  return righe.map((r) => ({ id: r.id, operatoreId: r.operatore_id, data: r.data, inizio: r.inizio, fine: r.fine }));
}

function servizioValido(id: unknown) {
  const s = typeof id === "string" ? servizioPerId(id) : undefined;
  if (!s || !servizioPrenotabile(s)) throw new ErroreApp(422, "invalid_service", "Servizio non valido.");
  return s;
}

function operatoreValido(id: unknown): string {
  const v = typeof id === "string" && id ? id : ANY;
  if (v !== ANY && !operatori.some((o) => o.id === v)) throw new ErroreApp(422, "invalid_barber", "Barbiere non valido.");
  return v;
}

const finestra = () => {
  const oggi = oraDiRoma().data;
  return { oggi, ultimo: sommaGiorni(oggi, GIORNI_PRENOTABILI) };
};

function dataValida(data: unknown): string {
  const d = typeof data === "string" ? data : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(`${d}T12:00:00Z`)))
    throw new ErroreApp(422, "invalid_date", "Data non valida.");
  return d;
}

export interface SlotApp {
  time: string;
  startUtc: number;
  endUtc: number;
  barberIds: string[];
}

/** Orari liberi di un giorno; `escludi` ignora un appuntamento (quando lo si sposta). */
function slotDelGiorno(data: string, durata: number, operatore: string, occ: Occupazione[], escludi?: string): SlotApp[] {
  const { oggi, ultimo } = finestra();
  if (data < oggi || data > ultimo || festivitaChiusa(data)) return [];
  const adesso = oraDiRoma();
  const candidati = operatore === ANY ? operatori.map((o) => o.id) : [operatore];
  const liberi = new Map<string, string[]>();
  for (const id of candidati) {
    const occupati = occ.filter((o) => o.data === data && o.operatoreId === id && o.id !== escludi);
    for (const s of generaSlot({ data, giorno: giornoDellaData(data), durata, occupati, adesso })) {
      if (s.disponibile) liberi.set(s.ora, [...(liberi.get(s.ora) ?? []), id]);
    }
  }
  return [...liberi.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, barberIds]) => {
      const startUtc = istanteRoma(data, minutiDaOra(time));
      return { time, startUtc, endUtc: startUtc + durata * MINUTO, barberIds };
    });
}

export async function disponibilita(q: { date: unknown; service: unknown; barber: unknown }) {
  const servizio = servizioValido(q.service);
  const operatore = operatoreValido(q.barber);
  const data = dataValida(q.date);
  return slotDelGiorno(data, servizio.durata, operatore, await occupazioni(data, data));
}

export async function giorni(q: { service: unknown; barber: unknown }) {
  const servizio = servizioValido(q.service);
  const operatore = operatoreValido(q.barber);
  const { oggi, ultimo } = finestra();
  const occ = await occupazioni(oggi, ultimo);
  return Array.from({ length: GIORNI_PRENOTABILI + 1 }, (_, i) => {
    const data = sommaGiorni(oggi, i);
    const chiuso = orari[giornoDellaData(data)].turni.length === 0 || Boolean(festivitaChiusa(data));
    return { date: data, closed: chiuso, available: chiuso ? 0 : slotDelGiorno(data, servizio.durata, operatore, occ).length };
  });
}

/* ── Prenotazioni ───────────────────────────────────────────────────────── */

type RigaApp = {
  id: string;
  tipo: string;
  data: string;
  inizio: number;
  fine: number;
  operatore_id: string;
  servizio_id: string | null;
  servizio_nome: string | null;
  cliente_nome: string | null;
  cliente_telefono: string | null;
  note: string | null;
  creata_il: Date;
};

const COLONNE = `id, tipo, to_char(data, 'YYYY-MM-DD') as data, inizio, fine, operatore_id,
  servizio_id, servizio_nome, cliente_nome, cliente_telefono, note, creata_il`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function riga(id: string): Promise<RigaApp | null> {
  if (!UUID.test(id)) return null;
  const [r] = await (await db()).query<RigaApp>(`select ${COLONNE} from prenotazioni where id = $1`, [id]);
  return r ?? null;
}

const limiteModifica = (r: RigaApp) => istanteRoma(r.data, r.inizio) - MODIFICABILE_FINO_A_MINUTI * MINUTO;

/** Vista per il cliente: quello che ha inserito, più se può ancora modificare. */
export function presenta(r: RigaApp, stato: "confirmed" | "cancelled" = "confirmed") {
  const startUtc = istanteRoma(r.data, r.inizio);
  const modifyUntil = limiteModifica(r);
  return {
    id: r.id,
    barberId: r.operatore_id,
    serviceId: r.servizio_id ?? "",
    serviceName: r.servizio_nome ?? "",
    startUtc,
    endUtc: startUtc + (r.fine - r.inizio) * MINUTO,
    name: r.cliente_nome ?? "",
    phone: r.cliente_telefono ?? "",
    notes: r.note ?? "",
    status: stato,
    canModify: stato === "confirmed" && Date.now() < modifyUntil,
    modifyUntil,
  };
}

/** Appuntamento del cliente, solo con il token giusto. Stessa risposta per
    "non esiste" e "token sbagliato": niente tentativi a indovinare gli id. */
export async function prenotazioneAutorizzata(id: string, token: unknown): Promise<RigaApp> {
  const r = await riga(id);
  if (!r || r.tipo !== "appuntamento" || !tokenValido(id, token))
    throw new ErroreApp(404, "not_found", "Prenotazione non trovata: forse è stata disdetta.");
  return r;
}

const testo = (v: unknown, max: number) =>
  (typeof v === "string" ? v : "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

function analizzaCliente(corpo: Record<string, unknown>) {
  const campi: Record<string, string> = {};
  const nome = testo(corpo.name, 60);
  const telefonoGrezzo = testo(corpo.phone, 30);
  const telefono = normalizzaTelefono(telefonoGrezzo);
  const note = testo(corpo.notes, 280);
  if (nome.length < 2) campi.name = "Scrivi nome e cognome (almeno 2 caratteri).";
  if (!telefonoGrezzo) campi.phone = "Serve un numero di telefono.";
  else if (!telefono) campi.phone = "Numero non valido: cellulare o fisso italiano, es. 348 123 4567.";
  if (corpo.privacy !== true) campi.privacy = "Per prenotare devi accettare l'informativa privacy.";
  if (Object.keys(campi).length || !telefono) throw new ErroreApp(422, "invalid_input", "Controlla i dati inseriti.", campi);
  return { nome, telefono, note };
}

const quando = (data: string, inizio: number) =>
  `${new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${data}T12:00:00Z`))} alle ${formatoOra(inizio)}`;

export async function creaPrenotazione(corpo: Record<string, unknown>) {
  const richiestaId = typeof corpo.clientRequestId === "string" && /^[\w-]{16,64}$/.test(corpo.clientRequestId) ? corpo.clientRequestId : null;
  const giaCreata = async () => {
    if (!richiestaId) return null;
    const [r] = await (await db()).query<RigaApp>(`select ${COLONNE} from prenotazioni where richiesta_id = $1`, [richiestaId]);
    return r ?? null;
  };
  // La coda offline può rimandare una richiesta già arrivata: stessa risposta.
  const ripetuta = await giaCreata();
  if (ripetuta) return { booking: presenta(ripetuta), token: tokenPer(ripetuta.id), replayed: true };

  const servizio = servizioValido(corpo.serviceId);
  const operatoreChiesto = operatoreValido(corpo.barberId);
  const cliente = analizzaCliente(corpo);
  const data = dataValida(corpo.date);
  const ora = typeof corpo.time === "string" && /^\d{2}:\d{2}$/.test(corpo.time) ? corpo.time : "";
  if (!ora) throw new ErroreApp(422, "invalid_time", "Orario non valido.");

  const occ = await occupazioni(data, data);
  const slot = slotDelGiorno(data, servizio.durata, operatoreChiesto, occ).find((s) => s.time === ora);
  if (!slot) throw occupato();
  // "Primo disponibile": il meno carico del giorno, a parità il primo in elenco.
  const carico = (id: string) => occ.filter((o) => o.data === data && o.operatoreId === id).length;
  const operatoreId = operatoreChiesto === ANY ? [...slot.barberIds].sort((a, b) => carico(a) - carico(b))[0] : operatoreChiesto;

  const adesso = oraDiRoma();
  const [{ n }] = await (await db()).query<{ n: number }>(
    `select count(*)::int as n from prenotazioni
     where tipo = 'appuntamento' and cliente_telefono = $1
       and (data > $2::date or (data = $2::date and fine > $3))`,
    [cliente.telefono, adesso.data, adesso.minuti],
  );
  if (n >= PRENOTAZIONI_ATTIVE_MAX)
    throw new ErroreApp(429, "too_many_active", `Hai già ${PRENOTAZIONI_ATTIVE_MAX} prenotazioni attive: disdicine una o chiama il salone.`);

  const inizio = minutiDaOra(ora);
  let creata: RigaApp;
  try {
    [creata] = await conVincolo(async () =>
      (await db()).query<RigaApp>(
        `insert into prenotazioni (tipo, data, inizio, fine, servizio_id, servizio_nome, prezzo,
           operatore_id, cliente_nome, cliente_telefono, note, origine, richiesta_id)
         values ('appuntamento', $1::date, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         returning ${COLONNE}`,
        [data, inizio, inizio + servizio.durata, servizio.id, servizio.nome, servizio.prezzo, operatoreId,
          cliente.nome, cliente.telefono, cliente.note || null, ORIGINE, richiestaId],
      ),
    );
  } catch (e) {
    if (e instanceof ConflittoOrario) throw occupato();
    // Due copie della stessa richiesta arrivate insieme: vince la prima.
    if (codiceErrore(e) === "23505") {
      const prima = await giaCreata();
      if (prima) return { booking: presenta(prima), token: tokenPer(prima.id), replayed: true };
    }
    throw e;
  }

  // Avvisi a Francesco dopo la risposta al cliente, come per il widget.
  after(async () => {
    const p = (await voce(creata.id)) as Prenotazione | null;
    if (!p) return;
    await Promise.allSettled([avvisaTitolare(p), notificaPrenotazione(p)]);
  });
  return { booking: presenta(creata), token: tokenPer(creata.id), replayed: false };
}

function primaDelLimite(r: RigaApp) {
  if (Date.now() >= limiteModifica(r))
    throw new ErroreApp(
      403,
      "cutoff_passed",
      `Mancano meno di ${MODIFICABILE_FINO_A_MINUTI / 60} ore all'appuntamento: per modificarlo chiama il salone al ${salone.telefono}.`,
    );
}

/** Avviso a Francesco per una modifica fatta dal cliente. Non lancia. */
function avvisaModifica(titolo: string, righe: string[], data: string) {
  after(async () => {
    await Promise.allSettled([
      avvisaTitolareConTesto([`${titolo} — ${salone.nomeCompleto}`, ...righe].join("\n")),
      inviaATutti({ titolo, testo: righe.join("\n"), url: `/admin?data=${data}` }),
    ]);
  });
}

export async function disdici(id: string, token: unknown) {
  const r = await prenotazioneAutorizzata(id, token);
  primaDelLimite(r);
  // Disdire = liberare la poltrona: la riga sparisce dall'agenda.
  await (await db()).query(`delete from prenotazioni where id = $1`, [id]);
  avvisaModifica(`Disdetta dall'app · ${r.cliente_nome}`, [`${r.servizio_nome}, ${quando(r.data, r.inizio)}`, `Tel. ${r.cliente_telefono ?? "—"}`], r.data);
  return presenta(r, "cancelled");
}

export async function sposta(id: string, token: unknown, corpo: Record<string, unknown>) {
  const r = await prenotazioneAutorizzata(id, token);
  primaDelLimite(r);
  const data = dataValida(corpo.date);
  const ora = typeof corpo.time === "string" ? corpo.time : "";
  const durata = r.fine - r.inizio;
  const slot = slotDelGiorno(data, durata, r.operatore_id, await occupazioni(data, data), id).find((s) => s.time === ora);
  if (!slot) throw occupato();
  const inizio = minutiDaOra(ora);
  let aggiornata: RigaApp;
  try {
    [aggiornata] = await conVincolo(async () =>
      (await db()).query<RigaApp>(
        `update prenotazioni set data = $2::date, inizio = $3, fine = $4, modificata_il = now(),
           promemoria_24h_il = null, promemoria_2h_il = null
         where id = $1 returning ${COLONNE}`,
        [id, data, inizio, inizio + durata],
      ),
    );
  } catch (e) {
    if (e instanceof ConflittoOrario) throw occupato();
    throw e;
  }
  avvisaModifica(
    `Spostata dall'app · ${r.cliente_nome}`,
    [`${r.servizio_nome}`, `Prima: ${quando(r.data, r.inizio)}`, `Ora: ${quando(data, inizio)}`, `Tel. ${r.cliente_telefono ?? "—"}`],
    data,
  );
  return presenta(aggiornata);
}

/* ── Promemoria ai clienti ──────────────────────────────────────────────── */

export async function salvaIscrizioneCliente(i: Iscrizione, vecchioEndpoint?: string) {
  const q = await db();
  await q.query(
    `insert into iscrizioni_clienti (endpoint, p256dh, auth) values ($1, $2, $3)
     on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth`,
    [i.endpoint, i.keys.p256dh, i.keys.auth],
  );
  if (vecchioEndpoint && vecchioEndpoint !== i.endpoint) {
    // pushsubscriptionchange: i promemoria passano al nuovo indirizzo.
    await q.query(
      `insert into promemoria_iscrizioni (prenotazione_id, endpoint)
       select prenotazione_id, $1 from promemoria_iscrizioni where endpoint = $2
       on conflict do nothing`,
      [i.endpoint, vecchioEndpoint],
    );
    await q.query(`delete from iscrizioni_clienti where endpoint = $1`, [vecchioEndpoint]);
  }
}

export async function collegaPromemoria(prenotazioneId: string, endpoint: string) {
  await (await db()).query(
    `insert into promemoria_iscrizioni (prenotazione_id, endpoint) values ($1, $2) on conflict do nothing`,
    [prenotazioneId, endpoint],
  );
}

export async function togliIscrizioneCliente(endpoint: string) {
  await (await db()).query(`delete from iscrizioni_clienti where endpoint = $1`, [endpoint]);
}

const ORA = 60 * MINUTO;

/**
 * Manda i promemoria dovuti: 24 ore e 2 ore prima. Ogni promemoria prima si
 * "prenota" con un update condizionato (così due esecuzioni in parallelo non
 * mandano doppioni), poi parte. Un promemoria la cui finestra era già aperta
 * quando il cliente ha prenotato non si manda (niente "domani" a chi ha
 * appena prenotato per domani mattina).
 */
export async function inviaPromemoriaDovuti(adesso = Date.now()) {
  const q = await db();
  const oggi = oraDiRoma(new Date(adesso)).data;
  const candidati = await q.query<RigaApp & { promemoria_24h_il: Date | null; promemoria_2h_il: Date | null }>(
    `select ${COLONNE}, promemoria_24h_il, promemoria_2h_il from prenotazioni p
     where tipo = 'appuntamento' and data between $1::date and $2::date
       and (promemoria_24h_il is null or promemoria_2h_il is null)
       and exists (select 1 from promemoria_iscrizioni l where l.prenotazione_id = p.id)`,
    [oggi, sommaGiorni(oggi, 2)],
  );
  let inviati = 0;
  for (const r of candidati) {
    const inizio = istanteRoma(r.data, r.inizio);
    const creata = new Date(r.creata_il).getTime();
    for (const [tipo, anticipo, colonna] of [["24h", 24 * ORA, "promemoria_24h_il"], ["2h", 2 * ORA, "promemoria_2h_il"]] as const) {
      if (r[colonna] || adesso < inizio - anticipo || adesso >= inizio) continue;
      const [preso] = await q.query<{ id: string }>(
        `update prenotazioni set ${colonna} = now() where id = $1 and ${colonna} is null returning id`,
        [r.id],
      );
      if (!preso) continue;
      const fuoriTempo = creata > inizio - anticipo || (tipo === "24h" && inizio - adesso <= 2 * ORA);
      if (fuoriTempo) continue;
      const iscritti = await q.query<RigaIscrizione>(
        `select i.endpoint, i.p256dh, i.auth from iscrizioni_clienti i
         join promemoria_iscrizioni l on l.endpoint = i.endpoint where l.prenotazione_id = $1`,
        [r.id],
      );
      const esito = await inviaAIscrizioni(
        iscritti,
        {
          title: `${tipo === "24h" ? "Domani" : "Tra 2 ore"}: ${r.servizio_nome} alle ${formatoOra(r.inizio)}`,
          body: `${salone.nome}, ${salone.via}. Per spostare o disdire apri l'app.`,
          url: `index.html#gestisci/${r.id}/${tokenPer(r.id)}`,
          tag: `promemoria-${r.id}-${tipo}`,
        },
        togliIscrizioneCliente,
        2 * ORA,
      );
      inviati += esito.inviate;
    }
  }
  // Pulizia: telefoni senza più appuntamenti collegati da oltre 30 giorni.
  await q.query(
    `delete from iscrizioni_clienti i where creata_il < now() - interval '30 days'
     and not exists (select 1 from promemoria_iscrizioni l where l.endpoint = i.endpoint)`,
  );
  return { candidati: candidati.length, inviati };
}

// Senza un cron frequente (il piano gratuito di Vercel ne concede uno al
// giorno) i promemoria partono anche "di passaggio": al massimo ogni 5
// minuti per istanza, dopo la risposta a una richiesta dell'app.
const stato = globalThis as { __ultimiPromemoria?: number };
export function promemoriaDiPassaggio() {
  const adesso = Date.now();
  if (adesso - (stato.__ultimiPromemoria ?? 0) < 5 * MINUTO) return;
  stato.__ultimiPromemoria = adesso;
  after(() => inviaPromemoriaDovuti().catch((e) => console.error("[promemoria] non riusciti", e)));
}

/* ── Freno agli abusi ───────────────────────────────────────────────────── */

const scritture = ((globalThis as { __scrittureApp?: Map<string, number[]> }).__scrittureApp ??= new Map());

// Alzabile solo per le prove automatiche (tests/app/e2e.mjs), che scrivono
// molte volte dallo stesso indirizzo.
const SCRITTURE_MAX = Number(process.env.APP_LIMITE_SCRITTURE ?? 20);

/** Al massimo SCRITTURE_MAX scritture ogni 10 minuti per indirizzo IP (per istanza). */
export function controllaFrequenza(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "sconosciuto";
  const adesso = Date.now();
  const recenti = (scritture.get(ip) ?? []).filter((t: number) => adesso - t < 10 * MINUTO);
  scritture.set(ip, [...recenti, adesso]);
  if (recenti.length >= SCRITTURE_MAX) throw new ErroreApp(429, "rate_limited", "Troppe richieste. Riprova tra qualche minuto.");
}

/* ── Risposte ───────────────────────────────────────────────────────────── */

export async function rispondi(fn: () => Promise<unknown>, stato = 200): Promise<Response> {
  const intestazioni = { "Cache-Control": "no-store" };
  try {
    const corpo = await fn();
    return Response.json(corpo, { status: stato, headers: intestazioni });
  } catch (e) {
    if (e instanceof ErroreApp)
      return Response.json({ error: e.codice, message: e.message, fields: e.campi }, { status: e.stato, headers: intestazioni });
    console.error("[app] errore", e);
    return Response.json({ error: "server_error", message: "Errore del server. Riprova." }, { status: 500, headers: intestazioni });
  }
}

export async function leggiCorpo(request: Request): Promise<Record<string, unknown>> {
  try {
    const corpo = await request.json();
    return typeof corpo === "object" && corpo !== null ? corpo : {};
  } catch {
    throw new ErroreApp(400, "bad_request", "Richiesta non valida.");
  }
}

import "server-only";
import { randomBytes } from "node:crypto";
import { codiceErrore, db } from "@/lib/prenotazioni/db";
import { CONSERVAZIONE_LOOKBOOK_MESI } from "@/lib/salone";
import type { ClienteLookbook, Look, NoteLook, Posizione, RigaElenco, StileCliente, TipoImmagine } from "./tipi";
import { TOKEN, UUID } from "./validazione";

/* Archivio del Lookbook personale: schede dei clienti, look, foto.

   Solo SQL, uguale per i tre motori di lib/prenotazioni/db.ts (Postgres,
   PGlite su file, PGlite in memoria). Lo schema sta in db/schema.ts.

   Due regole che valgono per tutto il file:
   - le foto si leggono solo dalle due funzioni dedicate (fotoPerBarbiere,
     fotoPerCliente): gli elenchi non toccano mai i byte;
   - il cliente arriva solo con il suo token, e ogni query "da cliente"
     controlla nello SQL che il dato appartenga a quel token. */

/** Le tabelle del lookbook non ci sono: sul Postgres di produzione lo schema
    nuovo non è ancora stato applicato (npm run db:init). */
export class LookbookNonPronto extends Error {
  constructor() {
    super("Tabelle del lookbook assenti");
    this.name = "LookbookNonPronto";
  }
}

export class SchedaNonTrovata extends Error {
  constructor() {
    super("Scheda non trovata");
    this.name = "SchedaNonTrovata";
  }
}

/** Esiste già una scheda con questo telefono: si apre quella. */
export class TelefonoGiaPresente extends Error {
  constructor(readonly idEsistente: string) {
    super("Telefono già presente");
    this.name = "TelefonoGiaPresente";
  }
}

const TABELLA_ASSENTE = "42P01";
const VALORE_DUPLICATO = "23505";

async function interroga<T>(testo: string, parametri: unknown[] = []): Promise<T[]> {
  try {
    return await (await db()).query<T>(testo, parametri);
  } catch (e) {
    if (codiceErrore(e) === TABELLA_ASSENTE) throw new LookbookNonPronto();
    throw e;
  }
}

/** Un token d'accesso nuovo: 32 byte casuali, in base64url (43 caratteri). */
const nuovoToken = () => randomBytes(32).toString("base64url");

/* PGlite restituisce un bytea come Uint8Array, postgres.js come Buffer: un
   solo punto in cui diventano la stessa cosa. */
function inBuffer(v: unknown): Buffer {
  if (Buffer.isBuffer(v)) return v;
  if (v instanceof Uint8Array) return Buffer.from(v.buffer, v.byteOffset, v.byteLength);
  throw new TypeError("Colonna bytea in un formato inatteso");
}

/* ── Schede ─────────────────────────────────────────────────────────────── */

type RigaCliente = {
  id: string;
  nome: string;
  telefono: string | null;
  token: string;
  consenso_il: Date | string;
  creato_il: Date | string;
};

const daRigaCliente = (r: RigaCliente): ClienteLookbook => ({
  id: r.id,
  nome: r.nome,
  ...(r.telefono ? { telefono: r.telefono } : {}),
  token: r.token,
  consensoIl: new Date(r.consenso_il).toISOString(),
  creatoIl: new Date(r.creato_il).toISOString(),
});

/** Elenco per il barbiere: chi ha visto di recente in cima. `cerca` filtra
    per nome o per cifre del telefono. */
export async function elencoSchede(cerca = ""): Promise<RigaElenco[]> {
  const parola = cerca.trim().slice(0, 80).replace(/[\\%_]/g, "\\$&");
  const cifre = cerca.replace(/\D/g, "");
  const righe = await interroga<{
    id: string;
    nome: string;
    telefono: string | null;
    looks: number;
    ultimo: string | null;
    copertina: string | null;
  }>(
    `select c.id, c.nome, c.telefono,
       (select count(*)::int from look l where l.cliente_id = c.id) as looks,
       u.data as ultimo, u.copertina
     from clienti_lookbook c
     left join lateral (
       select to_char(l.data, 'YYYY-MM-DD') as data, l.creato_il,
         (select f.id from look_foto f where f.look_id = l.id
          order by array_position(array['dietro', 'profilo', 'davanti'], f.posizione) limit 1) as copertina
       from look l where l.cliente_id = c.id
       order by l.data desc, l.creato_il desc limit 1
     ) u on true
     where $1 = '' or c.nome ilike '%' || $1 || '%' or (length($2) >= 3 and c.telefono like '%' || $2 || '%')
     order by coalesce(u.creato_il, c.creato_il) desc
     limit 200`,
    [parola, cifre],
  );
  return righe.map((r) => ({
    id: r.id,
    nome: r.nome,
    ...(r.telefono ? { telefono: r.telefono } : {}),
    looks: r.looks,
    ...(r.ultimo ? { ultimo: r.ultimo } : {}),
    ...(r.copertina ? { copertina: r.copertina } : {}),
  }));
}

export async function scheda(id: string): Promise<ClienteLookbook | null> {
  if (!UUID.test(id)) return null;
  const [r] = await interroga<RigaCliente>(
    `select id, nome, telefono, token, consenso_il, creato_il from clienti_lookbook where id = $1`,
    [id],
  );
  return r ? daRigaCliente(r) : null;
}

/** Id della scheda con questo telefono (già normalizzato), se c'è. */
export async function schedaPerTelefono(telefono: string): Promise<string | null> {
  const [r] = await interroga<{ id: string }>(`select id from clienti_lookbook where telefono = $1`, [telefono]);
  return r?.id ?? null;
}

/** Crea la scheda con il consenso registrato adesso. */
export async function creaScheda(nome: string, telefono: string | null): Promise<string> {
  try {
    const [r] = await interroga<{ id: string }>(
      `insert into clienti_lookbook (nome, telefono, token, consenso_il) values ($1, $2, $3, now()) returning id`,
      [nome, telefono, nuovoToken()],
    );
    return r.id;
  } catch (e) {
    // Due schede per lo stesso numero no: si apre quella che c'è. Il vincolo
    // unico decide anche fra due tocchi simultanei.
    if (codiceErrore(e) === VALORE_DUPLICATO && telefono) {
      const esistente = await schedaPerTelefono(telefono);
      if (esistente) throw new TelefonoGiaPresente(esistente);
    }
    throw e;
  }
}

/** Cancella la scheda: look e foto cadono a cascata. */
export async function eliminaScheda(id: string): Promise<boolean> {
  if (!UUID.test(id)) return false;
  return (await interroga(`delete from clienti_lookbook where id = $1 returning id`, [id])).length > 0;
}

/** Nuovo link per il cliente: il vecchio smette subito di funzionare. */
export async function rigeneraToken(id: string): Promise<boolean> {
  if (!UUID.test(id)) return false;
  return (
    (await interroga(`update clienti_lookbook set token = $2 where id = $1 returning id`, [id, nuovoToken()])).length > 0
  );
}

/* ── Look ───────────────────────────────────────────────────────────────── */

type RigaLook = {
  id: string;
  data: string;
  sfumatura: string | null;
  sopra: string | null;
  barba: string | null;
  prodotto: string | null;
  note: string | null;
  preferito: boolean;
  foto: { id: string; posizione: Posizione }[] | string;
};

const daRigaLook = (r: RigaLook): Look => ({
  id: r.id,
  data: r.data,
  preferito: r.preferito,
  ...(r.sfumatura ? { sfumatura: r.sfumatura } : {}),
  ...(r.sopra ? { sopra: r.sopra } : {}),
  ...(r.barba ? { barba: r.barba } : {}),
  ...(r.prodotto ? { prodotto: r.prodotto } : {}),
  ...(r.note ? { note: r.note } : {}),
  // json_agg arriva già come array da entrambi i driver; il ramo stringa è
  // una cintura di sicurezza se un domani un driver non lo convertisse.
  foto: typeof r.foto === "string" ? JSON.parse(r.foto) : r.foto,
});

/* La data si legge come testo (vedi lib/prenotazioni/archivio.ts), le foto
   solo come id e posizione, nell'ordine di scatto. */
const SELEZIONE_LOOK = `select l.id, to_char(l.data, 'YYYY-MM-DD') as data,
  l.sfumatura, l.sopra, l.barba, l.prodotto, l.note, l.preferito,
  coalesce((
    select json_agg(json_build_object('id', f.id, 'posizione', f.posizione)
                    order by array_position(array['dietro', 'profilo', 'davanti'], f.posizione))
    from look_foto f where f.look_id = l.id
  ), '[]'::json) as foto
from look l`;

/** Tutti i look di un cliente, dal più recente. */
export async function looksDelCliente(clienteId: string): Promise<Look[]> {
  if (!UUID.test(clienteId)) return [];
  const righe = await interroga<RigaLook>(
    `${SELEZIONE_LOOK} where l.cliente_id = $1 order by l.data desc, l.creato_il desc`,
    [clienteId],
  );
  return righe.map(daRigaLook);
}

export interface FotoInArrivo {
  posizione: Posizione;
  tipo: TipoImmagine;
  dati: Buffer;
  miniatura: Buffer;
}

/** Salva un look con le sue foto in una sola istruzione: o tutto, o niente.
    L'id lo sceglie il browser: se la risposta al primo invio si perde per
    strada e Francesco tocca "Riprova", il secondo invio trova il look già
    salvato e non lo duplica.
    Restituisce l'id del look, o null se la scheda non esiste più. */
export async function salvaLook(dati: {
  id: string;
  clienteId: string;
  operatoreId: string;
  data: string;
  note: NoteLook;
  preferito: boolean;
  foto: FotoInArrivo[];
}): Promise<string | null> {
  if (!UUID.test(dati.id) || !UUID.test(dati.clienteId) || dati.foto.length === 0) return null;
  const parametri: unknown[] = [
    dati.id,
    dati.clienteId,
    dati.operatoreId,
    dati.data,
    dati.note.sfumatura ?? null,
    dati.note.sopra ?? null,
    dati.note.barba ?? null,
    dati.note.prodotto ?? null,
    dati.note.note ?? null,
    dati.preferito,
  ];
  const valori = dati.foto.map((f) => {
    const base = parametri.length;
    parametri.push(f.posizione, f.tipo, f.dati, f.miniatura);
    return `($${base + 1}, $${base + 2}, $${base + 3}::bytea, $${base + 4}::bytea)`;
  });
  // Una CTE: l'insert del look e quelli delle foto sono un'unica istruzione,
  // quindi atomica anche senza transazione esplicita (db() non ne offre).
  // "select … where exists" fa sì che una scheda appena cancellata non lasci
  // un look orfano: il riferimento fallirebbe comunque, così però non lancia.
  const righe = await interroga<{ id: string }>(
    `with nuovo as (
       insert into look (id, cliente_id, operatore_id, data, sfumatura, sopra, barba, prodotto, note, preferito)
       select $1, $2, $3, $4::date, $5, $6, $7, $8, $9, $10
       where exists (select 1 from clienti_lookbook where id = $2)
       on conflict (id) do nothing
       returning id
     ), foto as (
       insert into look_foto (look_id, posizione, tipo, dati, miniatura)
       select nuovo.id, v.posizione, v.tipo, v.dati, v.miniatura
       from nuovo, (values ${valori.join(", ")}) as v (posizione, tipo, dati, miniatura)
       returning look_id
     )
     select id from nuovo where exists (select 1 from foto)`,
    parametri,
  );
  if (righe[0]) return righe[0].id;
  // Niente inserito: o la scheda non c'è più, o questo look era già arrivato.
  const [gia] = await interroga<{ id: string }>(`select id from look where id = $1 and cliente_id = $2`, [
    dati.id,
    dati.clienteId,
  ]);
  return gia?.id ?? null;
}

/** Un errore da scrivere nei log senza dati personali: niente `detail`, che
    in Postgres riporta i valori della riga rifiutata. */
export const perLog = (e: unknown) => ({
  codice: codiceErrore(e),
  messaggio: e instanceof Error ? e.message : String(e),
});

export async function eliminaLook(id: string): Promise<boolean> {
  if (!UUID.test(id)) return false;
  return (await interroga(`delete from look where id = $1 returning id`, [id])).length > 0;
}

/** Preferito dal lato barbiere. */
export async function segnaPreferito(lookId: string, preferito: boolean): Promise<boolean> {
  if (!UUID.test(lookId)) return false;
  return (await interroga(`update look set preferito = $2 where id = $1 returning id`, [lookId, preferito])).length > 0;
}

/* ── Lato cliente: sempre attraverso il token ───────────────────────────── */

/** Il cliente del token, con i suoi look. Null se il token non vale. */
export async function stileDelToken(token: string): Promise<(StileCliente & { telefono?: string }) | null> {
  if (!TOKEN.test(token)) return null;
  const [c] = await interroga<{ id: string; nome: string; telefono: string | null }>(
    `select id, nome, telefono from clienti_lookbook where token = $1`,
    [token],
  );
  if (!c) return null;
  return { nome: c.nome, looks: await looksDelCliente(c.id), ...(c.telefono ? { telefono: c.telefono } : {}) };
}

/** Il nome del cliente del token, per il manifest. */
export async function nomeDelToken(token: string): Promise<string | null> {
  if (!TOKEN.test(token)) return null;
  const [c] = await interroga<{ nome: string }>(`select nome from clienti_lookbook where token = $1`, [token]);
  return c?.nome ?? null;
}

/** Preferito dal lato cliente: il look deve essere suo. */
export async function segnaPreferitoDelToken(token: string, lookId: string, preferito: boolean): Promise<boolean> {
  if (!TOKEN.test(token) || !UUID.test(lookId)) return false;
  const righe = await interroga(
    `update look set preferito = $3
     from clienti_lookbook c
     where look.id = $2 and look.cliente_id = c.id and c.token = $1
     returning look.id`,
    [token, lookId, preferito],
  );
  return righe.length > 0;
}

/* ── Foto ───────────────────────────────────────────────────────────────── */

export type Versione = "mini" | "full";
export interface Immagine {
  tipo: TipoImmagine;
  byte: Buffer;
}

// Il nome della colonna viene da qui e non dalla richiesta.
const COLONNA: Record<Versione, string> = { mini: "miniatura", full: "dati" };

export async function fotoPerBarbiere(id: string, versione: Versione): Promise<Immagine | null> {
  if (!UUID.test(id)) return null;
  const [r] = await interroga<{ tipo: TipoImmagine; byte: unknown }>(
    `select tipo, ${COLONNA[versione]} as byte from look_foto where id = $1`,
    [id],
  );
  return r ? { tipo: r.tipo, byte: inBuffer(r.byte) } : null;
}

/** La foto solo se appartiene a un look del cliente di quel token: il
    controllo è nella join, non nel browser. */
export async function fotoPerCliente(token: string, id: string, versione: Versione): Promise<Immagine | null> {
  if (!TOKEN.test(token) || !UUID.test(id)) return null;
  const [r] = await interroga<{ tipo: TipoImmagine; byte: unknown }>(
    `select f.tipo, f.${COLONNA[versione]} as byte
     from look_foto f
     join look l on l.id = f.look_id
     join clienti_lookbook c on c.id = l.cliente_id
     where f.id = $2 and c.token = $1`,
    [token, id],
  );
  return r ? { tipo: r.tipo, byte: inBuffer(r.byte) } : null;
}

/* ── Pulizia ────────────────────────────────────────────────────────────── */

let ultimaPulizia: string | undefined;

/** Cancella le schede il cui ultimo look (o, senza look, la creazione) è più
    vecchio di CONSERVAZIONE_LOOKBOOK_MESI. Foto e note cadono a cascata.
    Stesso schema di eliminaScadute: una volta al giorno per istanza, non
    lancia mai, nei log solo il numero. */
export async function eliminaLookbookScaduti(oggi: string): Promise<void> {
  if (ultimaPulizia === oggi) return;
  ultimaPulizia = oggi;
  try {
    const righe = await interroga<{ id: string }>(
      `delete from clienti_lookbook c
       where coalesce((select max(l.data) from look l where l.cliente_id = c.id), c.creato_il::date)
             < $1::date - make_interval(months => $2)
       returning c.id`,
      [oggi, CONSERVAZIONE_LOOKBOOK_MESI],
    );
    if (righe.length > 0) console.info(`[lookbook] cancellate ${righe.length} schede oltre il periodo di conservazione`);
  } catch (e) {
    ultimaPulizia = undefined;
    if (!(e instanceof LookbookNonPronto)) console.error("[lookbook] pulizia delle schede scadute non riuscita", perLog(e));
  }
}

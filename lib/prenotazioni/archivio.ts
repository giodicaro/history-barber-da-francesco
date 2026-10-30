import "server-only";
import { CONSERVAZIONE_MESI } from "@/lib/salone";
import { codiceErrore, db, tipoArchivio, VIOLAZIONE_ESCLUSIONE } from "./db";
import type { Intervallo } from "./slot";
import type { NuovaVoce, Prenotazione, RichiestaPrenotazione, VoceAgenda } from "./tipi";

/* Archivio dell'agenda: appuntamenti e blocchi, nella tabella `prenotazioni`.

   Il motore (Postgres, PGlite su file, PGlite in memoria) lo sceglie ./db.ts;
   qui c'è solo SQL, uguale per tutti. Lo schema sta in `db/schema.ts`.

   Nessun controllo "prima leggo, poi scrivo" sulle sovrapposizioni: a
   decidere è il vincolo di esclusione del database, l'unico punto in cui due
   richieste simultanee non possono passare tutte e due. */

export class ConflittoOrario extends Error {
  constructor() {
    super("Orario già occupato");
    this.name = "ConflittoOrario";
  }
}

export class VoceNonTrovata extends Error {
  constructor() {
    super("Appuntamento non trovato");
    this.name = "VoceNonTrovata";
  }
}

export { tipoArchivio };

type Riga = {
  id: string;
  tipo: "appuntamento" | "blocco";
  data: string;
  inizio: number;
  fine: number;
  servizio_id: string | null;
  servizio_nome: string | null;
  prezzo: number;
  operatore_id: string;
  cliente_nome: string | null;
  cliente_telefono: string | null;
  note: string | null;
  origine: string | null;
  creata_il: Date;
};

/* La colonna "data" si legge come testo, non come oggetto data: un `date`
   convertito in Date diventa mezzanotte locale e, riportato a ISO in UTC,
   scivolerebbe al giorno prima per chi sta a est di Greenwich. */
const COLONNE = `id, tipo, to_char(data, 'YYYY-MM-DD') as data, inizio, fine,
  servizio_id, servizio_nome, prezzo, operatore_id,
  cliente_nome, cliente_telefono, note, origine, creata_il`;

function daRiga(r: Riga): VoceAgenda {
  const comuni = {
    id: r.id,
    data: r.data,
    inizio: r.inizio,
    fine: r.fine,
    operatoreId: r.operatore_id,
    creataIl: new Date(r.creata_il).toISOString(),
  };
  if (r.tipo === "blocco") {
    return { tipo: "blocco", ...comuni, ...(r.note ? { motivo: r.note } : {}) };
  }
  return {
    tipo: "appuntamento",
    ...comuni,
    servizioId: r.servizio_id ?? "",
    servizioNome: r.servizio_nome ?? "",
    prezzo: r.prezzo,
    cliente: {
      nome: r.cliente_nome ?? "",
      ...(r.cliente_telefono ? { telefono: r.cliente_telefono } : {}),
      ...(r.note ? { note: r.note } : {}),
    },
    ...(r.origine ? { origine: r.origine } : {}),
  };
}

// Da oggetto a colonne, nello stesso ordine per insert e update.
function colonne(v: NuovaVoce) {
  const appuntamento = v.tipo === "appuntamento";
  return [
    v.tipo,
    v.data,
    v.inizio,
    v.fine,
    appuntamento ? v.servizioId : null,
    appuntamento ? v.servizioNome : null,
    appuntamento ? v.prezzo : 0,
    v.operatoreId,
    appuntamento ? v.cliente.nome : null,
    appuntamento ? (v.cliente.telefono ?? null) : null,
    appuntamento ? (v.cliente.note ?? null) : (v.motivo ?? null),
    appuntamento ? (v.origine ?? null) : "agenda",
  ];
}

// Traduce la violazione del vincolo nell'errore che l'interfaccia sa spiegare.
async function conVincolo<T>(operazione: () => Promise<T>): Promise<T> {
  try {
    return await operazione();
  } catch (e) {
    if (codiceErrore(e) === VIOLAZIONE_ESCLUSIONE) throw new ConflittoOrario();
    throw e;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ── Lettura ────────────────────────────────────────────────────────────── */

/** Appuntamenti e blocchi di un giorno, in ordine di orario. */
export async function vociDelGiorno(data: string): Promise<VoceAgenda[]> {
  const righe = await (await db()).query<Riga>(
    `select ${COLONNE} from prenotazioni where data = $1::date order by inizio`,
    [data],
  );
  return righe.map(daRiga);
}

/** Intervalli occupati di un operatore in un giorno, blocchi compresi: il
    sito non propone né un orario preso né uno bloccato. */
export async function occupatiDelGiorno(data: string, operatoreId: string): Promise<Intervallo[]> {
  return (await (await db()).query<Intervallo>(
    `select inizio, fine from prenotazioni
     where data = $1::date and operatore_id = $2
     order by inizio`,
    [data, operatoreId],
  )).map(({ inizio, fine }) => ({ inizio, fine }));
}

/* ── Scrittura ──────────────────────────────────────────────────────────── */

export async function creaVoce(voce: NuovaVoce): Promise<VoceAgenda> {
  return conVincolo(async () => {
    const [riga] = await (await db()).query<Riga>(
      `insert into prenotazioni (
         tipo, data, inizio, fine, servizio_id, servizio_nome, prezzo,
         operatore_id, cliente_nome, cliente_telefono, note, origine
       ) values ($1, $2::date, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       returning ${COLONNE}`,
      colonne(voce),
    );
    return daRiga(riga);
  });
}

/** Prenotazione arrivata dal sito. Con `clienteId` (v2, "Il mio
    appuntamento") si lega al cliente riconosciuto dal cookie; le impronte di
    link e codice erano della v1 e oggi non si generano più. */
export async function salvaPrenotazione(
  richiesta: RichiestaPrenotazione,
  extra: { gestioneHash?: string; codiceHash?: string; clienteId?: string } = {},
): Promise<Prenotazione> {
  return conVincolo(async () => {
    const [riga] = await (await db()).query<Riga>(
      `insert into prenotazioni (
         tipo, data, inizio, fine, servizio_id, servizio_nome, prezzo,
         operatore_id, cliente_nome, cliente_telefono, note, origine,
         gestione_hash, codice_hash, cliente_id
       ) values ($1, $2::date, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::uuid)
       returning ${COLONNE}`,
      [
        ...colonne({ tipo: "appuntamento", ...richiesta }),
        extra.gestioneHash ?? null,
        extra.codiceHash ?? null,
        extra.clienteId ?? null,
      ],
    );
    return daRiga(riga) as Prenotazione;
  });
}

/** Riscrive una voce. Il vincolo ignora la riga stessa: spostare un
    appuntamento di un quarto d'ora sopra il suo vecchio orario è lecito. */
export async function aggiornaVoce(id: string, voce: NuovaVoce): Promise<VoceAgenda> {
  if (!UUID.test(id)) throw new VoceNonTrovata();
  return conVincolo(async () => {
    const [riga] = await (await db()).query<Riga>(
      `update prenotazioni set
         tipo = $2, data = $3::date, inizio = $4, fine = $5,
         servizio_id = $6, servizio_nome = $7, prezzo = $8, operatore_id = $9,
         cliente_nome = $10, cliente_telefono = $11, note = $12,
         origine = coalesce(origine, $13), modificata_il = now()
       where id = $1
       returning ${COLONNE}`,
      [id, ...colonne(voce)],
    );
    if (!riga) throw new VoceNonTrovata();
    return daRiga(riga);
  });
}

/** Cancella una voce: appuntamento annullato o blocco tolto. */
export async function eliminaVoce(id: string): Promise<void> {
  if (!UUID.test(id)) throw new VoceNonTrovata();
  const righe = await (await db()).query<{ id: string }>(
    `delete from prenotazioni where id = $1 returning id`,
    [id],
  );
  if (righe.length === 0) throw new VoceNonTrovata();
}

// Giorno dell'ultima pulizia, per farla una volta al giorno per istanza e non
// a ogni apertura dell'agenda.
let ultimaPulizia: string | undefined;

/** Cancella appuntamenti e blocchi più vecchi del periodo di conservazione
    dichiarato nell'informativa privacy (/privacy). Non lancia mai: è una
    pulizia di fondo, e se fallisce riprova alla prossima apertura. */
export async function eliminaScadute(oggi: string): Promise<void> {
  if (ultimaPulizia === oggi) return;
  ultimaPulizia = oggi;
  try {
    const righe = await (await db()).query<{ id: string }>(
      `delete from prenotazioni where data < $1::date - make_interval(months => $2) returning id`,
      [oggi, CONSERVAZIONE_MESI],
    );
    if (righe.length > 0) console.info(`[agenda] cancellate ${righe.length} voci oltre il periodo di conservazione`);
    // "Il mio appuntamento": accessi monouso scaduti o senza più appuntamento,
    // e Face ID / impronta di clienti senza più prenotazioni in archivio e
    // non usati da CONSERVAZIONE_MESI.
    await (await db()).query(
      `delete from accessi_monouso a
       where a.scade_il < now() or not exists (select 1 from prenotazioni p where p.id = a.prenotazione_id)`,
    );
    await (await db()).query(
      `delete from passkey_clienti k
       where not exists (select 1 from prenotazioni p where p.cliente_id = k.cliente_id)
         and coalesce(k.usata_il, k.creata_il) < $1::date - make_interval(months => $2)`,
      [oggi, CONSERVAZIONE_MESI],
    );
  } catch (e) {
    ultimaPulizia = undefined;
    console.error("[agenda] pulizia dei dati scaduti non riuscita", e);
  }
}

/** Una voce sola, per rileggere lo stato prima di modificarla. */
export async function voce(id: string): Promise<VoceAgenda | null> {
  if (!UUID.test(id)) return null;
  const [riga] = await (await db()).query<Riga>(`select ${COLONNE} from prenotazioni where id = $1`, [id]);
  return riga ? daRiga(riga) : null;
}

/* ── Gestione dell'appuntamento da parte del cliente ─────────────────────
   Si entra solo per impronta (del token o del codice+telefono), e sempre
   con tipo = 'appuntamento': dal link di un cliente non si legge né si
   tocca un blocco o l'appuntamento di un altro. */

export type AppuntamentoGestito = Prenotazione & { spostamenti: number };

const COLONNE_GESTIONE = `${COLONNE}, spostamenti`;
const daRigaGestita = (r: Riga & { spostamenti: number }): AppuntamentoGestito => ({
  ...(daRiga(r) as Prenotazione),
  spostamenti: r.spostamenti,
});

export async function appuntamentoDelToken(gestioneHash: string): Promise<AppuntamentoGestito | null> {
  const [r] = await (await db()).query<Riga & { spostamenti: number }>(
    `select ${COLONNE_GESTIONE} from prenotazioni where gestione_hash = $1 and tipo = 'appuntamento'`,
    [gestioneHash],
  );
  return r ? daRigaGestita(r) : null;
}

/** Con telefono + codice si trovano solo gli appuntamenti da oggi in poi. */
export async function appuntamentoDelCodice(codiceHash: string, oggi: string): Promise<AppuntamentoGestito | null> {
  const [r] = await (await db()).query<Riga & { spostamenti: number }>(
    `select ${COLONNE_GESTIONE} from prenotazioni
     where codice_hash = $1 and tipo = 'appuntamento' and data >= $2::date
     order by data, inizio limit 1`,
    [codiceHash, oggi],
  );
  return r ? daRigaGestita(r) : null;
}

/** Occupati di un giorno con il loro id: spostando, si toglie sé stessi. */
export async function occupatiConId(data: string, operatoreId: string): Promise<(Intervallo & { id: string })[]> {
  return (await (await db()).query<Intervallo & { id: string }>(
    `select id, inizio, fine from prenotazioni where data = $1::date and operatore_id = $2 order by inizio`,
    [data, operatoreId],
  )).map(({ id, inizio, fine }) => ({ id, inizio, fine }));
}

/** Sposta l'appuntamento. Il limite di spostamenti è nella condizione
    stessa dell'update (niente "prima leggo, poi scrivo"), e sull'orario
    decide il vincolo di esclusione: ConflittoOrario se è appena stato preso.
    Restituisce null se l'appuntamento non c'è più o il limite è raggiunto. */
export async function spostaAppuntamento(
  id: string,
  nuovo: { data: string; inizio: number; fine: number },
  spostamentiMax: number,
  /** v2: l'appuntamento deve essere di questo cliente (controllo nello SQL). */
  clienteId: string | null = null,
): Promise<AppuntamentoGestito | null> {
  if (!UUID.test(id)) return null;
  return conVincolo(async () => {
    const [r] = await (await db()).query<Riga & { spostamenti: number }>(
      `update prenotazioni set
         data = $2::date, inizio = $3, fine = $4,
         spostamenti = spostamenti + 1, modificata_il = now()
       where id = $1 and tipo = 'appuntamento' and spostamenti < $5
         and ($6::uuid is null or cliente_id = $6::uuid)
       returning ${COLONNE_GESTIONE}`,
      [id, nuovo.data, nuovo.inizio, nuovo.fine, spostamentiMax, clienteId],
    );
    return r ? daRigaGestita(r) : null;
  });
}

/** Disdetta = la riga si cancella, come fa l'agenda: lo slot torna libero
    subito. I dati per l'avviso a Francesco tornano dalla stessa query. */
export async function disdiciAppuntamento(id: string, clienteId: string | null = null): Promise<AppuntamentoGestito | null> {
  if (!UUID.test(id)) return null;
  const [r] = await (await db()).query<Riga & { spostamenti: number }>(
    `delete from prenotazioni
     where id = $1 and tipo = 'appuntamento' and ($2::uuid is null or cliente_id = $2::uuid)
     returning ${COLONNE_GESTIONE}`,
    [id, clienteId],
  );
  return r ? daRigaGestita(r) : null;
}

/* ── "Il mio appuntamento" (v2): il cliente riconosciuto dal cookie ───────
   Ogni lettura e scrittura filtra per id **e** cliente_id **e** tipo:
   l'appartenenza si decide nello SQL. */

/** Gli appuntamenti del cliente da oggi in poi, in ordine di data. */
export async function appuntamentiDelCliente(clienteId: string, oggi: string): Promise<AppuntamentoGestito[]> {
  if (!UUID.test(clienteId)) return [];
  const righe = await (await db()).query<Riga & { spostamenti: number }>(
    `select ${COLONNE_GESTIONE} from prenotazioni
     where cliente_id = $1::uuid and tipo = 'appuntamento' and data >= $2::date
     order by data, inizio`,
    [clienteId, oggi],
  );
  return righe.map(daRigaGestita);
}

export async function appuntamentoDelCliente(id: string, clienteId: string): Promise<AppuntamentoGestito | null> {
  if (!UUID.test(id) || !UUID.test(clienteId)) return null;
  const [r] = await (await db()).query<Riga & { spostamenti: number }>(
    `select ${COLONNE_GESTIONE} from prenotazioni where id = $1 and cliente_id = $2::uuid and tipo = 'appuntamento'`,
    [id, clienteId],
  );
  return r ? daRigaGestita(r) : null;
}

/* ── Face ID / impronta (passkey) ──────────────────────────────────────── */

export interface PasskeyCliente {
  idCredenziale: string;
  chiavePubblica: Uint8Array<ArrayBuffer>;
  contatore: number;
  trasporti: string[];
  clienteId: string;
}

export async function passkeyPerId(idCredenziale: string): Promise<PasskeyCliente | null> {
  const [r] = await (await db()).query<{ id_credenziale: string; chiave_pubblica: unknown; contatore: string | number; trasporti: string | null; cliente_id: string }>(
    `select id_credenziale, chiave_pubblica, contatore, trasporti, cliente_id from passkey_clienti where id_credenziale = $1`,
    [idCredenziale.slice(0, 1024)],
  );
  if (!r) return null;
  const byte = r.chiave_pubblica as Uint8Array;
  return {
    idCredenziale: r.id_credenziale,
    // PGlite dà Uint8Array, postgres.js Buffer: per la libreria vanno bene entrambi.
    chiavePubblica: new Uint8Array(byte),
    contatore: Number(r.contatore),
    trasporti: r.trasporti ? r.trasporti.split(",") : [],
    clienteId: r.cliente_id,
  };
}

/** L'id utente già usato dal cliente (così le sue passkey stanno insieme), se c'è. */
export async function idUtenteDelCliente(clienteId: string): Promise<string | null> {
  const [r] = await (await db()).query<{ id_utente: string }>(
    `select id_utente from passkey_clienti where cliente_id = $1::uuid limit 1`,
    [clienteId],
  );
  return r?.id_utente ?? null;
}

export async function passkeyDelCliente(clienteId: string): Promise<string[]> {
  return (await (await db()).query<{ id_credenziale: string }>(
    `select id_credenziale from passkey_clienti where cliente_id = $1::uuid`,
    [clienteId],
  )).map((r) => r.id_credenziale);
}

export async function salvaPasskey(p: {
  idCredenziale: string;
  chiavePubblica: Uint8Array;
  contatore: number;
  trasporti: string[];
  idUtente: string;
  clienteId: string;
}) {
  await (await db()).query(
    `insert into passkey_clienti (id_credenziale, chiave_pubblica, contatore, trasporti, id_utente, cliente_id)
     values ($1, $2::bytea, $3, $4, $5, $6::uuid) on conflict (id_credenziale) do nothing`,
    [p.idCredenziale, Buffer.from(p.chiavePubblica), p.contatore, p.trasporti.join(",") || null, p.idUtente, p.clienteId],
  );
}

/** Aggiorna il contatore solo se nessun altro l'ha già fatto: due accessi
    con la stessa firma non passano entrambi. */
export async function usaPasskey(idCredenziale: string, vecchio: number, nuovo: number): Promise<boolean> {
  return (await (await db()).query(
    `update passkey_clienti set contatore = $3, usata_il = now()
     where id_credenziale = $1 and contatore = $2 returning id_credenziale`,
    [idCredenziale, vecchio, nuovo],
  )).length > 0;
}

/* ── Accesso monouso (WhatsApp da Francesco) ───────────────────────────── */

export async function creaAccessoMonouso(hash: string, prenotazioneId: string, ore: number) {
  await (await db()).query(
    `insert into accessi_monouso (hash, prenotazione_id, scade_il) values ($1, $2::uuid, now() + make_interval(hours => $3))`,
    [hash, prenotazioneId, ore],
  );
}

/** Consuma l'accesso in una sola istruzione: valido, non usato, non scaduto.
    Se l'appuntamento non ha ancora un cliente_id gli si dà `nuovoCliente`.
    Restituisce il cliente_id da mettere nel cookie, o null. */
export async function consumaAccessoMonouso(hash: string, nuovoCliente: string): Promise<string | null> {
  const [a] = await (await db()).query<{ prenotazione_id: string }>(
    `update accessi_monouso set usato_il = now()
     where hash = $1 and usato_il is null and scade_il > now()
     returning prenotazione_id`,
    [hash],
  );
  if (!a) return null;
  const [p] = await (await db()).query<{ cliente_id: string }>(
    `update prenotazioni set cliente_id = coalesce(cliente_id, $2::uuid)
     where id = $1 and tipo = 'appuntamento' returning cliente_id`,
    [a.prenotazione_id, nuovoCliente],
  );
  return p?.cliente_id ?? null;
}

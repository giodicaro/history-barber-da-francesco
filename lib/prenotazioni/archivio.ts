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

/** Prenotazione arrivata dal sito, con le impronte del link e del codice
    personali ("Gestisci il tuo appuntamento"): mai i valori in chiaro. */
export async function salvaPrenotazione(
  richiesta: RichiestaPrenotazione,
  chiavi?: { gestioneHash: string; codiceHash: string },
): Promise<Prenotazione> {
  if (!chiavi) return (await creaVoce({ tipo: "appuntamento", ...richiesta })) as Prenotazione;
  return conVincolo(async () => {
    const [riga] = await (await db()).query<Riga>(
      `insert into prenotazioni (
         tipo, data, inizio, fine, servizio_id, servizio_nome, prezzo,
         operatore_id, cliente_nome, cliente_telefono, note, origine,
         gestione_hash, codice_hash
       ) values ($1, $2::date, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       returning ${COLONNE}`,
      [...colonne({ tipo: "appuntamento", ...richiesta }), chiavi.gestioneHash, chiavi.codiceHash],
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
): Promise<AppuntamentoGestito | null> {
  if (!UUID.test(id)) return null;
  return conVincolo(async () => {
    const [r] = await (await db()).query<Riga & { spostamenti: number }>(
      `update prenotazioni set
         data = $2::date, inizio = $3, fine = $4,
         spostamenti = spostamenti + 1, modificata_il = now()
       where id = $1 and tipo = 'appuntamento' and spostamenti < $5
       returning ${COLONNE_GESTIONE}`,
      [id, nuovo.data, nuovo.inizio, nuovo.fine, spostamentiMax],
    );
    return r ? daRigaGestita(r) : null;
  });
}

/** Disdetta = la riga si cancella, come fa l'agenda: lo slot torna libero
    subito. I dati per l'avviso a Francesco tornano dalla stessa query. */
export async function disdiciAppuntamento(id: string): Promise<AppuntamentoGestito | null> {
  if (!UUID.test(id)) return null;
  const [r] = await (await db()).query<Riga & { spostamenti: number }>(
    `delete from prenotazioni where id = $1 and tipo = 'appuntamento' returning ${COLONNE_GESTIONE}`,
    [id],
  );
  return r ? daRigaGestita(r) : null;
}

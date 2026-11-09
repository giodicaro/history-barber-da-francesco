import "server-only";
import { CONSERVAZIONE_MESI } from "@/lib/salone";
import { codiceErrore, db, tipoArchivio, VIOLAZIONE_ESCLUSIONE, type Interrogabile } from "./db";
import type { Intervallo } from "./slot";
import { chiaveTelefono } from "./telefono";
import type { Disdetta, NuovaVoce, Prenotazione, RichiestaPrenotazione, VoceAgenda } from "./tipi";

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

/** Il numero ha già un appuntamento attivo: dal sito se ne prenota uno solo. */
export class AppuntamentoGiaAttivo extends Error {
  constructor() {
    super("Appuntamento già attivo per questo numero");
    this.name = "AppuntamentoGiaAttivo";
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
  spostato_da: string | null;
};

/* La colonna "data" si legge come testo, non come oggetto data: un `date`
   convertito in Date diventa mezzanotte locale e, riportato a ISO in UTC,
   scivolerebbe al giorno prima per chi sta a est di Greenwich. */
const COLONNE = `id, tipo, to_char(data, 'YYYY-MM-DD') as data, inizio, fine,
  servizio_id, servizio_nome, prezzo, operatore_id,
  cliente_nome, cliente_telefono, note, origine, creata_il, spostato_da`;

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
    ...(r.spostato_da ? { spostatoDa: r.spostato_da } : {}),
  };
}

/* "Spostato" (modifica in agenda): se cambiano giorno o ora, si ricorda dove era. Nelle SET di un
   update le colonne valgono ancora i valori di prima. $D e $I sono i
   segnaposto del giorno e dell'ora nuovi nella query che lo usa. */
const SPOSTATO = (D: string, I: string) => `
  spostato_da = case when tipo = 'appuntamento' and (data <> ${D}::date or inizio <> ${I})
    then to_char(data, 'YYYY-MM-DD') || ' ' || lpad((inizio / 60)::text, 2, '0') || ':' || lpad((inizio % 60)::text, 2, '0')
    else spostato_da end,
  spostato_il = case when tipo = 'appuntamento' and (data <> ${D}::date or inizio <> ${I}) then now() else spostato_il end`;

/* Disdetta: la riga lascia prenotazioni e arriva in disdette nella stessa
   istruzione. $1 è l'id, $CHI chi disdice. */
const ARCHIVIA = (chi: string) => `
  archiviata as (
    insert into disdette (id, data, inizio, fine, servizio_nome, prezzo, operatore_id,
                          cliente_nome, cliente_telefono, origine, disdetta_da, creata_il)
    select id, data, inizio, fine, servizio_nome, prezzo, operatore_id,
           cliente_nome, cliente_telefono, origine, ${chi}, creata_il
    from tolta where tipo = 'appuntamento'
    on conflict (id) do nothing
  )`;

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

/** Voci di più giorni (vista settimana), in ordine di giorno e orario. */
export async function vociDellIntervallo(dal: string, al: string): Promise<VoceAgenda[]> {
  const righe = await (await db()).query<Riga>(
    `select ${COLONNE} from prenotazioni where data between $1::date and $2::date order by data, inizio`,
    [dal, al],
  );
  return righe.map(daRiga);
}

type RigaDisdetta = {
  id: string;
  data: string;
  inizio: number;
  fine: number;
  servizio_nome: string | null;
  prezzo: number;
  cliente_nome: string | null;
  cliente_telefono: string | null;
  disdetta_da: string;
  disdetta_il: Date;
};

/** Appuntamenti disdetti fra due giorni (inclusi): l'agenda li mostra
    attenuati, senza che occupino la poltrona. */
export async function disdetteDellIntervallo(dal: string, al: string): Promise<Disdetta[]> {
  const righe = await (await db()).query<RigaDisdetta>(
    `select id, to_char(data, 'YYYY-MM-DD') as data, inizio, fine, servizio_nome, prezzo,
            cliente_nome, cliente_telefono, disdetta_da, disdetta_il
     from disdette where data between $1::date and $2::date order by data, inizio`,
    [dal, al],
  );
  return righe.map((r) => ({
    id: r.id,
    data: r.data,
    inizio: r.inizio,
    fine: r.fine,
    servizioNome: r.servizio_nome ?? "",
    prezzo: r.prezzo,
    cliente: { nome: r.cliente_nome ?? "", ...(r.cliente_telefono ? { telefono: r.cliente_telefono } : {}) },
    da: r.disdetta_da === "cliente" ? "cliente" : "salone",
    disdettaIl: new Date(r.disdetta_il).toISOString(),
  }));
}

/** Appuntamenti (non disdetti) in un periodo: i conflitti di una chiusura. */
export async function appuntamentiNelPeriodo(dal: string, al: string): Promise<Prenotazione[]> {
  const righe = await (await db()).query<Riga>(
    `select ${COLONNE} from prenotazioni
     where tipo = 'appuntamento' and data between $1::date and $2::date
     order by data, inizio`,
    [dal, al],
  );
  return righe.map(daRiga) as Prenotazione[];
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

/* Il telefono salvato, ridotto al numero nazionale: la stessa regola di
   normalizzaTelefono (lib/prenotazioni/telefono.ts). I dati non si toccano:
   un numero scritto in un altro formato si riconosce lo stesso. */
const CHIAVE_TELEFONO_SQL = String.raw`regexp_replace(
    regexp_replace(cliente_telefono, '[\s.\-()/]', '', 'g'),
    '^(\+39|0039|39)(?=\d{9})', '')`;

/** Appuntamento attivo: non disdetto (i disdetti lasciano la tabella) e con
    data e ora ancora future. */
async function haAppuntamentoAttivo(q: Interrogabile, chiave: string, adesso: { data: string; minuti: number }) {
  const righe = await q.query(
    `select 1 from prenotazioni
     where tipo = 'appuntamento' and cliente_telefono is not null
       and ${CHIAVE_TELEFONO_SQL} = $1
       and (data > $2::date or (data = $2::date and inizio > $3))
     limit 1`,
    [chiave, adesso.data, adesso.minuti],
  );
  return righe.length > 0;
}

/** Il controllo veloce, prima di validare l'orario: chi riprova con lo stesso
    numero sente subito il motivo vero. Non basta da solo: l'ultima parola è
    di salvaPrenotazione. */
export async function telefonoConAppuntamentoAttivo(telefono: string, adesso: { data: string; minuti: number }) {
  const chiave = chiaveTelefono(telefono);
  return chiave ? haAppuntamentoAttivo(await db(), chiave, adesso) : false;
}

/** Prenotazione arrivata dal sito: una sola attiva per numero (l'agenda passa
    da creaVoce e non ha questo limite). Due invii simultanei con lo stesso
    numero si mettono in fila sul lock e il secondo vede la riga del primo: il
    controllo è una query a parte perché una query sola, dopo l'attesa,
    guarderebbe ancora i dati di prima. Con `clienteId` (v2, "Il mio
    appuntamento") si lega al cliente riconosciuto dal cookie; l'impronta del
    link era della v1 e oggi non si genera più. */
export async function salvaPrenotazione(
  richiesta: RichiestaPrenotazione,
  adesso: { data: string; minuti: number },
  extra: { gestioneHash?: string; clienteId?: string } = {},
): Promise<Prenotazione> {
  const chiave = chiaveTelefono(richiesta.cliente.telefono ?? "");
  return conVincolo(() => db().then((d) => d.transazione(async (tx) => {
    if (chiave) {
      await tx.query(`select pg_advisory_xact_lock(hashtextextended($1, 0))`, [`telefono:${chiave}`]);
      if (await haAppuntamentoAttivo(tx, chiave, adesso)) throw new AppuntamentoGiaAttivo();
    }
    const [riga] = await tx.query<Riga>(
      `insert into prenotazioni (
         tipo, data, inizio, fine, servizio_id, servizio_nome, prezzo,
         operatore_id, cliente_nome, cliente_telefono, note, origine,
         gestione_hash, cliente_id
       ) values ($1, $2::date, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::uuid)
       returning ${COLONNE}`,
      [
        ...colonne({ tipo: "appuntamento", ...richiesta }),
        extra.gestioneHash ?? null,
        extra.clienteId ?? null,
      ],
    );
    return daRiga(riga) as Prenotazione;
  })));
}

/** Riscrive una voce. Il vincolo ignora la riga stessa: spostare un
    appuntamento di un quarto d'ora sopra il suo vecchio orario è lecito. */
export async function aggiornaVoce(id: string, voce: NuovaVoce): Promise<VoceAgenda> {
  if (!UUID.test(id)) throw new VoceNonTrovata();
  return conVincolo(async () => {
    const [riga] = await (await db()).query<Riga>(
      `update prenotazioni set
         ${SPOSTATO("$3", "$4")},
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
  // Un appuntamento disdetto dall'agenda va fra i disdetti; un blocco no.
  const [r] = await (await db()).query<{ n: number }>(
    `with tolta as (delete from prenotazioni where id = $1 returning *),
     ${ARCHIVIA("'salone'")}
     select count(*)::int as n from tolta`,
    [id],
  );
  if (!r || r.n === 0) throw new VoceNonTrovata();
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
    await (await db()).query(
      `delete from disdette where data < $1::date - make_interval(months => $2)`,
      [oggi, CONSERVAZIONE_MESI],
    );
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
   Si entra solo per impronta (del token), e sempre
   con tipo = 'appuntamento': dal link di un cliente non si legge né si
   tocca un blocco o l'appuntamento di un altro. */

export async function appuntamentoDelToken(gestioneHash: string): Promise<Prenotazione | null> {
  const [r] = await (await db()).query<Riga>(
    `select ${COLONNE} from prenotazioni where gestione_hash = $1 and tipo = 'appuntamento'`,
    [gestioneHash],
  );
  return r ? (daRiga(r) as Prenotazione) : null;
}

/** Disdetta = la riga lascia prenotazioni (lo slot torna libero subito) e va
    fra i disdetti, come fa l'agenda. I dati per l'avviso a Francesco
    tornano dalla stessa query. */
export async function disdiciAppuntamento(id: string, clienteId: string | null = null): Promise<Prenotazione | null> {
  if (!UUID.test(id)) return null;
  const [r] = await (await db()).query<Riga>(
    `with tolta as (
       delete from prenotazioni
       where id = $1 and tipo = 'appuntamento' and ($2::uuid is null or cliente_id = $2::uuid)
       returning *
     ),
     ${ARCHIVIA("'cliente'")}
     select ${COLONNE} from tolta`,
    [id, clienteId],
  );
  return r ? (daRiga(r) as Prenotazione) : null;
}

/* ── "Il mio appuntamento" (v2): il cliente riconosciuto dal cookie ───────
   Ogni lettura e scrittura filtra per id **e** cliente_id **e** tipo:
   l'appartenenza si decide nello SQL. */

/** Gli appuntamenti del cliente da oggi in poi, in ordine di data. */
export async function appuntamentiDelCliente(clienteId: string, oggi: string): Promise<Prenotazione[]> {
  if (!UUID.test(clienteId)) return [];
  const righe = await (await db()).query<Riga>(
    `select ${COLONNE} from prenotazioni
     where cliente_id = $1::uuid and tipo = 'appuntamento' and data >= $2::date
     order by data, inizio`,
    [clienteId, oggi],
  );
  return righe.map(daRiga) as Prenotazione[];
}

export async function appuntamentoDelCliente(id: string, clienteId: string): Promise<Prenotazione | null> {
  if (!UUID.test(id) || !UUID.test(clienteId)) return null;
  const [r] = await (await db()).query<Riga>(
    `select ${COLONNE} from prenotazioni where id = $1 and cliente_id = $2::uuid and tipo = 'appuntamento'`,
    [id, clienteId],
  );
  return r ? (daRiga(r) as Prenotazione) : null;
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

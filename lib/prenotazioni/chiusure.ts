import "server-only";
import { chiusoIl, type Chiusura } from "@/lib/chiusure";
import { db } from "./db";

/* Chiusure e ferie nel database (tabella chiusure, db/schema.ts). Le regole
   sono in lib/chiusure.ts; qui solo letture e scritture. */

type Riga = { id: string; dal: string; al: string; motivo: string | null; attiva: boolean };

const COLONNE = `id, to_char(dal, 'YYYY-MM-DD') as dal, to_char(al, 'YYYY-MM-DD') as al, motivo, attiva`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const daRiga = (r: Riga): Chiusura => ({
  id: r.id,
  dal: r.dal,
  al: r.al,
  ...(r.motivo ? { motivo: r.motivo } : {}),
  attiva: r.attiva,
});

/** Tutte, per la pagina dell'admin. */
export async function elencoChiusure(): Promise<Chiusura[]> {
  const righe = await (await db()).query<Riga>(`select ${COLONNE} from chiusure order by dal, al`);
  return righe.map(daRiga);
}

/** Le attive che finiscono da questo giorno in poi: per il sito, gli slot e
    i giorni proposti. Poche righe: si leggono tutte e si decide con chiusoIl. */
export async function chiusureAttiveDa(giorno: string): Promise<Chiusura[]> {
  const righe = await (await db()).query<Riga>(
    `select ${COLONNE} from chiusure where attiva and al >= $1::date order by dal`,
    [giorno],
  );
  return righe.map(daRiga);
}

/** La chiusura attiva di un giorno, o null ("isClosed" lato server). */
export async function chiusuraDelGiorno(data: string): Promise<Chiusura | null> {
  return chiusoIl(data, await chiusureAttiveDa(data));
}

export async function creaChiusura(d: { dal: string; al: string; motivo?: string }): Promise<Chiusura> {
  const [r] = await (await db()).query<Riga>(
    `insert into chiusure (dal, al, motivo) values ($1::date, $2::date, $3) returning ${COLONNE}`,
    [d.dal, d.al, d.motivo?.trim() || null],
  );
  return daRiga(r);
}

export async function aggiornaChiusura(id: string, d: { dal: string; al: string; motivo?: string }): Promise<Chiusura | null> {
  if (!UUID.test(id)) return null;
  const [r] = await (await db()).query<Riga>(
    `update chiusure set dal = $2::date, al = $3::date, motivo = $4, modificata_il = now()
     where id = $1 returning ${COLONNE}`,
    [id, d.dal, d.al, d.motivo?.trim() || null],
  );
  return r ? daRiga(r) : null;
}

export async function impostaAttiva(id: string, attiva: boolean): Promise<Chiusura | null> {
  if (!UUID.test(id)) return null;
  const [r] = await (await db()).query<Riga>(
    `update chiusure set attiva = $2, modificata_il = now() where id = $1 returning ${COLONNE}`,
    [id, attiva],
  );
  return r ? daRiga(r) : null;
}

export async function eliminaChiusura(id: string): Promise<boolean> {
  if (!UUID.test(id)) return false;
  const righe = await (await db()).query<{ id: string }>(`delete from chiusure where id = $1 returning id`, [id]);
  return righe.length > 0;
}

/** Unisce più chiusure in una: aggiorna la prima, cancella le altre. */
export async function unisciChiusure(ids: string[], periodo: { dal: string; al: string; motivo?: string }): Promise<Chiusura | null> {
  const validi = ids.filter((id) => UUID.test(id));
  if (validi.length === 0) return null;
  const [prima, ...altre] = validi;
  const unita = await aggiornaChiusura(prima, periodo);
  if (altre.length) await (await db()).query(`delete from chiusure where id = any($1::uuid[])`, [altre]);
  if (unita && !unita.attiva) return impostaAttiva(unita.id, true);
  return unita;
}

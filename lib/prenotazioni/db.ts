import "server-only";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import type { PGlite } from "@electric-sql/pglite";
import { SCHEMA } from "@/db/schema";

/* Connessione al database dell'agenda. Tre casi, stesso SQL:

   1. DATABASE_URL (o POSTGRES_URL) presente → Postgres vero, via postgres.js.
      È il caso della produzione: Neon, Supabase, Vercel Marketplace…
   2. Nessun URL, in locale → PGlite su file in `.data/agenda`. È Postgres
      compilato in WebAssembly che gira dentro il processo di Next: stessi
      vincoli, stesso schema, e i dati restano fra un riavvio e l'altro.
      Niente da installare.
   3. Nessun URL, su Vercel → PGlite in memoria. Lì il disco non si può
      scrivere: l'agenda funziona ma si azzera, e la pagina lo dice.

   Perché postgres.js e non `@vercel/postgres`: quest'ultimo è deprecato da
   Vercel, che ha spostato i database gestiti su Neon. postgres.js parla con
   qualsiasi Postgres, quindi il progetto non è legato a un fornitore.

   Il resto del codice vede solo `query(testo, parametri)` con segnaposto
   $1, $2…: non sa quale dei tre motori c'è sotto. */

const URL_DB =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  null;

export type TipoArchivio = "postgres" | "file" | "memoria";

export const tipoArchivio: TipoArchivio = URL_DB ? "postgres" : process.env.VERCEL ? "memoria" : "file";

/** Cartella del database locale, relativa alla radice del progetto. */
export const CARTELLA_LOCALE = ".data/agenda";

export interface Database {
  query<T>(testo: string, parametri?: unknown[]): Promise<T[]>;
}

// Su globalThis: in sviluppo il ricaricamento a caldo rivaluta il modulo e
// senza questo si aprirebbe una connessione (o un secondo PGlite sulla stessa
// cartella, che la corromperebbe) a ogni salvataggio.
const deposito = globalThis as { __dbAgenda?: Promise<Database> };

export function db(): Promise<Database> {
  deposito.__dbAgenda ??= apri().catch((e) => {
    // Un'apertura fallita non deve restare in cache: la prossima richiesta riprova.
    deposito.__dbAgenda = undefined;
    throw e;
  });
  return deposito.__dbAgenda;
}

async function apri(): Promise<Database> {
  if (URL_DB) {
    // Connessione pigra e unica per processo: su Vercel ogni istanza ne apre
    // una sola e la riusa fra le richieste. `prepare: false` serve ai
    // connection pooler in modalità transazione (PgBouncer di Supabase, il
    // pooler di Neon), che non reggono gli statement preparati.
    const sql = postgres(URL_DB, { max: 1, idle_timeout: 20, connect_timeout: 10, prepare: false });
    return {
      query: async <T,>(testo: string, parametri: unknown[] = []) =>
        (await sql.unsafe(testo, parametri as postgres.ParameterOrJSON<never>[])) as unknown as T[],
    };
  }

  // Import dinamici: chi usa Postgres vero non carica il WebAssembly.
  const [{ PGlite }, { btree_gist }] = await Promise.all([
    import("@electric-sql/pglite"),
    import("@electric-sql/pglite/contrib/btree_gist"),
  ]);

  let cartella: string | undefined;
  if (tipoArchivio === "file") {
    // AGENDA_DATA_DIR sposta il database altrove: serve a provare l'app
    // senza toccare l'agenda locale di tutti i giorni.
    cartella = process.env.AGENDA_DATA_DIR ?? join(process.cwd(), CARTELLA_LOCALE);
    mkdirSync(cartella, { recursive: true });
  }
  const pg: PGlite = await PGlite.create(cartella, { extensions: { btree_gist } });
  // Lo schema è rieseguibile: applicarlo a ogni avvio tiene il database
  // locale allineato quando lo schema cambia.
  await pg.exec(SCHEMA);
  return {
    query: async <T,>(testo: string, parametri: unknown[] = []) =>
      (await pg.query<T>(testo, parametri)).rows,
  };
}

/** Codice Postgres per la violazione di un vincolo di esclusione. */
export const VIOLAZIONE_ESCLUSIONE = "23P01";

export function codiceErrore(e: unknown): string | undefined {
  return typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : undefined;
}

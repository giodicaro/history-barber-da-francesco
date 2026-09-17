import type { Prenotazione, RichiestaPrenotazione } from "./tipi";
import { siSovrappongono, type Intervallo } from "./slot";

/* Archivio delle prenotazioni: oggi è in memoria, domani è un database.

   ⚠️ LIMITE DA CONOSCERE: i dati vivono nel processo. Riavviando il server
   spariscono, e su Vercel ogni istanza serverless ha la sua copia: due clienti
   serviti da istanze diverse non si vedono a vicenda. Va bene per provare il
   flusso, NON per prendere appuntamenti veri.

   Per passare a un database vero cambia solo questo file: le funzioni sotto
   sono già asincrone e l'API non sa come sono fatte dentro.

   Esempio con Vercel Postgres o Supabase:

   create table prenotazioni (
     id           uuid primary key default gen_random_uuid(),
     data         date        not null,
     inizio       smallint    not null,   -- minuti dalla mezzanotte
     fine         smallint    not null,
     servizio_id  text        not null,
     servizio_nome text       not null,
     prezzo       smallint    not null,
     operatore_id text        not null,
     cliente_nome text        not null,
     cliente_telefono text    not null,
     note         text,
     origine      text,
     creata_il    timestamptz not null default now()
   );
   -- Niente doppie prenotazioni sullo stesso operatore, garantito dal database
   -- e non dal codice (due richieste simultanee passerebbero entrambe i
   -- controlli applicativi):
   create extension if not exists btree_gist;
   alter table prenotazioni add constraint niente_sovrapposizioni
     exclude using gist (
       operatore_id with =,
       data with =,
       int4range(inizio, fine) with &&
     );
*/

// La mappa sta su globalThis perché in sviluppo il ricaricamento a caldo
// rivaluta il modulo: senza, ogni salvataggio azzererebbe l'agenda.
const deposito = ((globalThis as { __prenotazioni?: Map<string, Prenotazione[]> }).__prenotazioni ??=
  new Map<string, Prenotazione[]>());

export class ConflittoOrario extends Error {
  constructor() {
    super("Orario appena occupato");
    this.name = "ConflittoOrario";
  }
}

export async function prenotazioniDelGiorno(data: string): Promise<Prenotazione[]> {
  return [...(deposito.get(data) ?? [])].sort((a, b) => a.inizio - b.inizio);
}

/** Intervalli occupati di un operatore in un giorno, per il calcolo degli slot. */
export async function occupatiDelGiorno(data: string, operatoreId: string): Promise<Intervallo[]> {
  const elenco = await prenotazioniDelGiorno(data);
  return elenco
    .filter((p) => p.operatoreId === operatoreId)
    .map(({ inizio, fine }) => ({ inizio, fine }));
}

/** Salva, se nel frattempo nessuno ha preso lo stesso orario. */
export async function salvaPrenotazione(richiesta: RichiestaPrenotazione): Promise<Prenotazione> {
  const delGiorno = deposito.get(richiesta.data) ?? [];
  const scontro = delGiorno.some(
    (p) => p.operatoreId === richiesta.operatoreId && siSovrappongono(p, richiesta),
  );
  if (scontro) throw new ConflittoOrario();

  const prenotazione: Prenotazione = {
    ...richiesta,
    id: crypto.randomUUID(),
    creataIl: new Date().toISOString(),
  };
  deposito.set(richiesta.data, [...delGiorno, prenotazione]);
  return prenotazione;
}

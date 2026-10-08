/* Schema dell'agenda di History Barber.

   Un testo solo, usato in due posti:
   - dall'app, che lo applica da sé al database locale su file (PGlite) la
     prima volta che lo apre;
   - da `npm run db:init`, che lo applica al Postgres di DATABASE_URL.
   Per questo è un modulo senza import: lo script lo carica con Node così
   com'è (Node 22.18 o successivo legge i .ts da solo).

   È rieseguibile senza danni: IF NOT EXISTS ovunque, e le modifiche rispetto
   alla prima versione sono migrazioni idempotenti in fondo al file. */

export const SCHEMA = /* sql */ `
-- Serve per il vincolo di esclusione: permette di mettere nello stesso
-- indice GiST una colonna testuale e un intervallo.
create extension if not exists btree_gist;

-- Una riga per ogni cosa che occupa la poltrona: gli appuntamenti e i
-- blocchi (pausa, ferie, commissione). Stare nella stessa tabella vuol dire
-- stare sotto lo stesso vincolo: un blocco non può coprire un cliente, e il
-- sito non propone un orario bloccato.
create table if not exists prenotazioni (
  id            uuid primary key default gen_random_uuid(),
  tipo          text        not null default 'appuntamento'
                check (tipo in ('appuntamento', 'blocco')),
  -- Giornata del salone (ora di Roma), non un timestamp: gli orari del salone
  -- sono minuti dalla mezzanotte e restano confrontabili come interi.
  data          date        not null,
  inizio        smallint    not null check (inizio >= 0 and inizio < 1440),
  fine          smallint    not null check (fine > inizio and fine <= 1440),
  servizio_id   text,
  servizio_nome text,
  prezzo        smallint    not null default 0 check (prezzo >= 0),
  operatore_id  text        not null,
  cliente_nome  text,
  cliente_telefono text,
  -- Per un appuntamento la nota del cliente, per un blocco il motivo.
  note          text,
  -- Da dove è arrivata: il bottone del sito, oppure "agenda" se l'ha
  -- inserita Francesco.
  origine       text,
  creata_il     timestamptz not null default now(),
  modificata_il timestamptz
);

-- ── Migrazione dalla prima versione (solo appuntamenti, cliente obbligatorio)
alter table prenotazioni add column if not exists tipo text not null default 'appuntamento';
alter table prenotazioni add column if not exists modificata_il timestamptz;
alter table prenotazioni alter column servizio_id drop not null;
alter table prenotazioni alter column servizio_nome drop not null;
alter table prenotazioni alter column cliente_nome drop not null;
alter table prenotazioni alter column cliente_telefono drop not null;
alter table prenotazioni alter column prezzo set default 0;

do $$
begin
  -- Un blocco non ha cliente; un appuntamento sì, almeno il nome.
  if not exists (select 1 from pg_constraint where conname = 'prenotazioni_appuntamento_completo') then
    alter table prenotazioni
      add constraint prenotazioni_appuntamento_completo
      check (tipo = 'blocco' or (cliente_nome is not null and servizio_nome is not null));
  end if;

  -- Due righe non possono sovrapporsi sullo stesso operatore.
  -- Il controllo sta nel database e non nel codice: due richieste simultanee
  -- passerebbero entrambe i controlli applicativi, qui invece una delle due
  -- viene rifiutata (SQLSTATE 23P01, gestito come "orario appena occupato").
  if not exists (select 1 from pg_constraint where conname = 'prenotazioni_niente_sovrapposizioni') then
    alter table prenotazioni
      add constraint prenotazioni_niente_sovrapposizioni
      exclude using gist (
        operatore_id with =,
        data with =,
        int4range(inizio, fine) with &&
      );
  end if;
end $$;

-- L'agenda e il calcolo degli slot leggono sempre "tutto un giorno, in
-- ordine di orario".
create index if not exists prenotazioni_giorno on prenotazioni (data, inizio);

-- ── App dei clienti (PWA in /app) ──────────────────────────────────────────
-- Id generato dal telefono del cliente per ogni richiesta: se la stessa
-- richiesta arriva due volte (coda offline che riprova), si restituisce la
-- prenotazione già creata invece di farne una seconda.
alter table prenotazioni add column if not exists richiesta_id text;
create unique index if not exists prenotazioni_richiesta
  on prenotazioni (richiesta_id) where richiesta_id is not null;
-- Quando è partito il promemoria al cliente: un promemoria solo per finestra.
-- Si azzerano se l'appuntamento viene spostato.
alter table prenotazioni add column if not exists promemoria_24h_il timestamptz;
alter table prenotazioni add column if not exists promemoria_2h_il timestamptz;

-- Telefoni dei clienti iscritti ai promemoria. Tabella separata da
-- iscrizioni_push (i dispositivi dell'agenda): i clienti ricevono solo i
-- promemoria dei propri appuntamenti, mai le notifiche per Francesco.
create table if not exists iscrizioni_clienti (
  endpoint   text primary key,
  p256dh     text not null,
  auth       text not null,
  creata_il  timestamptz not null default now()
);

-- Quale telefono riceve i promemoria di quale appuntamento. Si cancella da
-- sola con l'appuntamento (disdetto o oltre il periodo di conservazione).
create table if not exists promemoria_iscrizioni (
  prenotazione_id uuid not null references prenotazioni(id) on delete cascade,
  endpoint        text not null references iscrizioni_clienti(endpoint) on delete cascade on update cascade,
  primary key (prenotazione_id, endpoint)
);

-- Telefoni (e computer) che ricevono una notifica a ogni prenotazione dal
-- sito. Una riga per dispositivo: l'endpoint è l'indirizzo del servizio di
-- notifiche del produttore (Apple, Google, Mozilla), le due chiavi servono a
-- cifrare il messaggio per quel dispositivo e solo per lui.
create table if not exists iscrizioni_push (
  endpoint   text primary key,
  p256dh     text not null,
  auth       text not null,
  -- "iPhone", "Chrome su Windows"…: per riconoscerle nell'agenda.
  etichetta  text,
  creata_il  timestamptz not null default now()
);
`;

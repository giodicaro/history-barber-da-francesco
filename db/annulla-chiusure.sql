-- Annulla la migrazione "Chiusure e ferie" (31/10/2026) di db/schema.ts.
--
-- Il progetto non ha uno strumento di migrazioni con "down": lo schema si
-- applica da solo, solo con aggiunte. Per tornare indietro si lancia questo
-- file a mano (Neon: SQL Editor del branch; locale: psql), DOPO aver tolto dal
-- codice la parte nuova, altrimenti alla prima connessione lo schema la
-- ricrea.
--
-- Cosa si perde: le chiusure salvate, l'elenco dei disdetti e la traccia
-- "spostato" degli appuntamenti. Appuntamenti e blocchi restano intatti.

begin;

drop table if exists chiusure;
drop table if exists disdette;
alter table prenotazioni drop column if exists spostato_da;
alter table prenotazioni drop column if exists spostato_il;

commit;

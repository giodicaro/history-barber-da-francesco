# App dei clienti (PWA) — History Barber

App installabile sul telefono per i clienti di **History Barber da Francesco**. Fa parte del sito: è servita dallo stesso progetto Next.js e scrive nella **stessa agenda di Francesco**.

- Indirizzo: **`/app`**, che porta a `/app/index.html`. In produzione: https://history-barber-da-francesco.vercel.app/app
- Interfaccia: HTML, CSS e moduli JavaScript scritti a mano, senza build, in `public/app/`.
- API: rotte di Next in `app/api/app/*`, raggiungibili come `/app/api/*` (riscrittura in `next.config.ts`).
- Dati: tabella `prenotazioni` di Postgres/Neon, la stessa dell'agenda e del widget del sito.

## Come si collega all'agenda

| Cosa succede | Dove si vede |
|---|---|
| Il cliente prenota dall'app | L'appuntamento compare subito in `/admin` con «Arrivato da: App del cliente». Francesco riceve l'avviso Telegram e la notifica push dell'agenda, come per il widget del sito |
| Francesco inserisce un appuntamento o un blocco (pausa, ferie) | Quell'orario sparisce dall'app e dal sito |
| Il cliente sposta o disdice dall'app (fino a 2 ore prima) | L'agenda si aggiorna e Francesco riceve un avviso «Spostata dall'app» o «Disdetta dall'app» (Telegram + push) |
| Francesco sposta un appuntamento preso dall'app | Il cliente lo vede spostato nel suo link «Gestisci prenotazione» e i promemoria ripartono sul nuovo orario |
| Due persone prenotano lo stesso orario (da app, sito o agenda) | Ne passa una sola: decide il vincolo di esclusione del database. Nell'app l'altra torna alla scelta dell'orario |

Orari, listino, durate, preavviso (60 min), finestra di prenotazione (oggi + 21 giorni) e passo degli orari (30 min) vengono **tutti da `lib/salone.ts`**. Sito, app e agenda seguono le stesse regole: il motore degli orari dell'API è `generaSlot()` del sito.

## Cosa fa

- **Prenotazione in 5 passi:** barbiere (anche «Primo disponibile»), servizio, giorno e ora, nome e telefono con consenso privacy, riepilogo.
- **Gestisci prenotazione:** un link segreto (`#gestisci/<id>/<token>`, salvato sul telefono) per spostare o disdire da soli fino a `MODIFICABILE_FINO_A_MINUTI` prima (120). Il token è un HMAC dell'id firmato con `BOOKING_SECRET`, oppure `AUTH_SECRET` se manca: nel database non si salva nessun segreto.
- **«Ripeti l'ultimo taglio»** in un tocco. Aggiungi al calendario (`.ics`).
- **Offline:** l'app si apre dalla cache. Una prenotazione fatta senza rete resta «In attesa di invio» e parte da sola al ritorno della connessione (Background Sync, oppure l'evento `online` su Safari e Firefox). Non viene mai mostrata come confermata prima della risposta del server. Ogni richiesta porta un `clientRequestId` (colonna `richiesta_id`): se arriva due volte, il server restituisce la stessa prenotazione.
- **Promemoria push** 24 ore e 2 ore prima, solo per chi li attiva. Toccando il promemoria si apre direttamente «Gestisci prenotazione». Usano le stesse chiavi VAPID delle notifiche dell'agenda.
- **Installazione:** banner su Android/Chrome, guida passo passo su iPhone (su iOS le notifiche push arrivano solo con l'app aggiunta alla schermata Home, da iOS 16.4).
- **Modalità demo:** se i file di `public/app` vengono pubblicati senza server, l'app funziona solo sul dispositivo e lo dichiara con una fascia rossa. Si può forzare con `?mock`.

## Decisioni prese

1. **Unita al sito, non separata.** La prima versione aveva un server Express con un database SQLite suo: le prenotazioni non arrivavano a Francesco. Ora c'è un solo database, una sola agenda e un solo deploy (Vercel, HTTPS già incluso). Il server Express è stato tolto.
2. **Niente email.** Il salone non manda email e l'agenda non le registra: chiederla avrebbe raccolto un dato senza scopo (minimizzazione, GDPR). Bastano nome e telefono, come nel widget del sito.
3. **Telefono:** stessa regola di sito e agenda (`lib/prenotazioni/telefono.ts`; la copia per il browser è in `public/app/js/shared/validation.js`, e un test le confronta). Al massimo `PRENOTAZIONI_ATTIVE_MAX` (2) prenotazioni future per numero dall'app.
4. **Festività:** quelle nazionali sono calcolate in `lib/festivi.ts` (Capodanno, Epifania, Pasquetta, 25 aprile/San Marco, 1° maggio, 2 giugno, Ferragosto, Ognissanti, Immacolata, Natale, Santo Stefano). Con `CHIUSO_NEI_FESTIVI = true` il salone risulta chiuso nel sito, nell'app e nello stato «Aperto ora». È un'ipotesi prudente: nessuna fonte dice se il salone lavora nei festivi. Per ferie e chiusure straordinarie basta un blocco di un giorno intero nell'agenda.
5. **Prezzi e durate:** restano indicativi finché Francesco non li conferma. Si correggono solo in `lib/salone.ts` e poi si mette `LISTINO_CONFERMATO = true`: sito e app smettono di scrivere «indicativi». La copia statica `public/app/data/shop.json` (per offline e demo) si rigenera da sola con `npm run dev` e `npm run build`, oppure a mano con `npm run app:dati`.
6. **Informativa privacy unica:** `/privacy` del sito, con una sezione «App e promemoria».
7. **Promemoria senza cron a pagamento:** il piano gratuito di Vercel permette cron solo una volta al giorno. La rotta `/app/api/cron/promemoria` (protetta da `CRON_SECRET`) è chiamata ogni 15 minuti da `.github/workflows/promemoria-app.yml`. In più i promemoria partono «di passaggio» quando qualcuno usa l'app. Ogni promemoria si segna prima di essere inviato (`promemoria_24h_il`, `promemoria_2h_il`): non partono doppioni.
8. **Schema del database:** le nuove colonne e tabelle (`richiesta_id`, `promemoria_*`, `iscrizioni_clienti`, `promemoria_iscrizioni`) stanno in `db/schema.ts`. Lo schema ora si applica da solo anche su Postgres alla prima connessione di ogni istanza, quindi non serve lanciare `npm run db:init` prima del deploy (resta valido).

## Da fare per metterla online

1. Merge su `main`: Vercel la pubblica insieme al sito.
2. Su Vercel ci sono già `DATABASE_URL`, `AUTH_SECRET` e le chiavi VAPID delle notifiche dell'agenda. Da aggiungere: `CRON_SECRET` (una stringa casuale).
3. Su GitHub (Settings → Secrets and variables → Actions): `CRON_SECRET` con lo stesso valore e `APP_URL=https://history-barber-da-francesco.vercel.app`.
4. Far confermare a Francesco prezzi e durate, e se lavora nei festivi.

## File

```text
public/app/                 interfaccia (statica, servita da Next)
  index.html, offline.html, manifest.webmanifest, sw.js
  css/styles.css, fonts/ (Bodoni Moda + Figtree, OFL), icons/
  data/shop.json            GENERATO da lib/salone.ts (npm run app:dati)
  js/app.js                 avvio, service worker e aggiornamenti, installazione, navigazione
  js/api.js                 unico punto che parla col server (o con la demo locale)
  js/booking.js             passi della prenotazione, conferma, coda offline, gestione
  js/notifications.js       permesso, iscrizione, notifiche locali
  js/outbox.js              coda IndexedDB condivisa fra pagina e service worker
  js/shared/                orari, fuso di Roma, validazione (anche per la demo)
app/api/app/*               API dell'app (URL pubbliche /app/api/*)
lib/prenotazioni/app.ts     logica server: orari, prenotazioni, token, promemoria
lib/app-dati.ts             lib/salone.ts → formato dell'app
lib/festivi.ts              festività nazionali calcolate
scripts/genera-dati-app.mjs scrive public/app/data/shop.json
scripts/genera-icone-app.mjs icone da un unico SVG (npm run app:icone)
tests/app/                  slots.test.mjs (npm run test:app), e2e.mjs (npm run e2e:app)
.github/workflows/promemoria-app.yml
```

## API (`/app/api/*`)

| Metodo | Percorso | Note |
|---|---|---|
| GET | `health` | `{ ok, push }` |
| GET | `shop` | dati del salone da `lib/salone.ts` |
| GET | `days?service=&barber=` | giorni prenotabili con il numero di orari liberi |
| GET | `availability?date=&service=&barber=` | orari liberi (`barber=any` = primo disponibile) |
| POST | `bookings` | 201 creata · 200 richiesta ripetuta · 409 orario preso · 422 errori per campo · 429 troppe prenotazioni o richieste |
| GET | `bookings/:id` | intestazione `X-Booking-Token` |
| POST | `bookings/:id/cancel` · `bookings/:id/reschedule` | 403 dopo il limite delle 2 ore |
| GET | `push/public-key` | 503 se le chiavi VAPID mancano |
| POST | `push/subscribe` · `push/unsubscribe` | per collegare un appuntamento serve il suo token |
| GET | `cron/promemoria` | `Authorization: Bearer <CRON_SECRET>` |

## Verifiche fatte (8 ottobre 2026)

| Verifica | Esito |
|---|---|
| `npm run test:app`: orari, fusi e cambio d'ora, festività, stessa regola del telefono di sito e app, `shop.json` allineato a `lib/salone.ts` | ✅ 14/14 |
| `npm run e2e:app` contro il sito avviato in locale (agenda su PGlite), Chromium 141: prenotazione dall'app occupa l'orario anche per il sito e viceversa; 10 richieste in parallelo → una sola passa; richiesta ripetuta → stessa prenotazione; sposta e disdici col link; limite per telefono; 422; festivo chiuso; cron protetto; installabilità; prenotazione dall'interfaccia **visibile nell'agenda `/admin` come «App del cliente»**; 409 → passo 3; offline → in attesa → confermata; notifica push e tocco; guida iOS; aggiornamento del service worker | ✅ 21/21 |
| `next build` + `tsc` + `eslint` | ✅ |
| Lighthouse 13.5 mobile su `/app/index.html` (build di produzione) | Performance 100 · Accessibilità 100 · Best Practices 100 · SEO 100 |
| Iscrizione push reale nel browser | non verificabile in questo ambiente (rete verso i server push di Google bloccata) |

### Controllo manuale su telefoni veri

- **Android/Chrome:** installare da `/app`; prenotare; spegnere la rete, prenotare («In attesa di invio»), riaccendere la rete («Prenotazione confermata»); «Sì, avvisami» → notifica di conferma; verificare in `/admin` che l'appuntamento c'è.
- **iPhone (iOS 16.4+):** guida «Aggiungi alla schermata Home», aprire dall'icona, attivare i promemoria, prenotare per il giorno dopo e attendere il promemoria (serve il workflow GitHub attivo).
- **Francesco:** dall'agenda, spostare un appuntamento preso dall'app e controllare che il link del cliente mostri il nuovo orario.

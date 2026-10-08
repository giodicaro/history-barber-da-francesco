# Production Bible — History Barber da Francesco

Passaggio di consegne per il sito vetrina di **History Barber da Francesco**, barbiere a Mestre (Venezia).

**Fotografia scattata il:** 26 settembre 2026, aggiornata dopo l'agenda interattiva (navigazione fra i giorni, gestione di appuntamenti e blocchi, database locale su file)
**Cartella:** `C:\Users\foscolo\Parruchieria\my-app`
**Versionamento:** https://github.com/giodicaro/history-barber-da-francesco (pubblico, ramo `main`)
**Produzione:** https://history-barber-da-francesco.vercel.app (Vercel, progetto `history-barber-da-francesco`, collegato al repository: ogni push su `main` va in produzione)
**Sviluppo:** http://localhost:3200

> ⚠️ **Prezzi e foto non sono reali.** Il listino è indicativo (nessuna fonte pubblica lo riporta). La foto della hero è generata con Higgsfield e non ritrae un cliente del salone; il logo è ridisegnato a mano da uno screenshot minuscolo; i lavori del portfolio sono ancora segnaposto a tratteggio. Il sito **non è pubblicabile** finché questi punti non sono risolti. Vedi §11.

> 📌 **Come leggere il documento.** Ogni affermazione tecnica rimanda a `file:riga`. Si distinguono tre cose:
> - **verificato**: letto nel codice o misurato;
> - **dichiarato**: intenzione scritta nei commenti o nei nomi;
> - **mancante**: segnaposto, simulato, da fare.
>
> Quello che il codice non può dire è marcato `[NON DEDUCIBILE DAL CODICE]` oppure viene dalla storia del progetto (§1.4).

---

## 1. Identità e scopo

### 1.1 Che cos'è

Sito vetrina **one-page** per un barbiere. Estetica premium, brutalista e minimalista, sul modello dei siti premiati su Awwwards. Non ha backend, database, autenticazione né CMS.

Il sito deve fare tre cose: presentare il salone, mostrare listino e lavori, portare alla prenotazione. **La prenotazione oggi non esiste**: i bottoni "Prenota" sono segnaposto voluti dal committente (§6.9).

### 1.2 Il salone

| Dato | Valore | Fonte |
|---|---|---|
| Nome | History Barber da Francesco | Instagram, Fresha |
| Indirizzo | Via Ca' Rossa 47/A-B, 30173 Mestre (VE) | Fresha, Instagram |
| Telefono | 348 697 6353 | Fresha (`tel:+393486976353`), Instagram |
| Orari | Mar–Ven 08:30–13:00 / 14:30–20:00 · Sab 08:30–13:00 / 14:30–19:00 · Dom e Lun chiuso | Fresha |
| Modalità | Solo su appuntamento | Bio Instagram |
| Altro | Rivenditore autorizzato Depot (prodotti uomo) | Bio Instagram |
| Instagram | [@history_barber_da_francesco_](https://www.instagram.com/history_barber_da_francesco_/) | — |
| P.IVA | `[NON DEDUCIBILE DAL CODICE]`, campo vuoto | — |

Tutti i dati vivono in `lib/salone.ts:12-29`. Le fonti sono annotate anche nel codice (`lib/salone.ts:4-10`).

La scheda Fresha (`fresha.com/it/lvp/history-barber-da-francesco-…`) **non è gestita dal salone** e **non contiene un listino**. Il brief chiedeva di estrarre i prezzi da lì, ma non era possibile. Il vecchio sito del salone (`history-barber.business.site`) risponde 404.

### 1.3 Chi lo usa

`[NON DEDUCIBILE DAL CODICE]` Clientela di quartiere a Mestre, con ogni probabilità da smartphone: il salone lavora su appuntamento telefonico e comunica via Instagram. Da qui le scelte mobile-first:
- telefono cliccabile in hero, menu e footer;
- badge "Aperto ora / Chiuso ora";
- bottone "Prenota" sempre visibile nella barra.

### 1.4 Storia del progetto (non ricavabile dal codice)

Tutto è stato fatto il 16–17 settembre 2026, in una sola sessione.

1. **Brief v1.** Titolo hero "PIÙ DI UN BARBIERE"; griglia architettonica bianco/nero/grigio; menu hamburger a tutto schermo; listino "estratto da Fresha"; portfolio a quadrati; bottoni Prenota disattivati.
2. **Brief v2** (quello attuale). Rispetto al v1:
   - nuovo titolo "L'ECCELLENZA DEL GROOMING MASCHILE";
   - tre famiglie di font con ruoli precisi (§3.2);
   - bottoni Prenota magnetici con riempimento, come link `href="#"`;
   - cascata "staggered slide-up" (y 50 → 0) sul listino;
   - portfolio senza margini, scale 1.05 all'hover;
   - griglia di sfondo a una colonna su smartphone;
   - menu con `staggerChildren` di framer-motion.
3. **Correzioni** a valle del v2 (§9): testi rimasti invisibili dopo il ricaricamento a caldo, titoli che andavano a capo con la barra di scorrimento, riempimento del bottone che non compariva.
4. **Revisione del 17 settembre** (riferimento visivo `image_2ae282.png`, non presente sul computer):
   - hero mobile ribilanciata: su smartphone i tre blocchi (informazioni, titolo, testo con CTA) si distribuiscono su tutta l'altezza, invece di lasciare ~340px vuoti sopra il titolo; desktop invariato (§6.3);
   - **magnetismo dei bottoni Prenota rimosso**: il bottone resta fermo, riempimento e `mix-blend-difference` invariati (§6.9);
   - foto della hero generata con Higgsfield (richiesto Nano Banana Pro a 2K, il job riporta `nano_banana_2`; 2 crediti) e salvata in `public/hero-bg.webp`, poi sostituita al punto 5.
5. **Seconda revisione del 17 settembre** (riferimenti: registrazione schermo delle 12:58 e `image_619186.png`, che sul computer è lo screenshot `Pictures/Screenshots/Screenshot 2026-09-17 130245.png`, 209×33px):
   - **tipografia**: tutti i metadati passano all'utility `info` (12px), comprese le sigle A/B/C di Chi Siamo, le tecniche del portfolio, indirizzo, telefono e Instagram del footer (§3.2);
   - **nuova foto della hero**: nuca con sfumatura e vapore, più incisiva della poltrona (Higgsfield, 2 crediti), in `public/images/hero-sfumatura.webp`. La vecchia `hero-bg.webp` è stata tolta da `public/`. Velo della hero rinforzato dopo una misura di contrasto (§9.17);
   - **nuovo logo "HB da Francesco"** in `components/Logo.tsx`, al posto del monogramma testuale nella barra e aggiunto nella barra finale del footer (§3.6).
6. **Pubblicazione (17 settembre).** Repository GitHub pubblico, progetto Vercel collegato, primo deploy in produzione (§12).
7. **Modulo di prenotazione (17 settembre).** Il sistema nativo chiesto dal committente esiste: widget a tre passi, API degli slot, agenda per la cassa (§6.9 e §6.13). L'archivio è ancora in memoria: **non è pronto per prendere appuntamenti veri** (§11).
8. **Completamento del modulo di prenotazione (25 settembre).** I tre punti bloccanti sono chiusi: archivio su Postgres (§6.9), agenda protetta con Auth.js (§6.13), avviso al titolare su Telegram (§6.9). Restano da confermare prezzi e durate, e manca la verifica del numero del cliente (§11).
9. **Terza revisione del 17 settembre**: segnalato un monospazio "pixelato" nei metadati di hero, menu e footer (riferimenti `image_62d41e.png` e `image_62d45f.png`, cioè gli screenshot delle 13:40 e 13:41, più la registrazione delle 13:42). Il font era già JetBrains Mono (§9.19). Richiesti peso medio e spaziatura più larga: il token `info` passa a **peso 500 e 0.05em** e vale ovunque; "alle 14:30" non si spezza più.
10. **Agenda interattiva (26 settembre).** Segnalati tre problemi: archivio che si azzerava ("Archivio in memoria"), agenda ferma su un giorno, righe non cliccabili. Il brief chiedeva SQLite con Prisma, ma il progetto non usa un ORM e in produzione gira su Postgres. Per non avere due dialetti SQL, in locale c'è **Postgres su file (PGlite)** al posto di SQLite. L'agenda ora ha frecce che saltano i giorni di chiusura, un calendario, e la gestione completa: crea, modifica, disdici, blocca (§6.13).
11. **App dei clienti (8 ottobre).** PWA installabile in `/app` (file statici in `public/app`, API in `app/api/app`), collegata alla stessa agenda: le prenotazioni dall'app compaiono in `/admin` con origine "app", il cliente può spostare o disdire fino a 2 ore prima (Francesco viene avvisato), funziona offline con coda di invio e manda promemoria push 24h e 2h prima. Nella stessa occasione: festività nazionali chiuse (`lib/festivi.ts`, `CHIUSO_NEI_FESTIVI`), flag `LISTINO_CONFERMATO`, schema applicato da solo anche su Postgres. Tutto in `docs/app.md` (§6.14).

**Scostamenti dal brief, consapevoli:**

| Brief | Realtà | Perché |
|---|---|---|
| `@studio-freight/lenis` | `lenis` 1.3.26 | Il pacchetto `@studio-freight/lenis` è deprecato su npm: *"has been renamed to 'lenis'"*. È la stessa libreria. |
| Titoli in "Clash Display, Oswald o Syne" | Syne, **peso 700** | Clash Display non è su Google Fonts: servirebbe scaricare i file da Fontshare, permesso non ancora dato. Syne a 800 passa al disegno esteso ed è largo il 47% in più (§3.2). |
| Listino "estratto da Fresha" | Voci e prezzi indicativi | Fresha non ha un listino per questo salone (§1.2). |
| Riferimento `image_299467.png` per i testi informativi | Blocchi in monospazio in hero, menu e footer | Il file non è sul computer, forse allegato altrove. Interpretato come i blocchi "CHIUSO ORA / RIAPRE…". |
| Struttura: Hero, Listino, Portfolio, Footer | Hero, **Chi Siamo**, Portfolio, Listino, Contatti | L'ordine segue quello del menu richiesto. "Chi Siamo" esiste perché il menu la cita. |

---

## 2. Stack e ambiente

### 2.1 Runtime (versioni installate, verificate in `node_modules`)

| | Versione | Nota |
|---|---|---|
| Next.js | **16.3.5** | App Router, Turbopack |
| React / React DOM | **19.2.8** | — |
| TypeScript | 5.9.3 | `strict: true`, alias `@/*` → `./*` (`tsconfig.json`) |
| Tailwind CSS | **4.3.3** | Via `@tailwindcss/postcss`, niente `tailwind.config`; token in `@theme` |
| ESLint | 9.39.5 | `eslint-config-next` 16.3.5 (core-web-vitals + typescript) |
| Node / npm | 24.19.0 / 11.17.0 | In locale |

> ⚠️ **Leggi `AGENTS.md` prima di scrivere codice.** Questa versione di Next ha API diverse da quelle documentate altrove; le guide aggiornate sono in `node_modules/next/dist/docs/`. Il blocco viene **riscritto da `next dev`**. Due differenze già incontrate:
> - `next/image`: `priority` è **deprecato**, al suo posto si usa `preload` (`components/Photo.tsx:43`);
> - `images.qualities` di default vale `[75]`: altre qualità vanno dichiarate in config.

### 2.2 Dipendenze di runtime e uso reale

| Pacchetto | Dove si importa | Uso |
|---|---|---|
| `lenis` ^1.3.26 | `components/SmoothScroll.tsx`, `components/Navbar.tsx`, `components/BookingWidget.tsx` (`lenis/react`) | Scorrimento morbido globale, `stop()`/`start()` con menu e foglio di prenotazione, `scrollTo` |
| `gsap` ^3.15.0 | **solo** `lib/gsap.ts` (con `ScrollTrigger`) | Entrate allo scroll, parallasse, sequenza della hero |
| `framer-motion` ^13.4.0 | `components/Navbar.tsx`, `components/BookButton.tsx`, `components/BookingWidget.tsx` | Menu (varianti + stagger), riempimento del bottone, entrata e uscita del foglio di prenotazione |
| `postgres` 3.4.9 | `lib/prenotazioni/db.ts`, `scripts/db-init.mjs` | Client Postgres delle prenotazioni. **Non** `@vercel/postgres`: è deprecato da Vercel, che ha spostato i database gestiti su Neon. postgres.js parla con qualsiasi Postgres, quindi il progetto non è legato a un fornitore |
| `next-auth` 5.0.0-beta.32 | `auth.ts`, `auth.config.ts`, `middleware.ts` | Accesso all'agenda: una sola password, sessione in un cookie firmato |
| `@electric-sql/pglite` 0.5.8 | `lib/prenotazioni/db.ts` | Postgres compilato in WebAssembly, dentro il processo di Next. È il database quando manca `DATABASE_URL`: su file in locale, in memoria su Vercel. Stesso SQL e stessi vincoli della produzione. In `serverExternalPackages` (`next.config.ts`), perché carica da sé i suoi file `.wasm` e l'estensione `btree_gist` |
| `server-only` | `lib/prenotazioni/db.ts`, `lib/prenotazioni/avvisi.ts`, `lib/prenotazioni/archivio.ts` | Fa fallire la build se un modulo con segreti finisce in un componente client |

Non ci sono altre dipendenze: niente `clsx`/`tailwind-merge` (l'helper `cn` è un semplice join, `lib/utils.ts:1-3`) e niente librerie di icone (SVG scritti a mano in `components/icons.tsx`).

### 2.3 Font

Caricati con `next/font/google` in `app/layout.tsx:9-22`. Next li scarica in fase di build e li serve dallo stesso dominio: **nessuna richiesta a Google dal browser del visitatore**, cosa rilevante per la privacy.

| Famiglia | Variabile CSS | Token Tailwind | Ruolo |
|---|---|---|---|
| Syne (variabile 400–800) | `--font-syne` | `font-display` | Titoli giganti, nome nella barra |
| Inter (variabile) | `--font-inter` | `font-sans` (default del body) | Testi, listino, eyebrow, bottoni |
| JetBrains Mono (variabile) | `--font-jetbrains-mono` | `font-mono` | Informazioni pratiche: indirizzo, orari, stato |

### 2.4 Configurazione e variabili d'ambiente

- **Sei variabili, tutte facoltative**: il sito parte anche senza. L'elenco commentato è in `.env.example`; in locale si copiano in `.env.local` (che git ignora), in produzione stanno su Vercel → Settings → Environment Variables.

| Variabile | Serve a | Se manca |
|---|---|---|
| `DATABASE_URL` (o `POSTGRES_URL`) | Postgres delle prenotazioni | In locale: database su file in `.data/agenda` (PGlite), che resta fra un riavvio e l'altro. Su Vercel: PGlite in memoria, che si azzera e ha una copia per istanza; l'agenda lo dichiara con una fascia nera |
| `AUTH_SECRET` | Firma del cookie di sessione dell'agenda (`npx auth secret`) | Nessuno entra in `/admin` |
| `ADMIN_PASSWORD` | Password unica dell'agenda | Come sopra |
| `AUTH_URL` | Solo con un dominio diverso da quello di Vercel | Su Vercel si ricava da sola |
| `TELEGRAM_BOT_TOKEN` | Bot che avvisa il titolare | L'avviso resta nei log del server |
| `TELEGRAM_CHAT_ID` | Chat a cui arriva l'avviso | Come sopra |

  `TELEGRAM_API_BASE` esiste solo per le prove in locale: punta l'invio a un finto endpoint invece che a `api.telegram.org`. Anche `AGENDA_DATA_DIR` serve solo alle prove: sposta il database locale in un'altra cartella, per provare l'app senza toccare l'agenda di tutti i giorni.
- **Contenuti e prezzi non sono variabili d'ambiente:** restano costanti in `lib/salone.ts`.
- `next.config.ts:6-8` imposta `turbopack.root` sulla cartella del progetto. Nella home dell'utente c'è un altro `package-lock.json` e senza questa riga Next avvisa a ogni avvio.
- **Porta 3200.** La configurazione per gli strumenti agentici sta in **`C:\Users\foscolo\Parruchieria\.claude\launch.json`**, nella cartella madre: il pannello di anteprima la cerca lì, non in `my-app`. Lancia `npm --prefix my-app run dev -- -p 3200`. La 3200 evita conflitti con gli altri progetti sulla stessa macchina (Woody Pub usa la 3100).

---

## 3. Design system

### 3.1 Colori (`app/globals.css:7-19`)

| Token | Valore | Ruolo |
|---|---|---|
| `ink` | `#0a0a0a` | Nero profondo: hero, menu, footer, bottoni, testo su chiaro |
| `paper` | `#ffffff` | Bianco puro: sfondo delle sezioni chiare, testo su scuro, riempimento dei bottoni |
| `fog` | `#efefed` | Grigio chiaro: sfondo del Listino e dei segnaposto foto |
| `steel` | `#616161` | Testo secondario su chiaro. Contrasto **6,2:1** su bianco |
| `smoke` | `#a3a3a3` | Testo secondario su scuro. Contrasto **7,8:1** su `ink` |

Le linee della griglia non hanno un colore proprio. L'utility `grid-line` (`app/globals.css:90-92`) usa `color-mix(currentColor 12%, transparent)`: la stessa griglia viene grigio chiaro su bianco e grigio scuro su nero.

Il sito **non ha tema scuro alternativo**: `color-scheme: light` (`app/globals.css:22`). Le sezioni scure fanno parte del disegno.

### 3.2 Tipografia (utility in `app/globals.css:54-89`)

| Utility | Definizione | Dove |
|---|---|---|
| `display` | Syne **700**, interlinea 0.92, spaziatura −0.035em, maiuscolo, **`lining-nums`** | Titoli giganti, voci del menu, firma del footer |
| `eyebrow` | Inter 700, 11px, spaziatura **0.22em**, maiuscolo | Testi sopra i titoli (`(01) — CHI SIAMO`), titoletti dei blocchi (DOVE, ORARI, APPUNTAMENTI), bottoni, "Menu" |
| `info` | JetBrains Mono, 12px, **peso 500**, spaziatura **0.05em**, maiuscolo | **Ogni metadato**: blocchi informativi di hero e menu, stato di apertura, tabella orari, sigle "A / B / C" di Chi Siamo, numero e tecnica del portfolio, indirizzo, telefono e Instagram del footer, numeri del menu, barra finale del footer |

**Regola:** un metadato usa `info` così com'è, senza `text-sm`, `text-xs` o `normal-case` sopra. Peso e spaziatura stanno nel token e non si ereditano: così i numeri del menu, che vivono dentro un titolo `display` in grassetto, e i giorni della tabella orari, che sono `<th>`, hanno lo stesso peso di tutto il resto. Le uniche eccezioni sono volute: 11px sotto i 380px nei blocchi informativi di hero e menu (`Hero.tsx:19-22`, `Navbar.tsx:264`), dove a 12px "VIA CA' ROSSA 47/A-B" (156px) supera la colonna (155px a 375), e l'opacità per le righe secondarie. Nello stato di apertura "alle" e l'ora sono uniti da uno spazio unificatore (`lib/orari.ts:44`, `OpenStatus.tsx:39`): se la riga non basta va a capo "alle 14:30" intero. I titoletti dei blocchi del footer restano `eyebrow`: sono titoli, non dati, e in monospazio si confonderebbero con il contenuto. Anche l'handle Instagram è maiuscolo (`@HISTORY_BARBER_DA_FRANCESCO_`): gli handle non distinguono maiuscole e minuscole.

Due scelte non ovvie:
- **Syne a 700 e non a 800.** Misurato: "L'ECCELLENZA" occupa 8,37 em a 700 e 12,33 em a 800. A 800 il titolo della hero su un telefono da 390 px scenderebbe a 27 px (commento in `app/globals.css:51-53`).
- **`lining-nums`.** Syne disegna di serie cifre "old style" che scendono sotto la riga: in "47/A-B" il 47 sembrava più basso delle lettere (`app/globals.css:60-62`).

**Servizi del listino** (brief: "Inter, pulito e leggibile"): nome in Inter 600 (18px mobile / 24px desktop), prezzo in Inter 600 con cifre tabellari, categorie (TAGLIO, BARBA, COMBO) in Inter 800 maiuscolo (`components/PriceList.tsx:29, 52, 61`).

### 3.3 Dimensionamento dei titoli giganti

Ogni titolo gigante è dimensionato sulla **riga più larga**, misurata in em nel browser con Syne 700:

| Titolo | Riga più larga | Misura | Divisore | Dove |
|---|---|---|---|---|
| Hero | "DEL GROOMING" | 8,98 em | 9,2 | `components/Hero.tsx:154` |
| Intestazioni di sezione | "FACCIAMO" | 6,04 em | 6,2 (su 3 colonne da md) | `components/SectionHead.tsx:28` |
| Contatti | "VIA CA' ROSSA" | 7,65 em | 7,85 | `components/Footer.tsx:29` |
| Firma footer | "HISTORY BARBER" | 9,58 em | 9,8 | `components/Footer.tsx:117` |
| Voci del menu | "PORTFOLIO" | 6,49 em | 6,65, meno 3,5rem per il numero | `components/Navbar.tsx:251` |

Formula: `clamp(minimo, calc((100cqi − rientro) / divisore), massimo)`. **`100cqi`** è la larghezza del contenuto della `shell`, che è una container query (`app/globals.css:100-110`). **Non usare `100vw`**: su computer include la barra di scorrimento e a 375 e 629 px mandava a capo "DEL GROOMING" e "VIA CA' ROSSA" (§9.2).

> Se cambi un testo gigante, rimisura la riga più larga e aggiorna il divisore. Il margine lasciato è di circa il 2,5%.

### 3.4 Griglia e layout

- **`shell`** (`app/globals.css:100-110`): larghezza massima 100rem (1600px), padding 1,25rem su mobile e 2,5rem da md, `container-type: inline-size`.
- **`GridLines`** (`components/GridLines.tsx`): linee verticali assolute dentro ogni sezione. Su smartphone una colonna (solo i bordi); da md quattro colonne. I contenuti usano la stessa shell e `grid-cols-4`, rientrati di `pl-3` rispetto alla linea.
- **Breakpoint:** uno solo che conta, `md` = 48rem (768px). `sm` (640px) serve solo nella barra, per passare dal monogramma "HB" al logo completo (`components/Navbar.tsx:208`, §3.6).
- **Altezza della barra:** `--nav-h` vale 4rem su mobile e 4,5rem da md (`app/globals.css:21-32`). È l'unica fonte per la barra e per lo `scroll-margin-top` delle sezioni (`scroll-mt-(--nav-h)`).
- **Ordine delle sezioni e sfondi:**

| Sezione | id | Sfondo |
|---|---|---|
| Hero | `top` | ink |
| Chi Siamo | `chi-siamo` | paper |
| Portfolio | `portfolio` | paper, con filetto sopra |
| Listino | `listino` | fog |
| Contatti (footer) | `contatti` | ink |

### 3.5 Movimento

- Curva unica per GSAP: `expo.out` (`lib/gsap.ts:28`); in CSS lo stesso andamento è `--ease-crisp: cubic-bezier(0.16, 1, 0.3, 1)`.
- La tenda del menu usa `[0.76, 0, 0.24, 1]` (`components/Navbar.tsx:13`).
- Distanza di salita delle entrate: **50px** ovunque (`components/RevealOnScroll.tsx:13`). La hero usa 30px (`components/Hero.tsx:61`).

---

### 3.6 Logo (`components/Logo.tsx`)

- **Cos'è:** monogramma "HB" graziato a lastra, in stile western, con ombra 3D staccata verso il basso a sinistra; a destra "da Francesco" in serif con una linea di registro. È **ridisegnato a mano** dall'unico riferimento disponibile, uno screenshot di 209×33px: proporzioni fedeli, tracciati no. `[DA SOSTITUIRE con il file originale del logo, se esiste]`
- **Tecnica:** SVG in linea, tutto in `currentColor`: prende il colore del testo intorno, quindi nella barra passa da bianco a nero da solo, senza `invert` né `mix-blend`. L'ombra è la stessa forma spostata di (−7, +7) e mascherata dalle lettere allargate di 3 unità; la H è mascherata dove passa la B, così le due lettere si incastrano.
- **Due versioni, una sola SVG** (`variante="adattivo"`): sotto `sm` il contenitore ha rapporto 170/112 e mostra solo il monogramma; da `sm` 327/112 e mostra tutto. La firma sta interamente a destra del monogramma, fuori dalla finestra compatta.
- **Misure:** barra `h-9` (36px, 55×36 il monogramma) → `sm:h-11` (128×44) → `md:h-12` (140×48). Footer `h-12`, bianco.
- **Firma:** `<text>` in Georgia (Times e serif di sistema come riserva), `textLength` 150 con `lengthAdjust="spacing"`: la larghezza è fissa qualunque font arrivi. Non è un font caricato dal sito: su Android esce Noto Serif.
- **Id univoci** con `useId` (disponibile anche nei Server Components, il Footer lo è): le maschere si riferiscono per id e le istanze sono due.

## 4. Architettura

### 4.1 Il modello mentale in una riga

**Un file di dati → una pagina statica → pochi componenti client che animano.** Aggiornare un prezzo significa cambiare `lib/salone.ts` e ricompilare.

### 4.2 Albero dei file

```
my-app/
├── app/
│   ├── layout.tsx          Font, metadata, viewport, <noscript> che riaccende i testi
│   ├── page.tsx            Unica pagina: compone le sezioni, emette il JSON-LD HairSalon
│   ├── globals.css         Token @theme, utility (display, eyebrow, info, grid-line, shell),
│   │                       stati iniziali delle animazioni, rete di sicurezza, reduced motion
│   └── favicon.ico         ⚠️ ancora quella di create-next-app
├── components/
│   ├── SmoothScroll.tsx    ReactLenis root + sincronizzazione col ticker GSAP;
│   │                       hook useVaiASezione per lo scorrimento alle ancore
│   ├── Navbar.tsx          ★ Barra fissa (colore adattivo), hamburger, menu a tutto
│   │                       schermo con varianti framer, trappola del focus (295 righe)
│   ├── BookButton.tsx      ★ Bottone "Prenota": link segnaposto, fermo, riempimento
│   ├── Hero.tsx            Prima schermata: blocchi info, titolo mascherato, sequenza
│   │                       d'entrata, parallasse
│   ├── OpenStatus.tsx      OpenStatus (badge aperto/chiuso) e OrariTable (settimana)
│   ├── ChiSiamo.tsx        Sezione 01: dichiarazione + tre punti fermi
│   ├── Portfolio.tsx       Sezione 02: 8 quadrati a filo con didascalie
│   ├── PriceList.tsx       Sezione 03: tre tabelle (Taglio, Barba, Combo) + CTA
│   ├── Footer.tsx          Sezione 04 "Contatti": indirizzo gigante, orari, contatti, logo, firma
│   ├── SectionHead.tsx     Intestazione di sezione: eyebrow + titolo a righe mascherate
│   ├── RevealOnScroll.tsx  ★ Motore delle entrate allo scroll (non disegna nulla)
│   ├── GridLines.tsx       Linee verticali della griglia
│   ├── BookingWidget.tsx   ★ Prenotazione in tre passi (foglio a tutto schermo)
│   ├── Logo.tsx            Logo "HB da Francesco" in SVG (currentColor), completo o adattivo
│   ├── Photo.tsx           next/image a riempimento (con object-position), o segnaposto a tratteggio
│   ├── SectionLink.tsx     Link interno con scorrimento Lenis (usato da "Torna su")
│   └── icons.tsx           ArrowRight, ArrowUpRight, InstagramGlyph (SVG a mano)
├── app/
│   ├── admin/page.tsx      Agenda: sessione + lettura del giorno, poi passa al client (noindex)
│   ├── admin/azioni.ts     Server Action: salva appuntamento/blocco, elimina (ognuna controlla la sessione)
│   ├── admin/login/page.tsx   Accesso con password (Server Action)
│   ├── api/auth/[...nextauth]/route.ts  Rotte di Auth.js
│   └── api/bookings/route.ts  ★ GET slot liberi · POST nuova prenotazione
├── auth.ts                 Provider Credentials (password unica), sessione JWT
├── auth.config.ts          Parte di configurazione valida anche sul runtime Edge
├── middleware.ts           Guardia davanti a /admin
├── db/schema.ts            ★ Schema SQL (modulo usato dall'app e da db:init): appuntamenti + blocchi, vincolo anti-sovrapposizione
├── scripts/db-init.mjs     npm run db:init — applica lo schema al Postgres di DATABASE_URL
├── components/agenda/      Agenda.tsx, FoglioVoce.tsx (modulo e dettaglio), Calendario.tsx, FoglioInBasso.tsx (<dialog>)
├── .env.example            Le sei variabili, commentate
├── lib/
│   ├── prenotazioni/
│   │   ├── tipi.ts         Interfacce condivise (ServiceOption, BookingSlot, Prenotazione…)
│   │   ├── slot.ts         Algoritmo degli orari (funzioni pure)
│   │   ├── validazione.ts  Controlli stile Zod sul payload
│   │   ├── archivio.ts     Lettura/scrittura di appuntamenti e blocchi (solo SQL)
│   │   ├── db.ts           Sceglie il motore: Postgres, PGlite su file, PGlite in memoria
│   │   ├── agenda.ts       Regole pure dell'agenda: timeline, statistiche, giorni aperti
│   │   ├── validazione-agenda.ts  Controlli sui moduli dell'agenda
│   │   ├── avvisi.ts       Avviso al titolare (Telegram/Resend pronti da scommentare)
│   │   └── telefono.ts     Normalizzazione del numero, condivisa client/server
│   ├── salone.ts           ★ SORGENTE UNICA: dati salone, orari, listino, portfolio, menu
│   ├── orari.ts            Ora di Roma, stato di apertura, formattazione dei turni
│   ├── gsap.ts             Registrazione ScrollTrigger, EASE, prendiInCarico()
│   ├── prenotazione.ts     Evento che collega i bottoni "Prenota" al widget
│   └── utils.ts            cn() e formatoPrezzo() (it-IT, EUR, senza decimali)
├── public/
│   ├── images/hero-sfumatura.webp   Foto della hero (354 KB)
│   └── *.svg               5 SVG del template, NON usati
├── next.config.ts          turbopack.root
├── AGENTS.md / CLAUDE.md   Regole per agenti (CLAUDE.md include AGENTS.md)
├── README.md               ⚠️ boilerplate create-next-app
└── PRODUCTION_BIBLE.md     Questo file
```

Righe di codice in `app/`, `components/`, `lib/` e `next.config.ts`: **1958** in 23 file (misurato con `wc -l`).

### 4.3 Flusso dei dati

```
lib/salone.ts  (salone, orari, ordineSettimana, listino, portfolio, fotoHero, vociMenu)
     │
     ├──► lib/orari.ts ──► OpenStatus / OrariTable   (client: dipendono dall'ora)
     │
     ▼
app/page.tsx   (Server Component)
     ├─ JSON-LD HairSalon, generato dagli stessi `orari`
     └─ <SmoothScroll>                         client: Lenis
          ├─ <Navbar/>                         client
          ├─ <div id="contenuto">              reso inert dal menu aperto
          │    ├─ <main>
          │    │    ├─ <Hero/>                 client
          │    │    ├─ <ChiSiamo/>             server
          │    │    ├─ <Portfolio/>            server
          │    │    └─ <PriceList/>            server (dentro: BookButton client)
          │    └─ <Footer/>                    server (dentro: OpenStatus, BookButton, SectionLink client)
          └─ <RevealOnScroll/>                 client, restituisce null
```

**Confine client/server.** Hanno `"use client"`:
- `components/BookButton.tsx`, `Hero.tsx`, `Navbar.tsx`, `OpenStatus.tsx`, `RevealOnScroll.tsx`, `SectionLink.tsx`, `SmoothScroll.tsx`;
- `lib/gsap.ts`.

Tutto il resto è Server Component. Le sezioni statiche restano sul server e ospitano isole client.

### 4.4 Stato

Non c'è stato globale applicativo: niente Context propri, niente store.

| Stato | Dove | Note |
|---|---|---|
| Istanza Lenis | `ReactLenis root` → `useLenis()` | Condivisa dalla libreria |
| Menu aperto, barra su scuro, pagina in cima | `useState` in `Navbar.tsx:44-46` | — |
| Stato apertura e giorno corrente | `useSyncExternalStore` in `OpenStatus.tsx:23, 58` | Snapshot server `null`/`-1`: niente mismatch d'idratazione |
| Posizione del riempimento del bottone | `useMotionValue` in `BookButton.tsx:35` | Non causa re-render |
| Presa in carico delle animazioni | Attributo DOM `data-animato` | Vedi §4.6 |

### 4.5 I tre motori di animazione, e chi comanda cosa

| Motore | Responsabilità | Dove |
|---|---|---|
| **Lenis** | Scorrimento morbido, `scrollTo` alle ancore, `stop()`/`start()` col menu | `SmoothScroll.tsx`, `Navbar.tsx:100-105` |
| **GSAP + ScrollTrigger** | Sequenza d'entrata della hero, parallasse della foto, entrate allo scroll, cascata del listino | `Hero.tsx`, `RevealOnScroll.tsx` |
| **framer-motion** | Tenda e voci del menu (varianti + `staggerChildren`), riempimento del bottone, apertura del foglio di prenotazione | `Navbar.tsx`, `BookButton.tsx`, `BookingWidget.tsx` |

**Regola 1: un solo `requestAnimationFrame`.** Lenis avanza dal ticker di GSAP (`SmoothScroll.tsx:13-18`, `autoRaf: false`) e ogni scroll aggiorna ScrollTrigger (`SmoothScroll.tsx:20`).

**Regola 2: mai due motori sullo stesso nodo.**
- Nella hero ci sono tre livelli annidati: `data-hero-parallax` (GSAP, scroll), `data-hero-media` (GSAP, zoom d'entrata) e la foto (`Hero.tsx:90-100`).
- Nel bottone, framer muove il link, il riempimento e il testo, ciascuno con il proprio motion value.

**Regola 3: niente classi `translate-*` di Tailwind su nodi animati da JS.** In Tailwind v4 generano la proprietà CSS `translate`, che **si somma** al `transform` scritto da GSAP o framer (§9.1).

### 4.6 Il sistema delle entrate (leggere prima di toccare qualsiasi animazione)

Gli elementi animati partono **nascosti dal CSS**, non da JavaScript, così non compaiono per un istante prima dell'idratazione:

| Marcatore | Stato iniziale (CSS) | Chi lo anima |
|---|---|---|
| `data-reveal` | `opacity: 0` | Fuori dalla hero `RevealOnScroll` (sale di 50px); dentro la hero la sequenza di `Hero.tsx` |
| `data-slide` dentro `data-slide-item` | `opacity: 0; translateY(50px)` | `RevealOnScroll`: cascata del listino, una categoria o una riga per volta |
| `data-mask-line` › `span` | `translateY(105%)` | `"hero"` → `Hero.tsx`; `"scroll"` → `RevealOnScroll` |

Tre protezioni evitano che un testo resti invisibile:
1. **`prendiInCarico()`** (`lib/gsap.ts:43-60`) marca ogni elemento con `data-animato` prima di animarlo. Se l'elemento è già visibile, lo fissa visibile e non lo anima.
2. **Rete di sicurezza CSS** (`app/globals.css:150-161`): gli elementi *senza* `data-animato` compaiono comunque dopo 3 secondi.
3. **`MutationObserver`** in `RevealOnScroll.tsx:105-111`: prende in carico anche gli elementi aggiunti dopo il montaggio (ricaricamento a caldo, contenuti futuri) e poi chiama `ScrollTrigger.refresh()`.

Inoltre:
- **alla pulizia** (`RevealOnScroll.tsx:113-122`, `Hero.tsx:71-75`) si tolgono sia gli stili in linea (`ctx.revert()`) sia il segno `data-animato`, altrimenti l'elemento tornerebbe nascosto e fuori dalla rete di sicurezza;
- **senza JavaScript** interviene il `<noscript>` in `app/layout.tsx:49-51`;
- **con `prefers-reduced-motion`** il blocco in `app/globals.css:163-182` forza tutto visibile con `!important`.

### 4.7 Gestione degli errori

Non ci sono error boundary, logging né telemetria. Le difese sono locali:
- segnaposto dichiarato quando manca una foto (`Photo.tsx:21-35`);
- rete di sicurezza delle entrate (§4.6);
- `svuota()` del bottone non parte se il bottone non è mai stato riempito (`BookButton.tsx:38-43`).

---

## 5. Modello dati (`lib/salone.ts`)

### 5.1 Esportazioni

| Export | Tipo | Contenuto | Righe |
|---|---|---|---|
| `salone` | oggetto `as const` | `nome`, `firma`, `nomeCompleto`, `via`, `cap`, `citta`, `provincia`, `telefono`, `telefonoHref`, `mappeHref`, `instagram`, `instagramHref`, `partitaIva` (vuota) | 12-29 |
| `Turno` | `{ apre: number; chiude: number }` | Minuti dalla mezzanotte | 35 |
| `orari` | `{ giorno, breve, turni: Turno[] }[]` | **Indice = `Date.getDay()`** (0 = domenica). Array `turni` vuoto = chiuso | 39-82 |
| `ordineSettimana` | `number[]` | `[1,2,3,4,5,6,0]`: la tabella parte da lunedì, i calcoli restano su `getDay()` | 86 |
| `Servizio` | `{ id, nome, dettaglio, prezzo, durata, prefisso?, prenotabile? }` | `id` è la chiave usata da API e widget: non cambiarlo dopo la messa in linea. `durata` in minuti ⚠️ **stimata**. `prenotabile: false` = supplemento, non si prenota da solo | 90-105 |
| `operatori` | `Operatore[]` | Oggi solo Francesco; API e agenda ragionano già per operatore | 149-151 |
| `PREAVVISO_MINUTI` | `number` | 60: quanto prima si può prenotare online | 155 |
| `GIORNI_PRENOTABILI` | `number` | 21: fin dove arriva il calendario | 158 |
| `GruppoListino` | `{ id, titolo, servizi }` | Una categoria | 107-111 |
| `listino` | `GruppoListino[]` | ⚠️ **indicativo** | 114-143 |
| `Lavoro` | `{ titolo, tecnica, alt, src? }` | `src` assente = segnaposto | 162-170 |
| `portfolio` | `Lavoro[]` | Nessun `src` compilato | 172-181 |
| `fotoHero` | `{ src?, alt, posizione? }` | `src: "/images/hero-sfumatura.webp"`, `posizione: "60% 50%"`, immagine generata (§5.4) | 189-193 |
| `vociMenu` | `{ id, etichetta }[]` | Gli `id` coincidono con gli `id` delle sezioni | 197-202 |

### 5.2 Conteggi (misurati)

- **3** categorie di listino, **10** servizi (Taglio 5, Barba 2, Combo 3), tra cui 1 supplemento ("Disegno rasato", + 5 €).
- **8** lavori di portfolio, **0** con foto.
- **5** giorni aperti, **10** turni (pausa pranzo 13:00–14:30); sabato chiude alle 19:00.
- **4** voci di menu.

### 5.3 Listino attuale (indicativo)

| Categoria | Servizio | Prezzo |
|---|---|---|
| Taglio | Taglio uomo | 18 € |
| Taglio | Skin fade | 20 € |
| Taglio | Rasatura testa | 15 € |
| Taglio | Taglio bambino (fino a 12 anni) | 13 € |
| Taglio | Disegno rasato | + 5 € |
| Barba | Rifinitura barba | 10 € |
| Barba | Barba completa | 15 € |
| Combo | Taglio + barba | 26 € |
| Combo | Skin fade + barba completa | 32 € |
| Combo | Papà + figlio | 29 € |

Solo "Rasatura della testa" compare su Fresha, e senza prezzo. **Tutto il resto è da validare**, compresa l'esistenza delle combo.

### 5.4 Come si modifica

- **Un servizio:** aggiungi un oggetto a `servizi` del gruppo giusto. La riga, la cascata e il formato del prezzo (`formatoPrezzo`, `lib/utils.ts:5-13`) sono automatici.
- **Una categoria:** aggiungi un `GruppoListino` con `id` univoco. Il titolo è in Inter 800 e non ha un calcolo di larghezza: una parola molto lunga potrebbe andare a capo su mobile.
- **Una foto del portfolio:** metti il file in `public/` (es. `public/images/portfolio/skin-fade.webp`, quadrato, almeno 1000×1000) e compila `src: "/images/portfolio/skin-fade.webp"`. Il segnaposto sparisce da solo.
- **La foto della hero:** oggi `public/images/hero-sfumatura.webp`, 2752×1536, WebP qualità 82, 354 KB. È generata con Higgsfield e convertita con `sharp`: nuca di un uomo con sfumatura e riga rasata, vapore da un panno caldo, bianco e nero. Per sostituirla basta un nuovo file e `fotoHero.src`, con queste regole:
  - almeno 2400px di lato lungo: il contenitore è il 116% dell'altezza della hero (`Hero.tsx:90`);
  - su un telefono in verticale si vede solo una fascia larga circa il 22%: il soggetto va al centro, oppure si sposta la fascia con `fotoHero.posizione` (object-position). Per centrare un soggetto che sta a una frazione *c* della larghezza, x = (c − 0,11) / 0,78. Oggi c = 0,575, quindi x = 60%;
  - dopo il cambio, rimisura il contrasto dei testi (§9.17): il velo è tarato su questa foto;
  - se il rapporto non è 16:9, ricalcola `LARGHEZZA_FOTO` (`Hero.tsx:29`, §9.16);
  - aggiorna `alt`: descrive l'immagine, non il salone.
- **Gli orari:** modifica `turni` del giorno. Badge, tabella, slot di prenotazione e JSON-LD si aggiornano insieme (`app/page.tsx:31-38`).
- **Il telefono:** va cambiato in **tre punti**: `salone.telefono`, `salone.telefonoHref` e `app/page.tsx:21` (JSON-LD, scritto a mano, §11).

---

## 6. Funzionalità

| # | Funzionalità | File | Stato |
|---|---|---|---|
| 6.1 | Barra fissa con colore adattivo | `Navbar.tsx:58-97, 147-214` | ✅ Completa (logo ridisegnato, §3.6) |
| 6.2 | Menu a tutto schermo | `Navbar.tsx:20-41, 216-291` | ✅ Completa |
| 6.3 | Hero | `Hero.tsx` | ⚠️ Foto generata, non reale |
| 6.4 | Stato apertura | `lib/orari.ts`, `OpenStatus.tsx` | ✅ Completa |
| 6.5 | Chi Siamo | `ChiSiamo.tsx` | ⚠️ Testi da validare |
| 6.6 | Portfolio | `Portfolio.tsx` | ⚠️ 8 segnaposto |
| 6.7 | Listino con cascata | `PriceList.tsx`, `RevealOnScroll.tsx:65-82` | ⚠️ Prezzi indicativi |
| 6.8 | Contatti / footer | `Footer.tsx` | ⚠️ P.IVA assente |
| 6.9 | Prenotazione (bottoni + widget + API) | `BookButton.tsx`, `BookingWidget.tsx`, `app/api/bookings`, `lib/prenotazioni/` | 🟠 Funziona; in produzione mancano database e variabili (§11) |
| 6.10 | Scorrimento morbido e ancore | `SmoothScroll.tsx`, `SectionLink.tsx` | ✅ Completa |
| 6.11 | SEO e dati strutturati | `app/layout.tsx:24-39`, `app/page.tsx:17-39` | ⚠️ Parziale |
| 6.12 | Link "Vai al contenuto" | `app/page.tsx:48-53` | ⚠️ Classe inesistente |
| 6.13 | Agenda (navigazione, appuntamenti, blocchi) | `app/admin/`, `components/agenda/` | ✅ Completa in locale |
| 6.14 | App dei clienti (PWA in `/app`) | `public/app/`, `app/api/app/`, `lib/prenotazioni/app.ts` | ✅ Completa, documentata in `docs/app.md` |

**6.1 Barra fissa.**
- **Trasparente** solo con la pagina ferma in cima alla hero (sentinella `data-cima`, `Hero.tsx:107`).
- Altrove è **piena**: nera sopra le sezioni `data-nav-scuro` (hero, footer), bianca sulle altre.
- Il colore dipende da una fascia di 4px a cavallo del bordo inferiore della barra (`Navbar.tsx:77-79`) e si ricalcola al resize.
- A sinistra hamburger, al centro il logo (solo il monogramma "HB" sotto 640px), a destra "Prenota". Il logo segue il colore della barra.

**6.2 Menu.**
- Tenda nera che scende, voci giganti numerate che salgono in sequenza (`staggerChildren` 0,07s dopo 0,3s), blocchi informativi in dissolvenza.
- All'hover le altre voci scendono al 30% (solo su dispositivi con hover).
- Mentre è aperto:
  - `#contenuto` diventa `inert` e Lenis si ferma;
  - Tab gira dentro l'header;
  - Esc chiude e il focus torna all'hamburger.
- Un clic su una voce chiude il menu e *poi* scorre alla sezione (`onExitComplete`, `Navbar.tsx:140-145`), dando il focus alla sezione.

**6.3 Hero.**
- In alto quattro blocchi informativi in monospazio: indirizzo, giorni, telefono, stato. Da md una colonna ciascuno; su mobile due righe da due (indirizzo e stato sopra, giorni e telefono sotto, con `order`), a 11px sotto i 380px perché "VIA CA' ROSSA 47/A-B" non vada a capo sul trattino (`Hero.tsx:19-22`).
- **Distribuzione verticale:** su mobile la shell è `justify-between` con `gap-8` minimo, e lo spazio libero si divide in due fasce uguali sopra e sotto il titolo. Da md `justify-start` e il titolo ha `mt-auto`: titolo e CTA ancorati in basso, come prima (`Hero.tsx:116, 147`).
- Eyebrow, titolo "L'eccellenza / del grooming / maschile" a righe mascherate, testo e CTA "Prenota ora".
- Sequenza d'entrata: linee della griglia, zoom della foto, righe, blocchi (`Hero.tsx:46-62`).
- Parallasse del 12% allo scroll (`Hero.tsx:14, 64-68`).
- **Foto:** immagine generata, una nuca con sfumatura netta e vapore da un panno caldo (bianco e nero). ⚠️ **Non ritrae un cliente del salone**: da sostituire con una foto vera, o da far approvare a Francesco, prima della pubblicazione.
- **Velo:** gradiente dall'alto `ink/80 → ink/45 → ink/90`. L'eyebrow "Barbiere a Mestre" è bianco pieno, non al 70% (§9.17).

**6.4 Stato apertura.** "Aperto ora · Fino alle HH:MM" oppure "Chiuso ora · Riapre oggi/domani/gio alle HH:MM".
- Calcolato sull'**ora di Roma**, non su quella del dispositivo (`lib/orari.ts:19-42`); considera la pausa pranzo (`lib/orari.ts:63-71`).
- Aggiornamento ogni 30 secondi.
- Sul server non viene disegnato: c'è un contenuto invisibile della stessa misura, per evitare salti.
- La tabella degli orari evidenzia il giorno corrente con `aria-current="date"`.

**6.5 Chi Siamo.** Una dichiarazione e tre punti fermi (Solo su appuntamento, Per tutte le età, Prodotti Depot), ciascuno con una sigla "A /", "B /", "C /" in `info` (`ChiSiamo.tsx:58`). I testi si basano solo su quanto emerge da Instagram; **il testo lungo è da far rileggere a Francesco** (`ChiSiamo.tsx:5-6`).

**6.6 Portfolio.**
- 8 quadrati a filo (2 colonne su mobile, 4 da md), zoom 1.05 all'hover.
- Didascalia sovrapposta: numero e tecnica in `info` (12px anche su mobile), titolo in Inter. Con il mouse sale al passaggio; su touch è sempre visibile (`Portfolio.tsx:38`).
- La tecnica è divisa sui " · " e ogni parte è `whitespace-nowrap` (`Portfolio.tsx:44-56`): nei quadrati da mobile si va a capo dopo il punto ("LAMETTA · / LINEA SINGOLA"), mai dentro una parte.
- **Nessuna foto:** segnaposto "FOTO DA INSERIRE".

**6.7 Listino.**
- Tre tabelle semantiche, con `caption` e intestazioni per gli screen reader.
- Righe invertite (nero su bianco) all'hover.
- Cascata allo scroll: ogni categoria e ogni riga entra quando arriva in vista, opacità 0→1 e y 50→0, `stagger` 0,07s; il nome precede il prezzo.
- Si animano i `div[data-slide]` dentro le celle, non le `<tr>` (`PriceList.tsx:7-10`).
- Nota sui prezzi variabili e CTA in fondo.

**6.8 Contatti / footer.**
- Indirizzo gigante; blocchi DOVE (con link "Indicazioni stradali" a Google Maps), ORARI (stato + tabella), APPUNTAMENTI ("Tel. …" e nota come nella hero, Instagram, CTA). Tutti i dati sono in `info`; i titoletti restano `eyebrow`.
- Barra finale con logo, ©, "Rivenditore autorizzato Depot" e "Torna su" (`Footer.tsx:99-109`), più la firma gigante "HISTORY BARBER" tagliata dal bordo.
- La P.IVA compare solo se compilata (`Footer.tsx:103`).

**6.9 Prenotazione: bottoni, widget, API.**

*Il giro completo:* bottone "Prenota" → `apriPrenotazione(origine)` manda un evento sulla finestra (`lib/prenotazione.ts`) → `BookingWidget` apre il foglio → `GET /api/bookings` per gli orari → `POST /api/bookings` per salvare → avviso al titolare → l'appuntamento compare in `/admin`. Nessuna piattaforma esterna, come chiesto dal committente.

*Perché un evento e non un contesto React:* i cinque bottoni sono sparsi in componenti diversi, il widget è uno solo, montato in fondo a `app/page.tsx`. Un evento tiene `BookButton` minuscolo e non obbliga a un provider attorno a tutta la pagina.

**Widget** (`components/BookingWidget.tsx`, client):
- tre passi — servizio, data e ora, dati — dentro un foglio a tutto schermo (colonna centrata da `md`); niente cambio di pagina, niente ricaricamenti;
- passo 1: una scheda per servizio, con categoria, durata e prezzo presi dal listino; i supplementi (`prenotabile: false`) non compaiono;
- passo 2: striscia orizzontale di 22 giorni (i chiusi restano, spenti) e griglia di orari a 3 colonne (4 da `sm`). Gli orari non disponibili restano visibili barrati, con il motivo nel `title`: una giornata piena si vede;
- passo 3: nome, telefono e note, con riepilogo. Il telefono è validato mentre si scrive, con la **stessa funzione del server** (`lib/prenotazioni/telefono.ts`);
- conferma: riepilogo con data, ora, servizio e il telefono del salone per spostare l'appuntamento;
- stati: rotella durante il caricamento degli orari e durante l'invio; messaggi in chiaro per ogni errore;
- accessibilità: `role="dialog"`, `aria-modal`, Esc chiude, Tab gira dentro il foglio, la pagina sotto diventa `inert` e Lenis si ferma (come il menu, §6.2);
- gli orari **non si calcolano nel browser**: arrivano dall'API, che è l'unica a decidere cosa è libero.

**API** (`app/api/bookings/route.ts`):

| | `GET /api/bookings` | `POST /api/bookings` |
|---|---|---|
| Parametri | `date=YYYY-MM-DD` (default: oggi), `servizio=<id>`, `operatore=<id>` | corpo JSON: `servizioId`, `data`, `ora`, `operatoreId?`, `origine?`, `cliente: { nome, telefono, note? }` |
| Risposta | `{ data, giorno, giornoNome, aperto, servizio, slot[], liberi }` | 201 `{ ok, prenotazione }` |
| Errori | 400 data non valida | 400 dati non validi (`campi`), 409 orario appena occupato, 429 troppe richieste, 500 |

- **Algoritmo degli slot** (`lib/prenotazioni/slot.ts`, funzioni pure): dai turni del giorno (`lib/salone.ts`) si generano gli inizi ogni 30 minuti; si scarta chi si sovrappone a un appuntamento, chi è già passato (con 60 minuti di preavviso) e chi non ci starebbe prima della chiusura. Esempio verificato: servizio da 75 minuti di martedì → ultimo orario utile 18:30, 19:00 e 19:30 spenti con motivo `chiusura`.
- **Validazione** (`lib/prenotazioni/validazione.ts`): scritta a mano nello stile di Zod, restituisce o i dati puliti o un errore per campo. Il server **rigenera gli slot** e accetta solo un orario che lui stesso proporrebbe: un payload costruito a mano non entra nella pausa pranzo. Prezzo, durata e nome del servizio vengono dal listino, mai dal client.
- **Freno agli abusi:** 5 POST ogni 10 minuti per indirizzo IP, in memoria. È un argine, non una difesa (§11).

**Avviso al titolare** (`lib/prenotazioni/avvisi.ts`): messaggio su **Telegram** con nome, telefono, servizio, orario e note. Tre scelte da conoscere:
- parte **dopo** la risposta al cliente, con `after()` di `next/server` (`app/api/bookings/route.ts`): il 201 non aspetta Telegram (misurato: 284 ms di risposta);
- `avvisaTitolare` **non lancia mai**: restituisce un esito e scrive nei log. Una prenotazione salvata non può fallire per colpa di un avviso;
- timeout di 5 secondi (`AbortSignal.timeout`), niente `parse_mode`: un nome con caratteri speciali non deve rompere il messaggio.
Senza `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` il messaggio finisce comunque nei log, così non si perde. L'alternativa con Resend è commentata in fondo al file.

**Archivio** (`lib/prenotazioni/archivio.ts`, `lib/prenotazioni/db.ts`). Una tabella sola, `prenotazioni`, con **appuntamenti e blocchi** (colonna `tipo`). Il motore lo sceglie `db.ts`:

| Caso | Motore | Dati |
|---|---|---|
| `DATABASE_URL` presente | Postgres vero (postgres.js) | Persistenti: è la produzione |
| Nessun URL, in locale | PGlite su file in `.data/agenda` (git la ignora) | Restano fra un riavvio e l'altro |
| Nessun URL, su Vercel | PGlite in memoria | Si azzerano: l'agenda lo dice con una fascia nera |

- Il resto del codice vede solo `query(testo, parametri)` con segnaposto `$1, $2…`: le query sono le stesse per i tre motori. La vecchia `Map` in memoria non esiste più.
- Lo schema sta in `db/schema.ts`, un modulo senza import. L'app lo applica da sola a PGlite a ogni avvio (è rieseguibile); `npm run db:init` lo applica al Postgres di `DATABASE_URL` (serve Node 22.18+, che legge i `.ts` da solo). In fondo allo schema ci sono le migrazioni idempotenti dalla prima versione: colonne cliente e servizio facoltative, `tipo`, `modificata_il`. Verificato su un database creato con lo schema vecchio.
- **Il controllo delle sovrapposizioni è nel database**, non nel codice: il vincolo di esclusione `exclude using gist (operatore_id with =, data with =, int4range(inizio, fine) with &&)` è l'unico punto in cui due richieste simultanee non passano entrambe. Vale anche per i blocchi: un blocco non può coprire un cliente, e il sito non propone orari bloccati (`occupatiDelGiorno` li include). La violazione (SQLSTATE `23P01`) diventa `ConflittoOrario`: 409 per il sito, messaggio "Si sovrappone a …" per l'agenda.
- Il vincolo `prenotazioni_appuntamento_completo` impone nome del cliente e servizio agli appuntamenti; i blocchi non hanno cliente.
- La giornata è una colonna `date` e i minuti sono interi: confronti semplici, nessun fuso orario dentro il database (§9.21).

**6.13 Agenda** (`app/admin/page.tsx`, `app/admin/azioni.ts`, `components/agenda/`, `lib/prenotazioni/agenda.ts`).
- **Divisione server/client.** La pagina server controlla la sessione, legge dal database le voci del giorno di `?data=YYYY-MM-DD` (default: oggi) e le passa ad `Agenda` (client). Il client non tiene copie dei dati: statistiche e timeline si calcolano dalle voci ricevute.
- **Navigazione.** Frecce ai lati del giorno: saltano i giorni senza turni in `lib/salone.ts` (oggi domenica e lunedì) con `giornoApertoVicino`. Toccando il giorno si apre un calendario del mese (lunedì in testa, giorni chiusi barrati e disattivati, "Vai a oggi"). Cambiare giorno significa cambiare `?data=`: la pagina server rilegge quel giorno dal database. Il giorno in testata è ottimistico (`useOptimistic`): cambia subito, mentre la timeline resta velata, `inert` e con la rotella finché i dati nuovi non arrivano.
- **Timeline** (`costruisciTimeline`): dentro ogni turno, le voci con la loro durata vera e i buchi spezzati sulla griglia della mezz'ora. Un servizio da 75 minuti è una scheda sola, alta quanto dura, e la riga libera dopo parte dall'orario giusto (es. "10:15 libero · 15 min"). Appuntamenti in nero, blocchi a tratteggio, pausa pranzo come separatore. Una voce fuori orario compare lo stesso: l'agenda non nasconde mai un cliente.
- **Riga libera → foglio "Nuovo".** Interruttore Appuntamento / Pausa-blocco. Per l'appuntamento: inizio (ogni 15 minuti dentro i turni), durata, cliente, servizio (il listino propone durata e prezzo, modificabili; c'è "Altro, fuori listino"), prezzo, telefono facoltativo. Per il blocco: inizio, durata (compresa "fino alla chiusura del turno"), motivo facoltativo con scorciatoie. Un riepilogo sempre visibile mostra l'intervallo, quante mezz'ore copre e l'eventuale sovrapposizione; con una sovrapposizione il bottone è spento.
- **Riga occupata → foglio "Dettaglio".** Servizio, prezzo, telefono cliccabile, nota del cliente, provenienza (sito e bottone, oppure agenda). Da qui **Modifica** (stesso modulo, precompilato: nota del cliente e origine restano) e **Disdici** / **Sblocca**, con conferma.
- **Numeri del giorno** (`statistiche`): appuntamenti, poltrona % e previsto €, calcolati dalle voci del giorno letto. La poltrona è minuti di clienti ÷ (minuti di apertura − minuti bloccati): una pausa voluta non abbassa la percentuale. Sotto, le ore ancora libere.
- **Scritture:** tre Server Action (`salvaAppuntamento`, `salvaBlocco`, `elimina`). Ognuna controlla la sessione per prima cosa (sono endpoint pubblici a tutti gli effetti), valida con `validazione-agenda.ts` e poi chiama `refresh()` di `next/cache`, che ridisegna la pagina nella stessa risposta. Regole diverse dal sito: prezzo e durata li decide Francesco, il telefono è facoltativo, si può scrivere nel passato; l'inizio deve cadere in un turno, la fine può sforare la chiusura.
- **Rete lenta:** durante una scrittura il bottone gira ed è spento, il `fieldset` è disattivato e il foglio non si chiude, quindi un doppio tocco non crea due appuntamenti. Un errore di rete resta nel foglio ("non è stato salvato niente") invece di finire nella pagina d'errore.
- **Tablet in cassa:** ogni 60 secondi, se la scheda è visibile e nessun foglio è aperto, `router.refresh()` rilegge il giorno. Le prenotazioni dal sito compaiono da sole.
- **iPhone:** bersagli di almeno 44px (righe, frecce, bottoni da 48–56px), campi a 16px (niente zoom automatico di iOS), tastiera numerica per il prezzo e telefonica per il numero, margine per la barra home (`safe-area-inset-bottom`).
- **Protezione: Auth.js** (`auth.ts`, `auth.config.ts`, `middleware.ts`). Niente più token nell'indirizzo: chi non ha la sessione finisce su `/admin/login`, dove serve la password di `ADMIN_PASSWORD`. La sessione è un cookie firmato con `AUTH_SECRET` e dura 12 ore; in fondo all'agenda c'è "Esci dall'agenda".
- **Due controlli, non uno:** il middleware ferma la richiesta prima della pagina, e la pagina ricontrolla la sessione con `auth()`. Se un domani il matcher del middleware cambiasse, l'agenda resterebbe comunque chiusa.
- **Password confrontata a tempo costante** (`timingSafeEqual`, `auth.ts`): un `===` esce al primo carattere diverso e, misurando i tempi, lascerebbe indovinare la password un pezzo alla volta.
- Senza `ADMIN_PASSWORD`/`AUTH_SECRET` la pagina di accesso lo dice chiaramente invece di lasciare entrare.

*I bottoni:*
- Micro-interazioni (solo mouse). **Il bottone non si sposta**: il magnetismo del brief v2 è stato tolto su richiesta, e con lui `ATTRAZIONE`, `useSpring` e `useTransform`. Il contenitore è un `<a>` semplice; l'unica parte animata è il riempimento.
  - riempimento bianco dal basso, 0,55s; uscendo, il bianco prosegue verso l'alto;
  - testo in `mix-blend-difference`, che si inverte pixel per pixel.
- Da tastiera il focus attiva il riempimento.
- `data-prenota` riporta l'origine, utile per un futuro tracciamento.

**6.10 Scorrimento morbido e ancore.**
- Lenis `lerp` 0,1 e `scrollTo` con `force` e `duration` 1,4 (`SmoothScroll.tsx:45`).
- L'offset della barra arriva **solo** dallo `scroll-margin-top` delle sezioni, che Lenis legge.
- Dopo lo scorrimento l'hash viene aggiornato con `replaceState` e il focus va alla sezione (`tabIndex={-1}`).
- Senza JavaScript i link restano ancore native.

**6.11 SEO e dati strutturati.**
- `lang="it"`, title, description, Open Graph testuale, `themeColor`.
- JSON-LD `HairSalon` (schema.org non ha un tipo "BarberShop") con indirizzo, telefono, Instagram e orari derivati.
- `addressLocality` è "Venezia" (comune) e non "Mestre" (`app/page.tsx:26`).
- **Mancano:** immagine Open Graph, `metadataBase`, favicon propria, `robots`/`sitemap`, dominio.

**6.12 Link "Vai al contenuto."** Il link per saltare la navigazione esiste, ma usa la classe `label`, che non esiste più (rinominata in `eyebrow`/`info`, `app/page.tsx:50`). Funziona, ma senza lo stile previsto.

---

## 7. Accessibilità e responsive

- **Contrasti:** testo principale nero su bianco e bianco su nero; secondari 6,2:1 e 7,8:1 (§3.1). Il testo sopra la foto della hero ha un velo sfumato (`Hero.tsx:101-105`), dimensionato su una misura (§9.17).
- **Bersagli tattili:** ≥ 44px su hamburger, logo, link di footer e bottoni (`min-h-11`, `min-h-14`).
- **Focus:**
  - anello unico `2px currentColor` (`app/globals.css:185-188`);
  - riempimento dei bottoni al focus da tastiera;
  - focus alla sezione dopo la navigazione, e di ritorno all'hamburger dopo la chiusura del menu.
- **Menu:** `aria-expanded` + `aria-controls`, `inert` sul contenuto, trappola del Tab, Esc. È un pattern "disclosure", non un `role="dialog"`: il bottone di chiusura sta nella barra, fuori dall'overlay.
- **Semantica:**
  - un solo `h1`, sezioni con `aria-labelledby`, tabelle del listino con `caption` e `th scope`, `address` nel footer;
  - SVG decorativi con `aria-hidden`;
  - stato di apertura in `aria-live="polite"`.
- **Movimento ridotto:**
  - CSS che mostra tutto e azzera le durate (`app/globals.css:163-182`);
  - GSAP non parte (`prefersReducedMotion()`);
  - framer: riempimento istantaneo (`BookButton.tsx:36`);
  - Lenis rispetta la preferenza di suo (`respectReducedMotion`, default della libreria).
- **Senza JavaScript:** tutti i testi visibili (`<noscript>`); ancore native; badge di apertura invisibile (dipende dall'ora del browser); il menu non si apre.
- **Responsive:**
  - hero ad altezza `100svh`, con minimo 38rem, e non `100vh`, per non soffrire la barra degli indirizzi dei browser mobili;
  - griglia a una colonna su smartphone;
  - titoli su `clamp()` + `cqi`;
  - listino a due colonne (servizio | prezzo) leggibile in verticale; prezzi `whitespace-nowrap`.

---

## 8. Performance

### 8.1 Misure sulla build di produzione (25/09/2026)

La home resta **statica** (`○ /`, `○ /_not-found`); il modulo di prenotazione aggiunge due rotte **dinamiche**, `ƒ /admin` e `ƒ /api/bookings`, che girano a ogni richiesta e non finiscono nel peso della home.

| Risorsa | Peso | gzip |
|---|---|---|
| HTML della home (`index.html`) | 95,5 KB | 14,0 KB |
| CSS (1 file) | 41,6 KB | 8,7 KB |
| JavaScript statico (10 file) | 874 KB | **282 KB** |
| ↳ blocco con gsap + ScrollTrigger + lenis + framer-motion | 321 KB | 113 KB |
| ↳ react-dom | 224 KB | 70 KB |
| ↳ pagina e componenti del sito | 174 KB | 46 KB |
| ↳ runtime Next e resto | 155 KB | 53 KB |
| Font nella build (16 woff2, subset) | 357 KB | — (già compressi) |
| Foto della hero (`public/images/hero-sfumatura.webp`) | 354 KB | — (servita ridimensionata da `next/image`) |

Rispetto alla misura del 17 settembre: +10 KB di HTML, +9 KB di CSS e +6 KB di JavaScript gzip, cioè il costo del widget di prenotazione. Il blocco da 113 KB resta il candidato principale a una dieta: `LazyMotion` + `m` di framer-motion (§11).

### 8.2 Strategia

- **LCP.** Probabilmente la foto della hero `[NON MISURATO]`: è `preload`, e `sizes` dichiara la larghezza a cui è davvero disegnata (§9.16). Il browser scarica la variante da 1920px sia su un telefono a 390px (DPR 1) sia su desktop 1440×900. A DPR 3 un telefono chiede la variante più grande, e Next non ingrandisce oltre i 2752px dell'originale.
- **Possibile risparmio:** su mobile si vede solo il 22% centrale della foto. Un ritaglio verticale dedicato (`<picture>` con `getImageProps`) peserebbe circa 4 volte meno. Non fatto: servirebbe un secondo file e `fotoHero` ne prevede uno.
- **Font** self-hosted da `next/font`, con fallback metrico generato da Next per evitare salti.
- **Niente livelli fissi a tutto schermo:** le linee della griglia stanno dentro le sezioni (`GridLines.tsx:3-10`).
- **`will-change` solo da md** (`Hero.tsx:91`). Regola ereditata da Al Distributore: su iOS lo zoom a pizzico ri-rasterizza i livelli promossi e la memoria cresce fino alla chiusura della scheda. `[NON MISURATO SU QUESTO PROGETTO]`.
- **Motion values** di framer: il riempimento del bottone non causa re-render React.
- **Un solo ciclo rAF** per Lenis e GSAP (§4.5).

---

## 9. Ottimizzazioni e trappole non ovvie (non rimuovere senza leggere)

**9.1 Tailwind v4 `translate-*` + transform da JavaScript.**
- In v4 le classi `translate-*` scrivono la proprietà `translate`, che si **somma** al `transform` di framer/GSAP.
- Il riempimento del bottone partiva da `translate-y-[101%]` e framer lo portava a `translateY(0)`: somma 101%, bottone mai bianco durante l'hover e bianco *dopo* l'uscita.
- Ora la posizione è solo un motion value (`BookButton.tsx:32-37`).

**9.2 `100vw` include la barra di scorrimento.**
- Con barre classiche (Windows, finestre strette) a 375 e 629 px "DEL GROOMING" e "VIA CA' ROSSA" andavano a capo; "FACCIAMO" e la firma uscivano di 2–7 px.
- Da qui `100cqi` e la shell come container (`app/globals.css:94-101`).
- Effetto collaterale: il contenimento rende la shell il riferimento per eventuali `position: fixed` al suo interno. Oggi non ce ne sono: il menu fisso sta nell'`header`, fuori dalle shell.

**9.3 La firma del footer ha la dimensione sullo `span`.** `100cqi` si misura sul contenitore *antenato*, e il `<p>` è esso stesso una shell (`Footer.tsx:112-120`).

**9.4 Testi invisibili dopo il ricaricamento a caldo.** Le entrate erano preparate una sola volta al montaggio: gli elementi sostituiti restavano nascosti dal CSS (visto in sviluppo su listino, titolo della hero e "Chi siamo"). Rimedi in §4.6: `MutationObserver`, `data-animato`, rete di sicurezza. **Togliere uno solo dei tre riapre il problema.**

**9.5 Maschere e accenti.** Con interlinea 0.92, `overflow: hidden` tagliava gli accenti (PIÙ, CIÒ). Ogni riga mascherata ha `pt-[0.12em]` e `-mt-[0.12em]` (`SectionHead.tsx:31-33`).

**9.6 GSAP e la traslazione di partenza.** Il CSS parte da `translateY(105%)`. I tween dichiarano `{ y: 0, yPercent: 105 }`, altrimenti GSAP legge la traslazione come pixel e la somma (`Hero.tsx:50-59`).

**9.7 `<tr>` non si trasforma in modo affidabile.** Si animano i contenitori nelle celle (`PriceList.tsx:7-10`).

**9.8 Barra trasparente solo in cima.** Trasparente sopra il footer, faceva scorrere "VIA CA' ROSSA" sotto le voci della barra.

**9.9 Fascia di osservazione della barra a cavallo del bordo (±2px).** Con una fascia tutta sopra il bordo, dopo un clic su "Contatti" la barra restava bianca sopra il footer nero.

**9.10 `svuota()` con guardia.** Il `blur` di un bottone mai riempito farebbe attraversare il bianco da sotto a sopra: un lampo (`BookButton.tsx:38-43`).

**9.11 `useSyncExternalStore` per l'ora.**
- L'ora non esiste sul server: lo snapshot server è `null`, così HTML statico e primo render coincidono.
- Lo stato è serializzato in stringa perché il confronto avviene per identità (`OpenStatus.tsx:17-20`).

**9.12 Hero a tre livelli.** Parallasse, zoom e foto su nodi diversi (§4.5).

**9.13 `isolate` sul bottone.** Senza gruppo isolato il `mix-blend-difference` del testo si fonderebbe con lo sfondo della pagina, non con quello del bottone.

**9.14 `turbopack.root`.** Senza, Next risale fino alla home dell'utente per via di un altro `package-lock.json`.

**9.15 Numeri di Syne.** `lining-nums` nella utility `display` (§3.2).

**9.16 `sizes` della foto della hero non è `100vw`.**
- La foto è in `object-cover` dentro un contenitore alto il 116% della hero. Su qualsiasi schermo meno largo di 2,1:1 comanda l'altezza: una foto 16:9 è disegnata larga 1,16 × 16/9 ≈ **2,08 volte l'altezza** della hero.
- Con `sizes="100vw"` un telefono a 390px sceglieva la variante da 640px e la allargava fino a 1755px: foto sgranata (misurato).
- Ora `sizes="(min-aspect-ratio: 21/10) 100vw, 208vh"` (`Hero.tsx:29`). Va ricalcolato se cambia il rapporto della foto o l'altezza del contenitore.
- Limite noto: sotto i 608px di altezza (38rem, telefoni in orizzontale) la hero non scende oltre e la foto è disegnata un po' più larga di `208vh`.

**9.17 Il velo della hero è tarato su una misura.**
- Metodo: Chrome headless, testi nascosti, luminanza del fondo nel riquadro di ogni testo; si prende il 95° percentile (il punto più chiaro dietro il testo) e si calcola il contrasto col bianco, tenendo conto dell'opacità del testo. Soglie WCAG: 4,5:1 per il testo normale, 3:1 per il titolo.
- Con il velo precedente (`ink/75 → ink/25 → ink/85`) e la nuova foto: eyebrow 3,0:1 su mobile, prima riga del titolo 2,9:1 su desktop, dove passano sopra la nuca illuminata.
- Ora il velo è `ink/80 → ink/45 → ink/90` e l'eyebrow è bianco pieno. Peggiori valori a 375, 390 e 1440px: eyebrow 5,0:1, titolo 4,8:1, testi informativi ≥ 6:1, paragrafo ≥ 7,4:1. Tutti sopra soglia.
- **Cambiando foto la misura va rifatta.** Un velo più leggero ridà mordente alla foto, ma solo se i numeri lo permettono.

**9.18 Il logo e gli stili ereditati.**
- Il `<text>` della firma eredita `text-transform` e `letter-spacing` dal contenitore: nella barra "info" del footer usciva "DA FRANCESCO". Per questo la `<svg>` azzera `normal-case`, `tracking-normal`, `font-normal` e `not-italic` (`Logo.tsx`). `font-family` e `font-size` sono attributi del `<text>` e non si ereditano.
- `max-w-none` sulla `<svg>` è necessario: il preflight di Tailwind limita le svg al contenitore, e la versione compatta verrebbe schiacciata invece che ritagliata.
- Non duplicare il logo con due `<svg>` e `hidden`: le maschere dentro un elemento `display: none` in alcuni browser non si disegnano, e l'id della prima istanza vince sulle altre.

**9.21 Postgres: tre dettagli che mordono.**
- **La colonna `date` non va letta come oggetto data.** postgres.js la convertirebbe in un `Date` a mezzanotte locale: riportato a ISO in UTC, per chi sta a est di Greenwich diventa **il giorno prima**. Le query chiedono `to_char(data, 'YYYY-MM-DD')` e il codice tratta la giornata come stringa (`lib/prenotazioni/archivio.ts`).
- **`prepare: false`** nella connessione (`lib/prenotazioni/db.ts`): i connection pooler in modalità transazione (PgBouncer di Supabase, pooler di Neon) non reggono gli statement preparati e la seconda richiesta fallirebbe.
- **Niente "prima leggo, poi scrivo"** per evitare le sovrapposizioni: due richieste simultanee leggerebbero entrambe "libero". L'inserimento va diretto e a dire di no è il vincolo di esclusione del database.

**9.22 Auth.js su due runtime.**
- La configurazione è divisa: `auth.config.ts` (pagine, sessione, callback) vale anche sul runtime **Edge** del middleware; `auth.ts` aggiunge il provider Credentials, che usa `node:crypto` e sull'Edge non girerebbe.
- Il middleware deve esportare una **funzione riconoscibile staticamente**: `export const { auth: middleware } = NextAuth(...)` fa fallire la build con "must export a function". Serve `export default auth`.
- `trustHost: true`: senza, Auth.js rifiuta le richieste da host che non riconosce (porte diverse in locale, anteprime di Vercel).

**9.23 Agenda: sette cose da sapere prima di toccarla.**
- **Un solo processo per cartella PGlite.** Il database locale è una cartella (`.data/agenda`) che va aperta da un solo processo alla volta: due server sulla stessa cartella (un `next dev` più un `next start`, o due `next dev`) la rovinano. Per un secondo server di prova serve `AGENDA_DATA_DIR` con un'altra cartella. L'istanza sta su `globalThis`, così il ricaricamento a caldo non ne apre una seconda.
- **I fogli sono `<dialog>` nativi** aperti con `showModal()` (`FoglioInBasso.tsx`): trappola del focus, Esc e sfondo inerte li dà il browser. Esc passa da `onCancel` con `preventDefault`, perché lo stato è di React. Il blocco dello scorrimento sotto va fatto a mano, perché iOS non lo fa. L'entrata usa `@starting-style` (variante `starting:` di Tailwind): dove manca, il foglio appare senza animazione.
- **Niente componenti definiti dentro il render.** La regola del React Compiler li segnala, perché si ricreerebbero a ogni render: `Freccia`, `FrecciaGiorno` e `Tendina` stanno fuori.
- **`refresh()` e non `revalidatePath()`.** La pagina è `force-dynamic` e non c'è cache da invalidare: serve solo ridisegnare la rotta corrente con i dati nuovi, nella stessa risposta della Server Action.
- **Il foglio segue la voce per id**, non per copia: dopo un `refresh` il dettaglio mostra i dati nuovi. Se la voce è sparita (disdetta da un altro dispositivo), il foglio si chiude da solo.
- **Corpo del foglio con `flex: 1 1 auto`, mai `flex-1`** (`FoglioInBasso.tsx`). Il `<dialog>` ha solo un'altezza massima, non un'altezza definita: in una colonna flex così, Safari/WebKit legge la base 0% di `flex-1` come zero. Il corpo si riduce al suo padding e sull'iPhone il foglio resta "a metà": testata, 40px di campi, bottone. In Chrome non si vede. Riprodotto in Chrome forzando la base a 0px: foglio alto 207px su 740.
- **Tastiera e sviluppo dal telefono.** La tastiera riduce solo il `visualViewport`: il foglio ne legge le misure e si appoggia sopra i tasti. Il campo attivo scorre in vista dopo il rendering, non dentro l'evento. Aprendo `next dev` dall'IP di rete (hotspot dell'iPhone, 172.20.10.x) Next 16 blocca le risorse di sviluppo e React non parte: `allowedDevOrigins` in `next.config.ts` elenca gli IP del computer, letti all'avvio.

**9.24 Notifiche sul telefono (Web Push, 27/09).**
- A ogni prenotazione dal sito `notificaPrenotazione` (`lib/prenotazioni/notifiche.ts`) manda una notifica a tutti i dispositivi in `iscrizioni_push`, in `after()` insieme a Telegram. Non lancia mai: una notifica fallita non tocca la prenotazione. Gli appuntamenti inseriti dall'agenda non notificano.
- Il dispositivo si iscrive dal riquadro "Notifiche delle prenotazioni" in fondo all'agenda (`components/agenda/Notifiche.tsx`), tramite tre Server Action che controllano la sessione (`attivaNotifiche`, `disattivaNotifiche`, `notificaDiProva`). Il permesso va chiesto dentro il tocco, prima di ogni `await`: Safari lo nega altrimenti.
- **iPhone:** iOS 16.4+, e solo con l'agenda aggiunta alla schermata Home da Safari (manifest `public/agenda/manifest.webmanifest`, `display: standalone`, scope `/admin`; metadati in `app/admin/layout.tsx`). Serve HTTPS: si prova sul sito online, non su `http://172.20.10.x`.
- Service worker `public/sw-agenda.js`, scope `/admin`: mostra la notifica e al tocco apre l'agenda sul giorno della prenotazione. Nessuna cache, di proposito.
- Chiavi `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` in `.env.local` e su Vercel (produzione). Cambiarle invalida le iscrizioni esistenti. Un 404/410 dal servizio di notifiche cancella l'iscrizione da solo.
- Verificato con un finto servizio di notifiche in HTTPS: messaggio cifrato (aes128gcm) e firmato VAPID, decifrato con testo, giorno e link giusti; TTL 24 h, urgenza alta; il 410 cancella l'iscrizione; la prenotazione resta 201 anche quando l'invio fallisce. Non verificato su un iPhone vero.

**9.20 Prenotazioni: le tre trappole del modulo.**
- **Il freno agli abusi vive ancora in memoria.** L'archivio è passato a Postgres, ma il conteggio dei 5 POST ogni 10 minuti sta nel processo: su Vercel ogni istanza ha il suo, quindi il limite vero è più alto. Per un limite serio serve un contatore condiviso (Vercel KV, Upstash).
- **L'ora è quella di Roma, non quella del cliente.** Slot, "passato" e giorno corrente passano da `oraDiRoma()` (`lib/orari.ts`). Un cliente a Londra vede gli orari del salone, non i suoi. Il giorno della settimana di una data ISO si ricava a mezzogiorno UTC (`giornoDellaData`), che cade nello stesso giorno sia con l'ora solare sia con quella legale.
- **Niente `setState` dentro un effetto.** La regola `react-hooks/set-state-in-effect` (React Compiler) blocca il pattern "effetto che carica e aggiorna": nel widget gli orari si chiedono dalle azioni (`caricaOrari` in `scegliServizio` e `scegliGiorno`), e l'unico effetto rimasto annulla la richiesta in corso allo smontaggio.

**9.19 "Font pixelato" nei metadati: cosa era e cosa non era.**
- Il font disegnato è **JetBrains Mono, web font di next/font**, verificato con `CSS.getPlatformFontsForNode` su hero, menu e footer; nessun font di sistema di riserva, nessun `filter` né `text-shadow`.
- Le frange colorate negli screenshot sono l'antialiasing ClearType di Windows (subpixel), che riguarda tutto il testo del sito. La grana "a pixel" viene dal pannello di anteprima, che mostra la vista da 375px rimpicciolita al 75% circa: lo screenshot della hero è largo 252px per un blocco che nella pagina ne misura 335.
- Sui telefoni (densità 2–3x, antialiasing in scala di grigi) il problema non c'è: ritagli a 3x verificati a 375 e 390px.
- Il peso 500 aiuta comunque: a 11–12px il tratto più spesso regge meglio anche su schermi a bassa densità.
- **Diagnosi completa** (richiesta come "hard fix"):
  - nessun `tailwind.config`, nessun `@font-face` scritto a mano, nessun file di font in `public/`;
  - l'unico font monospazio è `JetBrains_Mono` di `next/font/google` (`app/layout.tsx`), esposto come `--font-jetbrains-mono` e mappato su `--font-mono` nel `@theme`;
  - `CSS.getMatchedStylesForNode` su indirizzo della hero, indice del menu, giorno e © del footer: l'unica regola che imposta il font è `.info`;
  - `document.fonts` registra anche "__nextjs-Geist Mono": è del pulsante "N" di Next in sviluppo, non viene mai caricato e in produzione non esiste.
- **Protezione aggiunta:** in `info` `font-family` è `!important` (`app/globals.css`).
- **Zero barrato non disponibile:** `font-feature-settings: "zero"` non ha effetto. Il file latin di JetBrains Mono servito da Google Fonts ha solo le varianti `calt ccmp frac locl` (letto dalla tabella GSUB del woff2). Per lo zero barrato servirebbe la versione ufficiale del font, caricata con `next/font/local`.

---

## 10. Verifiche eseguite (17/09/2026)

| Verifica | Esito |
|---|---|
| `npx tsc --noEmit` | ✅ Pulito |
| `npm run lint` (ESLint 9, config flat) | ✅ Uscita 0, nessun avviso |
| `npm run build` | ✅ 2 pagine statiche |
| Titoli giganti con barre di scorrimento visibili: 360, 375, 414, 629, 700, 768, 900, 1024, 1280, 1440, 1920 px | ✅ Tutti su una riga, dentro la shell, nessuno scroll orizzontale |
| Emulazione mobile 360 e 390 px | ✅ Come sopra |
| Menu: apertura, stagger, `inert`, Lenis fermo, 10 Tab restano nell'header, Esc riporta il focus | ✅ |
| Voce "Listino" → sezione a 72px dall'alto (= `--nav-h` desktop), hash aggiornato, focus alla sezione | ✅ |
| Mobile 390 px: le 4 voci stanno nello schermo (ultima a 537/844 px), "Contatti" → 64px, barra nera | ✅ |
| Bottone: fermo durante l'hover (stesso rettangolo prima e dopo, `transform: none`), riempimento, uscita verso l'alto senza lampi, clic senza cambio di hash né scroll | ✅ |
| Hero mobile a 360×740, 375×667, 390×844, 430×932: tre blocchi distribuiti (a 390: informazioni 64–213, titolo 367–503, CTA 657–820), nessuno scroll orizzontale, indirizzo su una riga | ✅ |
| Hero desktop 1440×900: disposizione identica a prima (confronto a vista) | ✅ |
| Foto della hero: variante 1920 scelta a 390×844 e 1440×900, nessun errore in console | ✅ |
| Seconda revisione: `tsc`, `lint` e `build` puliti | ✅ |
| Barra a 375 / 390 / 640 / 768 / 1440px: logo 55×36 / 55×36 / 128×44 / 140×48 / 140×48, nessuna sovrapposizione con hamburger e "Prenota", nessuno scroll orizzontale | ✅ |
| Logo su barra scura, chiara, a menu aperto e nel footer; firma in minuscolo anche dentro "info" | ✅ |
| Metadati di Chi Siamo, Portfolio e Footer tutti a 12px | ✅ |
| Terza revisione, metadati di hero, menu e footer a 375 e 390px (densità 3x) e 1440px: font disegnato JetBrains Mono (web), peso 500, spaziatura 0,05em, maiuscolo, nessun filtro né ombra, nessuno scroll orizzontale | ✅ |
| Righe: tabella orari su una riga a 375px, indirizzo su una riga, stato "RIAPRE OGGI / ALLE 14:30" su due righe a 375 e 390px (voluto) | ✅ |
| `tsc`, `lint`, `build` dopo la terza revisione | ✅ |
| Modulo prenotazioni: `tsc`, `lint`, `build` (`/` statica, `/admin` e `/api/bookings` dinamiche) | ✅ |
| `GET /api/bookings`: giorno chiuso → `aperto: false`, 0 slot; servizio da 75 min → ultimo orario 18:30 e 19:00/19:30 con motivo `chiusura`; oggi alle 22:38 → tutti `passato`; `date=pippo` → 400 | ✅ |
| `POST /api/bookings`: prenotazione valida → 201; stesso orario → rifiutato ("Orario appena occupato"); telefono "123" e nome "L" → 400 con due errori di campo; orario in pausa pranzo → 400; supplemento → 400; sesta richiesta ravvicinata → 429 | ✅ |
| `GET` dopo la prenotazione: 10:00 e 10:30 diventano `occupato` (servizio da 50 minuti) | ✅ |
| Widget su mobile 390px: apertura dal bottone della hero, scelta servizio, giorno, orario, errore del telefono mentre si scrive, conferma, riepilogo finale | ✅ |
| Giornata senza orari liberi: messaggio dedicato con il telefono del salone | ✅ |
| Agenda `/admin` su 1024px: appuntamento, righe "in corso", "Pausa", "Libero", contatori (1 appuntamento, 13% poltrona, 32 €) | ✅ |
| **In produzione** dopo il deploy del 17/09: home 200, `GET /api/bookings` con 18 orari liberi, `POST` incompleto → 400 con quattro errori di campo, `POST` valido → 201 e l'orario risulta occupato alle richieste successive | ✅ |
| **In produzione** `/admin` senza chiave → "Agenda riservata"; con chiave → agenda del giorno | ✅ |
| **Riestrazione del 25/09:** 95 riferimenti `file:riga` del documento controllati uno per uno con uno script; 0 file mancanti, 18 numeri di riga corretti perché il codice si era spostato | ✅ |
| **Riestrazione del 25/09:** `tsc`, `lint`, `build` ripetuti, misure di §8.1 rifatte, produzione raggiungibile (home e API 200) | ✅ |
| **Schema SQL su un Postgres vero** (PGlite in processo): schema applicato e rieseguibile, sovrapposizione rifiutata con `23P01`, appuntamenti attaccati (10:50 dopo 10:00–10:50) accettati, stesso orario su altro operatore o altro giorno accettato, `fine <= inizio` e orari oltre la mezzanotte rifiutati dai check, indice `prenotazioni_giorno` usato dal piano di query | ✅ |
| **API contro il database** (Postgres su porta TCP): `npm run db:init` applica lo schema, `POST` salva (201), il secondo `POST` sullo stesso orario viene rifiutato, `GET` mostra gli slot occupati, l'agenda legge le righe salvate, la data resta 2026-09-29 senza slittare di un giorno | ✅ |
| **Accesso all'agenda:** `/admin` senza sessione → `/admin/login`; password sbagliata → "Password sbagliata."; password giusta → agenda; "Esci" → di nuovo login | ✅ |
| **Avviso Telegram** verso un finto endpoint: messaggio completo (cliente, telefono, servizio, orario, note), risposta al cliente in 284 ms; con l'endpoint spento la prenotazione resta 201 e l'errore finisce nei log con tutto il messaggio | ✅ |
| **Widget** dal sito con database e avvisi attivi: prenotazione completata fino alla schermata di conferma | ✅ |
| **Agenda interattiva (26/09)**, build di produzione su server isolato, vista iPhone 375×812. Accesso. Nuovo appuntamento da riga libera: con un servizio da 75 min durata e prezzo si compilano, il riepilogo dice "occupa 3 mezz'ore", compaiono la scheda 09:00–10:15 e la riga "10:15 libero · 15 min". Blocco "Commissione". Conflitto con il blocco segnalato e bottone spento. Modifica della durata: 1 h 30 in conflitto → spento, 1 h → salvato. Sblocco con conferma. Statistiche aggiornate a ogni passo: 14% → 15% col blocco → 12% | ✅ |
| **Stato di caricamento:** subito dopo il tocco il bottone dice "Salvataggio…" ed è spento; il foglio si chiude a salvataggio finito | ✅ |
| **Navigazione:** da sabato 26 la freccia avanti porta a martedì 29 (domenica e lunedì saltati), quella indietro riporta a sabato. Nel calendario di settembre 2026 sono disattivati 6, 7, 13, 14, 20, 21, 27 e 28; in ottobre il 3 apre `?data=2026-10-03` | ✅ |
| **Persistenza:** blocco e prenotazione dal sito ancora presenti dopo il riavvio del server (PGlite su file) | ✅ |
| **Sito e blocchi:** con un blocco 10:00–11:00, `GET /api/bookings` segna 10:00 e 10:30 "occupato"; una prenotazione dal sito compare in agenda con nota e bottone d'origine | ✅ |
| **Vincoli su PGlite:** sovrapposizione blocco/appuntamento → `23P01`; appuntamento senza cliente → `23514`. Migrazione da un database con lo schema vecchio: righe conservate, blocchi accettati | ✅ |
| Contrasto dei testi della hero sopra la nuova foto (§9.17): 15 testi su 15 sopra soglia a 375, 390 e 1440px | ✅ |
| Bottone su fondo chiaro: bianco con bordo nero | ✅ |
| Cascata del listino: opacità scaglionate a metà animazione (0,70 / 0,55 / 0,36 / 0,10 / 0 / 0), 23 elementi su 23 visibili alla fine | ✅ |
| Movimento ridotto: 0 elementi nascosti | ✅ |
| Simulazione del ricaricamento a caldo (righe, titolo e paragrafo sostituiti) e di un elemento "orfano" | ✅ Presi in carico / mostrato dalla rete di sicurezza |
| Console del browser | ✅ Nessun errore |

**Come:** Chrome headless pilotato via DevTools Protocol, con script temporanei della sessione che **non sono nel progetto**, più il pannello browser dell'app.

**Non verificato:**
- Safari (iOS e macOS), Firefox e dispositivi fisici Android/iOS;
- Lighthouse e Core Web Vitals reali;
- screen reader;
- memoria su iOS con zoom a pizzico.

**Non esiste nessun test automatico** nel progetto (§11).

---

## 11. Debito noto e rischi

Ordinati per urgenza.

### 🔴 Bloccanti per la pubblicazione

1. **Prezzi e servizi inventati** → `lib/salone.ts` (`listino`). Da far confermare a Francesco, voce per voce; poi `LISTINO_CONFERMATO = true` toglie la scritta "indicativi" da sito e app. Da chiedergli anche se lavora nei festivi (`CHIUSO_NEI_FESTIVI`, oggi `true`).
2. **Foto non reali.** La hero usa un'immagine generata con Higgsfield (`public/images/hero-sfumatura.webp`), che mostra una persona inventata e non un cliente del salone: su un sito commerciale va sostituita con una foto vera, o almeno fatta approvare a Francesco. Gli 8 lavori del portfolio sono ancora segnaposto (`lib/salone.ts:172-181`).
3. **P.IVA mancante** → `lib/salone.ts:28`. Obbligatoria sul sito di un'attività italiana.
4. **Testi di "Chi siamo" da validare** → `components/ChiSiamo.tsx:7-23, 38-44`.
5. **Prenotazione inesistente** → `lib/prenotazione.ts`. Voluto, ma finché resta così i 5 bottoni "Prenota" non portano da nessuna parte e il telefono è l'unico canale.

### 🔴 Bloccanti per l'uso vero delle prenotazioni

6. **Le variabili d'ambiente vanno impostate in produzione.** Il codice c'è, ma finché su Vercel mancano `DATABASE_URL`, `AUTH_SECRET`, `ADMIN_PASSWORD`, `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID`, in produzione l'archivio resta in memoria (PGlite, si azzera), l'agenda non si apre e nessuno riceve gli avvisi. **Stato al 27/09:** database Neon (progetto `polished-glitter-73416212` "Francoforte", regione AWS eu-central-1: dati dei clienti in UE; il primo progetto negli Stati Uniti, `falling-darkness-36477223`, non è più usato), schema applicato; funzioni di Vercel a Francoforte (`vercel.json` → `fra1`); su Vercel sono impostate `DATABASE_URL` (branch `production`, pooler) e `AUTH_SECRET`, deploy `777e7d9` in produzione. **Mancano** `ADMIN_PASSWORD` (senza, `/admin/login` dice "Accesso non configurato"), `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID`: le prenotazioni dal sito vengono salvate, ma per ora nessuno le vede né riceve l'avviso. Il vecchio `ADMIN_TOKEN` su Vercel non serve più.
7. **Nessuna verifica del numero** (SMS o richiamata); la disdetta da soli c'è solo dall'app (§6.14): chiunque può occupare orari con un numero inventato. Il freno attuale è di 5 richieste ogni 10 minuti per IP, e sta in memoria (§9.20).
8. **Durate dei servizi stimate** → `lib/salone.ts`. Da 20 a 75 minuti: decidono quanti orari restano liberi, vanno confermate da Francesco insieme ai prezzi.
9. **Disdetta e spostamento dal cliente solo dall'app** (§6.14, link "Gestisci prenotazione"). Chi prenota dal widget del sito passa ancora dal telefono. I promemoria dell'app partono dal workflow GitHub `promemoria-app.yml` ogni 15 minuti, senza configurazione (`docs/app.md`).
10. **Il database locale non va in produzione.** `.data/agenda` sta solo su questo computer e git lo ignora: gli appuntamenti inseriti in locale non finiscono online. Il database di produzione è quello di `DATABASE_URL`.

### 🟠 Da chiarire col committente

6. **Privacy e cookie.** Dal 27/09 c'è l'informativa `/privacy` (`app/privacy/page.tsx`), linkata dal footer e dal passo 3 del modulo di prenotazione. Nome e telefono restano al massimo `CONSERVAZIONE_MESI` (12, in `lib/salone.ts`): la cancellazione la fa `eliminaScadute()` (`lib/prenotazioni/archivio.ts`), lanciata con `after()` all'apertura dell'agenda, una volta al giorno per istanza. Nessun banner dei cookie, perché c'è solo il cookie tecnico della sessione dell'agenda. **Manca** `salone.titolare` (nome del titolare o della ditta), da compilare insieme alla P.IVA. Il testo va fatto rileggere a Francesco o al suo commercialista.
7. **Font dei titoli.** Syne oppure Clash Display (da scaricare da Fontshare, licenza gratuita) → `app/layout.tsx:9-12`, `app/globals.css:14`.
8. **Logo ridisegnato, non originale.** `components/Logo.tsx` è ricostruito a occhio da uno screenshot di 209×33px (§3.6). Serve il file vettoriale originale, o almeno un'immagine ad alta risoluzione, per confermare forme e proporzioni. La firma usa il serif di sistema e cambia leggermente fra Windows/Mac/iOS (Georgia) e Android (Noto Serif). Manca anche una favicon col logo (§11.18).
9. **Link a Google Maps generico** (ricerca per nome). Con il Place ID della scheda Google porterebbe alla scheda esatta → `lib/salone.ts:22-23`.
10. **Altri social** (Facebook, TikTok) → oggi solo Instagram.
11. **Uso del marchio Depot** nel footer e in "Chi siamo" → da confermare.

### 🟡 Igiene tecnica

12. **Nessun git.** Si lavora senza storia: inizializzare il repository prima di qualsiasi altro intervento.
13. **Nessun deploy.** Negli altri progetti si è usato Vercel da CLI; qui non è configurato.
14. **Zero test.** I candidati naturali sono `calcolaStato()` (`lib/orari.ts:55-74`) e `generaSlot()` (`lib/prenotazioni/slot.ts:47-81`): funzioni pure, con pausa pranzo, fuso di Roma, cambio d'ora e durate dei servizi.
15. **Classe inesistente `label`** nel link "Vai al contenuto" → `app/page.tsx:50`.
16. **Telefono duplicato a mano nel JSON-LD** → `app/page.tsx:21`. Anche la formattazione dell'ora è duplicata (`app/page.tsx:12-13` rispetto a `lib/orari.ts:9-10`).
17. **Trappola del focus su mobile.** Dedotto dalla lettura, non riprodotto. L'ultimo link del menu nel DOM (Instagram) è nascosto sotto md (`Navbar.tsx:278`): su mobile il Tab dall'ultimo elemento visibile non torna al primo.
18. **Favicon, README e nome del pacchetto** (`my-app`) sono quelli di `create-next-app`. **Mancano** immagine Open Graph e `metadataBase`.
19. **`public/` contiene 5 SVG del template non usati** (accanto a `images/hero-sfumatura.webp`, che invece è usato).
20. **Peso di framer-motion.** È nel blocco da 107 KB gzip: `LazyMotion` + `m` ridurrebbe il costo, perché si usano solo animazioni semplici.
21. **Avviso in sviluppo** "You have Reduced Motion enabled" di framer-motion: compare solo se il sistema ha il movimento ridotto attivo. È informativo.
22. **Cartella madre `Parruchieria`** scritta con una sola "c": cosmetico, ma attenzione nei percorsi.

---

## 12. Runbook

```bash
cd C:\Users\foscolo\Parruchieria\my-app
npm install
npm run dev -- -p 3200        # http://localhost:3200
npx tsc --noEmit              # deve uscire pulito
npm run lint                  # deve uscire pulito
npm run build                 # il vero controllo prima di ogni consegna
npm run start -- -p 3200      # prova della build di produzione
```

- **Dagli strumenti agentici:** `preview_start` con nome `history-barber` (legge `..\.claude\launch.json`).
- **Aggiornare listino, orari, contatti:** solo `lib/salone.ts`, più il telefono in `app/page.tsx:21`. Cambiando i servizi ricordati di `id` (stabile) e `durata` (minuti).
- **Provare l'API dalla riga di comando:**
  ```
  curl "http://localhost:3200/api/bookings?date=2026-09-22&servizio=taglio-barba"
  curl -X POST http://localhost:3200/api/bookings -H "Content-Type: application/json" \
    -d '{"servizioId":"taglio-uomo","data":"2026-09-22","ora":"10:00","cliente":{"nome":"Mario Rossi","telefono":"3481234567"}}'
  ```
- **Guardare l'agenda:** `/admin` (oggi) oppure `/admin?data=2026-09-22`. Serve la password di `ADMIN_PASSWORD`.
- **Database in locale:** niente da fare. Senza `DATABASE_URL` l'app crea da sola `.data/agenda` (PGlite) al primo accesso all'agenda o all'API. Per ripartire da zero: spegni il server e cancella `.data/`. **Mai due server contemporanei sulla stessa cartella** (§9.23).
- **Preparare il database di produzione:** metti `DATABASE_URL` in `.env.local` (o su Vercel) e lancia `npm run db:init` (Node 22.18+). Lo schema è rieseguibile: applicarlo due volte non fa danni.
- **Neon.** Collegamento con `neon link --project-id polished-glitter-73416212 --branch production -y`, che crea `.neon` (in `.gitignore`) e scrive `DATABASE_URL`, `DATABASE_URL_UNPOOLED` e `NEON_BRANCH` in `.env.local`. `neon.ts` è la configurazione del CLI, oggi vuota (`defineConfig({})`): `neon config plan` mostra cosa cambierebbe, `neon deploy --no-env-pull` applica senza riscrivere i file `.env`. L'app non importa niente da `@neon/*`: si collega con postgres.js e `DATABASE_URL`, e il parametro `channel_binding=require` degli URL di Neon è accettato (verificato). **Due branch:** `production` per Vercel, `sviluppo` per il lavoro in locale (creato con `neon checkout sviluppo --create`, che ha riscritto solo le righe `DATABASE_URL`, `DATABASE_URL_UNPOOLED` e `NEON_BRANCH` di `.env.local`). `sviluppo` contiene l'unico appuntamento di prova copiato da `.data/agenda` (3/10, 10:00–10:50); `production` è vuoto. `.neon` punta a `sviluppo`, quindi `neon deploy` senza `--branch` agisce lì. Il login del CLI (OAuth) scade: se un comando risponde "Bearer token … rejected", va rifatto `neon login`.
- **Collegare gli avvisi:** crea il bot con @BotFather, prendi il chat id da `https://api.telegram.org/bot<TOKEN>/getUpdates` e metti le due variabili. Senza, gli avvisi restano nei log.
- **Aggiungere le foto:** §5.4.
- **Collegare la prenotazione:** implementare `apriPrenotazione()` in `lib/prenotazione.ts`. Tutti i bottoni la chiamano già, con l'origine (`navbar`, `menu`, `hero`, `listino`, `footer`).
- **Disattivare le animazioni** per un test: attivare "riduci movimento" nel sistema operativo. Il sito resta completo.
- **Deploy:** `[NON CONFIGURATO]`. Sugli altri progetti: `npm run build && npx vercel --prod --yes`, con la Git integration da collegare.
- **Cache immagini in sviluppo:** sostituendo un file in `public/` con lo stesso nome, svuotare `.next/dev/cache/images` (Next 16 + Turbopack), come in Al Distributore.

---

## 13. Primo giorno: da dove partire

1. Leggi `AGENTS.md`.
2. Apri **`lib/salone.ts`**: capito quello, hai capito metà del progetto.
3. Leggi **`app/page.tsx`** (com'è composta la pagina) e **`app/globals.css`** (token, utility, stati iniziali).
4. Prima di toccare un'animazione leggi §4.5, §4.6 e §9: spiegano perché certe cose sembrano complicate.
5. Prima di cambiare un testo gigante leggi §3.3.
6. Prima di pubblicare, §11 punti 1–5.

---

## 14. Domande aperte (da chiedere al committente)

1. Quali sono i **servizi reali** e i **prezzi**? Esistono le combo "Skin fade + barba completa" e "Papà + figlio"? Il taglio bambino ha un limite d'età?
2. Chi fornisce le **foto** (hero e portfolio)? Si possono usare quelle di Instagram? Oppure si generano?
3. Qual è la **partita IVA**, e la ragione sociale esatta da riportare nel footer?
4. Come dovrà funzionare la **prenotazione nativa**: servizi, durate, operatori, conferma via SMS/email/WhatsApp, pagamenti?
5. **Syne** va bene, o si passa a **Clash Display**?
6. Esistono i file originali del **logo "HB da Francesco"** (SVG, AI, PDF)? Quello del sito è ridisegnato (§3.6).
7. Il testo di **"Chi siamo"** è corretto? Da quando esiste il salone, e chi ci lavora oltre a Francesco?
8. Si può citare **Depot**? Ci sono altri marchi da mostrare?
9. Altri **social** o recapiti (WhatsApp Business, email)?
10. **Dominio** e **hosting** di destinazione?
11. Serve un'**informativa privacy**, adesso o insieme alla prenotazione?
12. Il file di riferimento **`image_299467.png`** citato nel brief: dove si trova?

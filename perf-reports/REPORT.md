# Ottimizzazione performance mobile — History Barber

Ramo `perf/mobile` (da `main` dac5e3a), 7/11/2026. Obiettivo: sito più veloce su un telefono di fascia media **senza cambiare né l'aspetto né il comportamento**.

## Come è stato misurato

- **Build di produzione** servita in locale (`next start`), con un database di prova isolato (PGlite): `.env.local` punta a Neon e non è stato usato.
- **Lighthouse 12.8.2**, profilo Mobile predefinito (Moto G Power, CPU 4× più lenta, 4G lento simulato). 3 giri per pagina, si riporta la **mediana**. Report completi in `before/` e `after/` (solo in locale, non nel repository).
- **Pagine misurate:**
  - home;
  - prenotazione: la home con il foglio aperto, `/?prenota=hero`, perché la prenotazione non è una pagina a sé;
  - privacy;
  - "Il mio appuntamento";
  - login dell'agenda.
- **Schermate:** a pagina intera a 360, 390 e 414 px in `screenshots/before` e `screenshots/after`, confrontate con pixelmatch. Due giri "prima" consecutivi danno 0 pixel di differenza: il metodo è ripetibile.

## Prima / dopo (mediana di 3 giri, mobile)

| Pagina | Punteggio | LCP | CLS | TBT | FCP | Speed Index | Peso totale | Peso JS |
|---|---|---|---|---|---|---|---|---|
| home | 66 → **80** | 5.59 → **3.92 s** | 0.014 → 0.014 | 530 → **364 ms** | 1.11 → 1.01 s | 1.88 → 1.80 s | 793 → 546 KB | 277 → 272 KB |
| prenotazione | 65 → **80** | 5.58 → **3.93 s** | 0.014 → 0.014 | 586 → **350 ms** | 1.03 → 1.04 s | 1.83 → 1.78 s | 793 → 546 KB | 277 → 272 KB |
| privacy | 89 → **95** | 3.41 → **2.85 s** | 0.000 → 0.000 | 177 → **67 ms** | 0.77 → 0.77 s | 0.77 → 0.95 s | 501 → 357 KB | 254 → 207 KB |
| appuntamento | 87 → **93** | 3.57 → **2.98 s** | 0.035 → 0.035 | 226 → **129 ms** | 0.78 → 0.78 s | 0.92 → 0.78 s | 392 → 294 KB | 153 → 153 KB |
| admin-login | 90 → **94** | 3.27 → **2.92 s** | 0.000 → 0.000 | 163 → **132 ms** | 0.78 → 0.77 s | 0.78 → 0.77 s | 379 → 281 KB | 135 → 135 KB |

**Note sulle misure**
- **INP:** non si misura in laboratorio, perché richiede interazioni reali. Il suo indicatore in laboratorio è il TBT.
- **Rumore:** sulla home il TBT varia di ±100 ms da un giro all'altro, quindi conta la mediana.
- **Peso JS della home:** resta quasi uguale perché framer-motion esce dal primo caricamento ma si scarica comunque subito dopo, per il menu e i fogli. Il vantaggio è che non blocca più il primo disegno e l'idratazione.

### Obiettivi del prompt

| Obiettivo | Raggiunto | Note |
|---|---|---|
| Performance ≥ 95 | privacy sì (95); login 94, appuntamento 93, home 80 | vedi "Perché la home non arriva a 95" |
| LCP < 2,0 s | no (2,85–3,93 s) | vedi sotto |
| CLS < 0,05 | sì, su tutte le pagine | |
| TBT < 150 ms | privacy, appuntamento, login sì; home no (364 ms) | |

### Perché la home non arriva a 95 (e il LCP non scende sotto 2 s)

Mi fermo qui perché andare oltre richiederebbe di cambiare la grafica o il comportamento.

1. **Come Lighthouse stima il LCP.** Lo calcola sommando tutto ciò che il browser scarica ad alta priorità prima di quel momento: 3 font (122 KB), la foto della hero (124 KB in AVIF) e il JavaScript. Su un 4G lento simulato sono già circa 2 s di sola rete. Nel browser vero il LCP della home coincide con il primo disegno (0,36 s non rallentati). Il resto è la stima prudente di Lighthouse.
2. **La foto della hero ad alta priorità** costa da sola circa 0,3 s di LCP stimato. A priorità bassa, provato: home 81 e LCP 3,65 s. L'ho lasciata alta, come chiede il prompt e com'era prima, perché è l'immagine grande della prima schermata e sul telefono vero deve arrivare presto.
3. **Il resto del TBT della home:**
   - il browser che legge l'HTML e applica il CSS (non è JavaScript);
   - React che idrata la pagina;
   - GSAP e Lenis, che servono allo scorrimento morbido e alle animazioni fin dal primo istante;
   - la prima creazione del formatter con fuso orario `Europe/Rome`, circa 110 ms a CPU 4×, che deve caricare i dati del fuso. Evitarla vorrebbe dire riscrivere `oraDiRoma`, che decide anche date e orari delle prenotazioni: è logica di business, non toccata.

## Modifiche fatte (un commit per area)

### Font — `045bd30`
- **`app/layout.tsx`:** Syne e Inter con `subsets: ["latin"]` invece di `["latin", "latin-ext"]`.
  - In `next/font`, `subsets` decide solo cosa si **precarica**: il CSS dichiara comunque tutti i set con il loro `unicode-range`.
  - Prima si precaricavano 5 file (220 KB), ora 3 (122 KB).
  - Il testo del sito sta tutto in "latin" (verificato su tutto il codice): l'aspetto è identico, e un nome come "Łukasz" in agenda continua a usare Inter.

### Immagini — `715b41e`
- **`next.config.ts`:** `images.formats: ["image/avif", "image/webp"]`. La foto della hero passa da 273 KB a **124 KB** (alla larghezza servita al Moto G). AVIF va solo ai browser che lo accettano, gli altri ricevono WebP come prima.
- **`components/Photo.tsx`:** `fetchPriority="high"` esplicito sulla foto precaricata. Con il solo `preload` partiva a priorità bassa. Nessun lazy-load sulla hero, che è l'unica foto del sito: il portfolio ha ancora i segnaposto.
- Larghezza e altezza erano già gestite (`fill` in un contenitore con le sue proporzioni): CLS invariato.

### JavaScript — `bfabf93`, `6669259`, `938ff05`, `f1a8169`
- **`components/Hero.tsx`, `components/ParallasseHero.tsx` (nuovo):** la hero diventa componente server. Restava client solo per la parallasse, ora in un componente che non disegna nulla: stesso DOM e stessa animazione, meno da idratare.
- **`lib/utils.ts`:** il formatter dell'euro si crea al primo prezzo, non al caricamento. Il file lo importano tutti i componenti per `cn()`: costava circa 60 ms a CPU 4× a ogni apertura.
- **`lib/orari.ts`:** `oraDiRoma` crea il suo `Intl.DateTimeFormat` una volta sola invece che a ogni chiamata. Output identico; la funzione e le sue regole non sono cambiate.
- **`components/prenotazione/SalvaAppuntamento.tsx`:** stesso trattamento per il formatter della data.
- **`lib/riempimento.ts` (nuovo), `components/BookButton.tsx`, `components/MioAppuntamentoButton.tsx`:** il riempimento al passaggio del mouse usa la Web Animations API invece di framer-motion.
  - Stessa curva `cubic-bezier(0.16, 1, 0.3, 1)`, 550 ms, stessa ripartenza se si esce a metà.
  - **Verificato fotogramma per fotogramma** sui tre bottoni (entrata, uscita, uscita interrotta): prima e dopo seguono la curva teorica con lo stesso scarto (1–4%, rumore di campionamento).
- **`components/MenuTenda.tsx` (nuovo), `components/Navbar.tsx`:** la tenda del menu, che parte chiusa, sta in un file a sé scaricato subito dopo l'idratazione. Così framer-motion non è più nel JavaScript che blocca il primo caricamento.
  - **Tempo dal tocco alla tenda**, misurato 3–5 volte prima e dopo:

    | Quando si tocca | Prima | Dopo |
    |---|---|---|
    | Mentre la pagina carica | 395–458 ms | 407–436 ms |
    | A pagina ferma | 98–104 ms | 91–108 ms |

  - Una prima versione la scaricava a browser libero e arrivava a 720 ms: corretta (`f1a8169`).

### Fluidità — `51c8eb2`, `8b72df1`
- **`lib/gsap.ts` (`prendiInCarico`):** prima tutte le letture di `getComputedStyle`, poi tutte le scritture. Alternate, costringevano il browser a ricalcolare gli stili elemento per elemento (layout thrashing). Stesso esito.
- **`components/RevealOnScroll.tsx`:** le animazioni allo scorrimento si preparano in `useEffect` invece di `useLayoutEffect`. Gli elementi partono già invisibili dal CSS, quindi non cambia nulla di visibile, ma GSAP esce dal commit dell'idratazione.

### Rete, cache, CSS
- **Terze parti:** nessuna in pagina (niente mappe incorporate, analytics o widget social), quindi niente `preconnect` da aggiungere. I font sono già ospitati dal sito (`next/font`).
- **CSS:** Tailwind 4 genera solo le classi usate (57 KB, 12 KB compressi), quindi non c'è CSS inutilizzato da togliere.
- **Listener:** già passivi o IntersectionObserver. Gli unici `scroll`/`resize` sono quello della barra (`resize`) e quelli interni di Lenis.

## Provati e tolti (nessun guadagno)

- **Confini `<Suspense>` attorno alle sezioni della home**, per idratarle a pezzi: TBT invariato, rimossi.
- **CSS dentro l'HTML** (`experimental.inlineCss` di Next 16): peggio su tutte le pagine (privacy 95 → 88, TBT più alto, compare un CLS di 0,011). Rimosso.

## Non applicati perché cambierebbero grafica o comportamento

| Intervento | Impatto stimato | Perché no |
|---|---|---|
| Foto della hero a priorità bassa | LCP home −0,3 s, +1 punto | Sul telefono vero la foto arriverebbe più tardi; il prompt chiede priorità alta |
| Meno famiglie o pesi di font (oggi Syne, Inter, JetBrains Mono) | LCP −0,3/−0,5 s su tutte le pagine | Cambia la tipografia |
| Rimandare Lenis e GSAP dopo il caricamento | TBT home −100/−150 ms | Nei primi istanti lo scorrimento non sarebbe morbido e le animazioni partirebbero in ritardo |
| Calcolo dell'ora di Roma senza `Intl` (regole dell'ora legale scritte a mano) | TBT home −50/−80 ms | `oraDiRoma` decide anche date e orari delle prenotazioni: è logica di business |
| Animazione d'entrata della hero più breve | LCP stimato più basso | È il design |
| Polyfill "legacy" di Next (14 KB) e "JS inutilizzato" segnalato (~110 KB) | piccolo | Sono il runtime di React e Next, non rimovibili dal progetto |

## Lato hosting (Vercel)

- **Cache e compressione:** per i file con hash (`/_next/static/*`) Vercel mette da solo `Cache-Control: public, max-age=31536000, immutable` e comprime con Brotli. Non serve altro.
- **AVIF:** usa l'ottimizzazione immagini di Vercel. Il primo AVIF di ogni larghezza si genera alla prima richiesta (circa 1 s), poi resta in cache. Nel piano Hobby le trasformazioni hanno un limite mensile: con una sola foto il consumo è minimo, ma è da tenere presente se si aggiungono foto al portfolio.
- **Dopo il deploy:** rimisurare con PageSpeed Insights. Fra qualche settimana arriveranno anche i dati reali (CrUX), compreso l'INP.

## Confronto visivo

15 schermate (5 pagine × 360/390/414 px), prima e dopo, con pixelmatch (soglia 0,1).

| Pagine | Esito |
|---|---|
| privacy, appuntamento, login | 0 pixel diversi, identiche anche al bit |
| home e prenotazione | 0 pixel diversi sopra la soglia percettiva |

Sulla home e sulla prenotazione i pixel della **foto della hero** non sono identici al bit: fino a 15–18/255 per canale, sul 7–8% della pagina. È la diversa compressione AVIF/WebP: l'immagine di differenza amplificata 12 volte (`screenshots/confronto-hero-390.png`) mostra solo grana diffusa. Testi, griglia, bottoni e tutto il resto sono identici al bit.

## Test funzionali

Tutto sulla build finale, con database di prova isolato. Nessun dato di produzione toccato, quindi niente da annullare.

- **Build** senza errori né avvisi nuovi; lint e type-check puliti; `npm test` 33/33.
- **Prenotazione e gestione**, 27 controlli su 27, script di "solo disdetta":
  - prenotazione nuova;
  - seconda prenotazione con lo stesso numero in 4 formati: bloccata con il messaggio, dati conservati allo step 3;
  - 8 invii simultanei: 1 solo creato;
  - solo appuntamenti passati: può prenotare;
  - "Gestisci": nessuno spostamento, "Disdici" funziona, poi si riprenota;
  - API di spostamento: 403;
  - agenda: spostamento e più appuntamenti per lo stesso numero.
- **Menu**, aperto mentre la pagina carica e a pagina ferma: si apre, la pagina sotto diventa inerte, "Listino" chiude e scorre alla sezione, Esc chiude.
- **Bottoni:** "Prenota" e "Il mio appuntamento" aprono i loro fogli; il riempimento al passaggio del mouse funziona.
- **Console:** nessun errore e nessun avviso.

## Segnalati, fuori perimetro

- "Il mio appuntamento" ha un piccolo CLS (0,035, sotto la soglia di 0,05) già presente prima.
- In `/admin` restano formatter `Intl` creati al caricamento (`Calendario.tsx`, `FoglioVoce.tsx`): pagina privata, non misurata.

"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ChangeEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLenis } from "lenis/react";
import { minutiDaOra } from "@/lib/orari";
import { apriPrenotazione, ascoltaPrenotazione, type OrigineCta } from "@/lib/prenotazione";
import { normalizzaTelefono } from "@/lib/prenotazioni/telefono";
import type { RispostaSlot, ServiceOption } from "@/lib/prenotazioni/tipi";
import { CONSERVAZIONE_MESI, listino, MARGINE_GESTIONE_MINUTI, operatori, salone } from "@/lib/salone";
import { cn, formatoPrezzo } from "@/lib/utils";
import { ArrowRight } from "./icons";
import { GIORNI_BREVI, giorniProposti, GrigliaOrari, StrisciaGiorni } from "./prenotazione/GiorniEOrari";
import { AttivaFaceId } from "./gestione/AttivaFaceId";
import { SalvaAppuntamento } from "./prenotazione/SalvaAppuntamento";
import { aggiornaMiei } from "@/lib/gestione";

/* Widget di prenotazione: tre passi in un foglio a tutto schermo.

   Perché un foglio e non una pagina: il cliente arriva dal sito, prenota e
   torna dov'era, senza ricaricare niente e senza perdere il punto in cui
   stava leggendo. Su telefono il foglio occupa tutto lo schermo, su desktop è
   una colonna centrale.

   Gli orari NON si calcolano qui: arrivano da GET /api/bookings, che è anche
   l'unico giudice di cosa è libero. Il client ricalcola solo il telefono, per
   dirlo subito al cliente mentre scrive.

   Chi apre il foglio: i bottoni "Prenota" (lib/prenotazione.ts). */

const PASSI = ["Servizio", "Data e ora", "Dati"] as const;

// Il listino con la categoria ripetuta dentro ogni voce: al widget serve
// piatto, e i supplementi (prenotabile: false) restano fuori.
const SERVIZI: ServiceOption[] = listino.flatMap((g) =>
  g.servizi
    .filter((s) => s.prenotabile !== false)
    .map((s) => ({
      id: s.id,
      nome: s.nome,
      dettaglio: s.dettaglio,
      prezzo: s.prezzo,
      durata: s.durata,
      prefisso: s.prefisso,
      categoria: g.titolo,
    })),
);

type StatoInvio = "fermo" | "invio" | "fatto";

type Conferma = {
  id: string;
  data: string;
  ora: string;
  servizio: string;
  inizio: number;
  fine: number;
  /** Questo browser lo ricorda (cookie hb_cliente): lo ritrova in "Il mio appuntamento". */
  riconosciuto: boolean;
};

export function BookingWidget() {
  const [aperto, setAperto] = useState(false);
  const [origine, setOrigine] = useState<OrigineCta>("hero");
  const [passo, setPasso] = useState(0);
  const [servizio, setServizio] = useState<ServiceOption | null>(null);
  const [data, setData] = useState<string>("");
  const [ora, setOra] = useState<string | null>(null);
  const [slot, setSlot] = useState<RispostaSlot | null>(null);
  const [caricaSlot, setCaricaSlot] = useState(false);
  const [nome, setNome] = useState("");
  const [telefono, setTelefono] = useState("");
  const [note, setNote] = useState("");
  // "Non è il mio telefono": niente cookie, l'appuntamento non resta legato
  // a questo browser (N2).
  const [nonMio, setNonMio] = useState(false);
  const [toccato, setToccato] = useState<{ nome?: boolean; telefono?: boolean }>({});
  const [invio, setInvio] = useState<StatoInvio>("fermo");
  const [erroreServer, setErroreServer] = useState<string | null>(null);
  const [conferma, setConferma] = useState<Conferma | null>(null);

  const foglioRef = useRef<HTMLDivElement>(null);
  const titoloId = useId();
  const lenis = useLenis();

  // Giorni proposti: da oggi (ora di Roma) in avanti, chiusi compresi (spenti).
  const giorni = useMemo(() => giorniProposti(), []);

  const chiudi = useCallback(() => setAperto(false), []);

  // Apertura da qualsiasi bottone "Prenota" del sito, e da /?prenota=gestione
  // (chi ha appena disdetto da "Gestisci il tuo appuntamento" e vuole un
  // orario nuovo): il parametro si toglie dall'indirizzo subito.
  useEffect(() => {
    const smetti = ascoltaPrenotazione((da) => {
      setOrigine(da);
      setAperto(true);
    });
    const indirizzo = new URL(window.location.href);
    if (indirizzo.searchParams.get("prenota") === "gestione") {
      indirizzo.searchParams.delete("prenota");
      window.history.replaceState(null, "", indirizzo.pathname + indirizzo.search + indirizzo.hash);
      apriPrenotazione("gestione");
    }
    return smetti;
  }, []);

  // Alla chiusura si ricomincia da capo: una prenotazione conclusa non deve
  // riaprirsi sulla schermata di conferma.
  useEffect(() => {
    if (aperto) return;
    const t = setTimeout(() => {
      setPasso(0);
      setServizio(null);
      setOra(null);
      setSlot(null);
      setInvio("fermo");
      setErroreServer(null);
      setConferma(null);
      setToccato({});
    }, 400);
    return () => clearTimeout(t);
  }, [aperto]);

  // Mentre il foglio è aperto: pagina ferma, resto del sito fuori dal focus.
  useEffect(() => {
    if (!aperto) return;
    const contenuto = document.getElementById("contenuto");
    contenuto?.toggleAttribute("inert", true);
    lenis?.stop();
    // Tastiera aperta (il viewport visibile si accorcia): il campo attivo
    // resta in vista, sopra la tastiera e sopra la barra delle azioni.
    const vv = window.visualViewport;
    const inVista = () => {
      const attivo = document.activeElement;
      if (attivo instanceof HTMLElement && attivo.matches("input, textarea") && foglioRef.current?.contains(attivo)) {
        attivo.scrollIntoView({ block: "center" });
      }
    };
    vv?.addEventListener("resize", inVista);
    return () => {
      vv?.removeEventListener("resize", inVista);
      contenuto?.toggleAttribute("inert", false);
      lenis?.start();
    };
  }, [aperto, lenis]);

  // Esc chiude, Tab gira dentro il foglio.
  useEffect(() => {
    if (!aperto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return chiudi();
      if (e.key !== "Tab" || !foglioRef.current) return;
      // Solo gli elementi visibili: uno nascosto in fondo romperebbe il giro.
      const fuoco = [
        ...foglioRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((el) => el.getClientRects().length > 0);
      if (fuoco.length === 0) return;
      const primo = fuoco[0];
      const ultimo = fuoco[fuoco.length - 1];
      if (e.shiftKey && document.activeElement === primo) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primo.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [aperto, chiudi]);

  // Gli orari si chiedono quando il cliente sceglie qualcosa, non dentro un
  // effetto: così la richiesta parte una volta sola e si vede da dove nasce.
  // Ogni nuova richiesta annulla la precedente, altrimenti una risposta lenta
  // potrebbe arrivare dopo e mostrare gli orari del giorno sbagliato.
  const richiestaRef = useRef<AbortController | null>(null);
  useEffect(() => () => richiestaRef.current?.abort(), []);

  const caricaOrari = useCallback(async (quale: ServiceOption, quando: string) => {
    richiestaRef.current?.abort();
    const taglia = new AbortController();
    richiestaRef.current = taglia;
    setCaricaSlot(true);
    setSlot(null);
    setErroreServer(null);
    try {
      const risposta = await fetch(`/api/bookings?date=${quando}&servizio=${quale.id}`, {
        signal: taglia.signal,
      });
      if (!risposta.ok) throw new Error(String(risposta.status));
      const dati = (await risposta.json()) as RispostaSlot;
      setSlot(dati);
      setOra((precedente) =>
        dati.slot.some((s) => s.ora === precedente && s.disponibile) ? precedente : null,
      );
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setErroreServer("Non riusciamo a leggere gli orari. Riprova fra poco o chiamaci.");
    } finally {
      if (!taglia.signal.aborted) setCaricaSlot(false);
    }
  }, []);

  const scegliGiorno = (iso: string) => {
    setData(iso);
    if (servizio) void caricaOrari(servizio, iso);
  };

  const telefonoPulito = normalizzaTelefono(telefono);
  const nomeValido = nome.trim().length >= 2;
  const datiValidi = nomeValido && telefonoPulito !== null;

  const scegliServizio = (s: ServiceOption) => {
    const giorno = data || giorni.find((g) => g.aperto)?.iso || giorni[0].iso;
    setServizio(s);
    setData(giorno);
    setPasso(1);
    void caricaOrari(s, giorno);
  };

  async function invia() {
    if (!servizio || !ora || !datiValidi || invio === "invio") return;
    setInvio("invio");
    setErroreServer(null);
    try {
      const risposta = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          servizioId: servizio.id,
          operatoreId: operatori[0].id,
          data,
          ora,
          origine,
          ricorda: !nonMio,
          cliente: { nome: nome.trim(), telefono, note: note.trim() || undefined },
        }),
      });
      const corpo = await risposta.json();
      if (risposta.ok) {
        const inizio = minutiDaOra(ora);
        setConferma({
          id: corpo.prenotazione?.id ?? "",
          data,
          ora,
          servizio: servizio.nome,
          inizio,
          fine: inizio + servizio.durata,
          riconosciuto: Boolean(corpo.riconosciuto),
        });
        // Il bottone "Il mio appuntamento" mostra subito giorno e ora.
        void aggiornaMiei();
        setInvio("fatto");
        return;
      }
      setInvio("fermo");
      // 409 = scontro fra due salvataggi simultanei; il 400 con campo "ora" è
      // lo stesso caso visto un attimo prima, in validazione. Per il cliente
      // cambia nulla: si torna a scegliere l'orario, appena riletto.
      if (risposta.status === 409 || corpo?.campi?.ora) {
        setOra(null);
        setPasso(1);
        void caricaOrari(servizio, data);
        setErroreServer(corpo?.campi?.ora ?? corpo.errore ?? "Orario non più disponibile.");
        return;
      }
      setErroreServer(
        corpo.campi ? Object.values(corpo.campi).join(" · ") : (corpo.errore ?? "Qualcosa è andato storto."),
      );
    } catch {
      setInvio("fermo");
      setErroreServer("Connessione assente. Riprova o chiamaci.");
    }
  }

  const etichettaData = (iso: string) => {
    const g = giorni.find((x) => x.iso === iso);
    return g ? `${GIORNI_BREVI[g.settimana]} ${g.giorno} ${g.mese}` : iso;
  };

  return (
    <AnimatePresence>
      {aperto && (
        <motion.div
          key="prenotazione"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titoloId}
          className="fixed inset-0 z-50 bg-ink/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onMouseDown={(e) => e.target === e.currentTarget && chiudi()}
        >
          <motion.div
            ref={foglioRef}
            // Safe area laterali: in orizzontale su iPhone niente sotto la tacca.
            className="absolute inset-x-0 bottom-0 top-0 mx-auto flex max-w-2xl flex-col bg-paper pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] text-ink md:inset-y-6 md:border md:border-ink"
            initial={{ y: "4%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "3%", opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Testata: passo corrente e chiusura, sempre raggiungibili. */}
            <header className="flex items-center justify-between border-b border-ink px-5 py-4 md:px-8">
              <div>
                <p className="eyebrow text-steel">
                  {conferma ? "Prenotazione" : `Passo ${passo + 1} di 3`}
                </p>
                <h2 id={titoloId} className="mt-1 text-xl font-extrabold tracking-[-0.02em] md:text-2xl">
                  {conferma ? "Ci vediamo in salone" : PASSI[passo]}
                </h2>
              </div>
              <button
                type="button"
                onClick={chiudi}
                className="eyebrow -mr-2 flex min-h-11 cursor-pointer items-center px-2 text-steel hover:text-ink"
              >
                Chiudi ✕
              </button>
            </header>

            {/* Avanzamento: tre segmenti, nessun numero da leggere. */}
            {!conferma && (
              <div aria-hidden className="grid grid-cols-3 gap-1 px-5 pt-4 md:px-8">
                {PASSI.map((p, i) => (
                  <span key={p} className={cn("h-0.5", i <= passo ? "bg-ink" : "bg-ink/15")} />
                ))}
              </div>
            )}

            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-6 md:px-8" data-lenis-prevent>
              {conferma ? (
                <div>
                  <p className="info text-steel">
                    {etichettaData(conferma.data)} · ore {conferma.ora}
                  </p>
                  <p className="mt-3 text-2xl font-extrabold tracking-[-0.02em]">{conferma.servizio}</p>
                  <p className="mt-6 max-w-[42ch] leading-relaxed text-steel">
                    Ti aspettiamo in {salone.via}.{" "}
                    {conferma.riconosciuto
                      ? `Se hai un imprevisto puoi spostarlo o disdirlo da solo, fino a ${MARGINE_GESTIONE_MINUTI / 60} ore prima; dopo, chiama il `
                      : "Se hai un imprevisto, chiama il "}
                    <a href={salone.telefonoHref} className="text-ink underline underline-offset-4">
                      {salone.telefono}
                    </a>
                    .
                  </p>
                  <p className="info mt-6 text-steel">
                    Nome: {nome.trim()} · Tel: {telefonoPulito}
                  </p>
                  <RiquadroDopo conferma={conferma} />
                </div>
              ) : passo === 0 ? (
                <ul className="flex flex-col gap-3">
                  {SERVIZI.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => scegliServizio(s)}
                        aria-pressed={servizio?.id === s.id}
                        className={cn(
                          "group flex w-full cursor-pointer items-start justify-between gap-4 border p-4 text-left transition-colors duration-200 md:p-5",
                          servizio?.id === s.id
                            ? "border-ink bg-ink text-paper"
                            : "border-ink/15 hover:border-ink",
                        )}
                      >
                        <span className="min-w-0">
                          <span className={cn("info block", servizio?.id === s.id ? "text-smoke" : "text-steel")}>
                            {s.categoria} · {s.durata} min
                          </span>
                          <span className="mt-1 block text-lg font-semibold leading-tight tracking-[-0.015em]">
                            {s.nome}
                          </span>
                          <span
                            className={cn(
                              "mt-1 block text-sm leading-snug",
                              servizio?.id === s.id ? "text-smoke" : "text-steel",
                            )}
                          >
                            {s.dettaglio}
                          </span>
                        </span>
                        <span className="info whitespace-nowrap pt-5 text-base">
                          {s.prefisso === "da" && <span className="text-steel">da </span>}
                          {formatoPrezzo(s.prezzo)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : passo === 1 ? (
                <div>
                  <StrisciaGiorni giorni={giorni} scelto={data} onScegli={scegliGiorno} />

                  <div className="mt-6 flex items-baseline justify-between gap-4">
                    <p className="eyebrow text-steel">Orari liberi</p>
                    <p className="info text-steel">
                      {servizio?.nome} · {servizio?.durata} min
                    </p>
                  </div>

                  <div className="mt-4 min-h-40">
                    {caricaSlot ? (
                      <p className="info flex items-center gap-3 py-8 text-steel" role="status">
                        <Rotella />
                        Cerco gli orari…
                      </p>
                    ) : !slot ? null : !slot.aperto ? (
                      <p className="py-8 text-steel">
                        Il {slot.giornoNome.toLowerCase()} il salone è chiuso. Scegli un altro giorno.
                      </p>
                    ) : slot.liberi === 0 ? (
                      <p className="py-8 text-steel">
                        Nessun orario libero per questo servizio. Prova un altro giorno, oppure chiama il{" "}
                        <a href={salone.telefonoHref} className="text-ink underline underline-offset-4">
                          {salone.telefono}
                        </a>
                        .
                      </p>
                    ) : (
                      <>
                        <GrigliaOrari slot={slot.slot} scelto={ora} onScegli={setOra} />
                        {slot.liberi <= 3 && (
                          <p className="info mt-4 text-steel">Ultimi {slot.liberi} orari per questo giorno</p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  <div className="border border-ink/15 p-4">
                    <p className="info text-steel">Riepilogo</p>
                    <p className="mt-2 text-lg font-semibold tracking-[-0.015em]">{servizio?.nome}</p>
                    <p className="info mt-1 text-steel">
                      {etichettaData(data)} · ore {ora} · {servizio?.durata} min ·{" "}
                      {servizio && formatoPrezzo(servizio.prezzo)}
                    </p>
                  </div>

                  <Campo
                    etichetta="Nome e cognome"
                    valore={nome}
                    cambia={setNome}
                    tocca={() => setToccato((t) => ({ ...t, nome: true }))}
                    errore={toccato.nome && !nomeValido ? "Serve il nome per riconoscerti" : undefined}
                    autoComplete="name"
                  />
                  <Campo
                    etichetta="Telefono"
                    valore={telefono}
                    cambia={setTelefono}
                    tocca={() => setToccato((t) => ({ ...t, telefono: true }))}
                    // L'errore compare appena il numero è abbastanza lungo da
                    // essere sbagliato: su telefono nessuno "esce dal campo".
                    errore={
                      (toccato.telefono || telefono.replace(/[^0-9]/g, "").length >= 6) && !telefonoPulito
                        ? "Numero non valido: cellulare o fisso italiano"
                        : undefined
                    }
                    aiuto={telefonoPulito ? `Ti chiamiamo qui: ${telefonoPulito}` : "Serve solo per confermare"}
                    tipo="tel"
                    inputMode="tel"
                    autoComplete="tel"
                  />
                  <Campo
                    etichetta="Note (facoltative)"
                    valore={note}
                    cambia={setNote}
                    aiuto={`${note.length}/280`}
                    multilinea
                  />
                  {/* N2: il telefono ricorda il cliente, a meno che non sia il suo. */}
                  <div className="border border-ink/15 p-4">
                    <p className="text-sm">Su questo telefono ritroverai l&apos;appuntamento con un tocco.</p>
                    <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 text-sm">
                      <span className="relative size-5 shrink-0">
                        <input
                          type="checkbox"
                          checked={nonMio}
                          onChange={(e) => setNonMio(e.target.checked)}
                          className="peer size-5 cursor-pointer appearance-none rounded-none border-2 border-ink bg-paper checked:bg-ink"
                        />
                        <svg viewBox="0 0 24 24" aria-hidden className="pointer-events-none absolute inset-0 m-auto hidden size-3.5 text-paper peer-checked:block" fill="none" stroke="currentColor" strokeWidth="3.5">
                          <path d="M5 12l5 5 9-10" />
                        </svg>
                      </span>
                      Non è il mio telefono
                    </label>
                  </div>
                  <p className="text-xs leading-relaxed text-ink/70">
                    Usiamo nome e telefono solo per questo appuntamento e li cancelliamo entro{" "}
                    {CONSERVAZIONE_MESI} mesi.{" "}
                    <a href="/privacy" target="_blank" rel="noopener" className="underline underline-offset-2">
                      Informativa privacy
                    </a>
                  </p>
                </div>
              )}

              {erroreServer && (
                <p role="alert" className="mt-6 border border-ink bg-ink px-4 py-3 text-sm text-paper">
                  {erroreServer}
                </p>
              )}
            </div>

            {/* Barra delle azioni: sempre a portata di pollice, fuori dallo scorrimento. */}
            <footer className="border-t border-ink px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-8">
              {conferma ? (
                <button type="button" onClick={chiudi} className={CLASSI_BOTTONE}>
                  Torna al sito
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  {passo > 0 && (
                    <button
                      type="button"
                      onClick={() => setPasso((p) => p - 1)}
                      className="eyebrow min-h-12 shrink-0 cursor-pointer border border-ink px-4 hover:bg-ink hover:text-paper sm:px-5"
                    >
                      Indietro
                    </button>
                  )}
                  {passo === 1 && (
                    <button
                      type="button"
                      disabled={!ora}
                      onClick={() => setPasso(2)}
                      // min-w-0: a 320 px il testo va a capo invece di spingere il
                      // bottone fuori dallo schermo.
                      className={cn(CLASSI_BOTTONE, "min-w-0 flex-1 px-4 text-center sm:px-6")}
                    >
                      {ora ? `Continua · ore ${ora}` : "Scegli un orario"}
                      <ArrowRight className="size-3.5" />
                    </button>
                  )}
                  {passo === 2 && (
                    <button
                      type="button"
                      disabled={!datiValidi || invio === "invio"}
                      onClick={invia}
                      // min-w-0: a 320 px il testo va a capo invece di spingere il
                      // bottone fuori dallo schermo.
                      className={cn(CLASSI_BOTTONE, "min-w-0 flex-1 px-4 text-center sm:px-6")}
                    >
                      {invio === "invio" ? (
                        <>
                          <Rotella chiara /> Invio…
                        </>
                      ) : (
                        <>
                          Conferma prenotazione <ArrowRight className="size-3.5" />
                        </>
                      )}
                    </button>
                  )}
                  {passo === 0 && (
                    <p className="info text-steel">Scegli un servizio per continuare</p>
                  )}
                </div>
              )}
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* Dopo la prenotazione: niente da salvare. Il telefono lo ricorda (se non
   è stato spuntato "Non è il mio telefono"); in più, facoltativi, Face ID
   per gli altri dispositivi e il calendario. */
function RiquadroDopo({ conferma }: { conferma: Conferma }) {
  return (
    <section aria-labelledby="titolo-dopo" className="mt-8 border border-ink p-4 md:p-5">
      <h3 id="titolo-dopo" className="eyebrow">
        Per spostare o disdire
      </h3>
      {conferma.riconosciuto ? (
        <>
          <p className="mt-3 text-base">
            Lo ritrovi in home, in <b>«Il mio appuntamento»</b>: su questo telefono basta un tocco, senza codici.
          </p>
          <AttivaFaceId />
        </>
      ) : (
        <p className="mt-3 text-base">
          Per spostarlo o disdirlo chiama il{" "}
          <a href={salone.telefonoHref} className="font-semibold underline underline-offset-4">
            {salone.telefono}
          </a>{" "}
          o scrivici su WhatsApp.
        </p>
      )}
      <div className="mt-4">
        <SalvaAppuntamento appuntamento={conferma} soloCalendario />
      </div>
    </section>
  );
}

const CLASSI_BOTTONE =
  "eyebrow inline-flex min-h-12 cursor-pointer items-center justify-center gap-3 border border-ink bg-ink px-6 text-paper transition-colors duration-200 hover:bg-paper hover:text-ink disabled:cursor-not-allowed disabled:border-ink/20 disabled:bg-ink/20 disabled:text-paper";

function Rotella({ chiara }: { chiara?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-4 animate-spin rounded-full border-2 border-current border-t-transparent",
        chiara ? "text-paper" : "text-steel",
      )}
    />
  );
}

type CampoProps = {
  etichetta: string;
  valore: string;
  cambia: (v: string) => void;
  tocca?: () => void;
  errore?: string;
  aiuto?: string;
  tipo?: string;
  inputMode?: "text" | "tel";
  autoComplete?: string;
  multilinea?: boolean;
};

function Campo({
  etichetta,
  valore,
  cambia,
  tocca,
  errore,
  aiuto,
  tipo = "text",
  inputMode,
  autoComplete,
  multilinea,
}: CampoProps) {
  const id = useId();
  const idAiuto = `${id}-aiuto`;
  const comuni = {
    id,
    value: valore,
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => cambia(e.target.value),
    onBlur: tocca,
    "aria-invalid": errore ? true : undefined,
    "aria-describedby": errore || aiuto ? idAiuto : undefined,
    className: cn(
      "mt-2 w-full border bg-transparent px-4 py-3 text-base outline-none transition-colors duration-200",
      errore ? "border-ink bg-ink/5" : "border-ink/20 focus:border-ink",
    ),
  };
  return (
    <div>
      <label htmlFor={id} className="eyebrow text-steel">
        {etichetta}
      </label>
      {multilinea ? (
        <textarea {...comuni} rows={3} maxLength={280} />
      ) : (
        <input {...comuni} type={tipo} inputMode={inputMode} autoComplete={autoComplete} maxLength={60} />
      )}
      {(errore || aiuto) && (
        <p id={idAiuto} className={cn("info mt-2", errore ? "text-ink" : "text-steel")}>
          {errore ?? aiuto}
        </p>
      )}
    </div>
  );
}

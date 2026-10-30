"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Rotella } from "@/components/agenda/FoglioInBasso";
import { giorniProposti, GrigliaOrari, StrisciaGiorni } from "@/components/prenotazione/GiorniEOrari";
import { giornoLungo, SalvaAppuntamento } from "@/components/prenotazione/SalvaAppuntamento";
import type { BookingSlot } from "@/lib/prenotazioni/tipi";
import { oraDiRoma } from "@/lib/orari";
import { MARGINE_GESTIONE_MINUTI, salone, SPOSTAMENTI_MAX } from "@/lib/salone";
import { cn, formatoPrezzo } from "@/lib/utils";

/* "Gestisci il tuo appuntamento", lato cliente: riepilogo, disdetta in due
   tocchi, spostamento su un orario che il server proporrebbe.

   Il client non decide niente: termine, limite di spostamenti e orari liberi
   arrivano da POST /api/appuntamento a ogni passo, e se nel frattempo
   l'orario viene preso il server risponde 409 con gli orari rimasti. Niente
   framer-motion, GSAP né Lenis: la pagina resta leggera. */

export type Credenziale = { prenotazioneId: string } | { token: string } | { telefono: string; codice: string };

export type Riepilogo = {
  id: string;
  data: string;
  ora: string;
  finisceAlle: string;
  inizio: number;
  fine: number;
  servizio: string;
  prezzo: number;
  nome: string;
  disdicibile: boolean;
  spostabile: boolean;
  motivoBlocco?: "termine" | "spostamenti";
  spostamentiRimasti: number;
  termine: { data: string; ora: string };
  fineRipensamento?: { data: string; ora: string };
  /** Oltre il termine normale, ma ancora nel ripensamento (C2). */
  inRipensamento?: boolean;
};

type Orari = {
  data: string;
  giornoNome: string;
  aperto: boolean;
  slot: BookingSlot[];
  liberi: number;
  proprio: string | null;
  prossimiGiorni?: { data: string; liberi: number }[];
};

type Schermata = "riepilogo" | "disdici" | "disdetto" | "spostato" | "sparito";

const bottonePieno =
  "eyebrow inline-flex min-h-14 w-full cursor-pointer items-center justify-center gap-3 border border-ink bg-ink px-6 text-paper transition-colors duration-200 hover:bg-paper hover:text-ink disabled:cursor-not-allowed disabled:border-ink/20 disabled:bg-ink/20 disabled:text-paper";
const bottoneVuoto =
  "eyebrow inline-flex min-h-14 w-full cursor-pointer items-center justify-center gap-3 border border-ink px-6 transition-colors duration-200 hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:opacity-50";

// Il focus va sul titolo (o sull'avviso) solo per gli screen reader: niente
// anello visibile. Inline perché il :focus-visible globale (app/globals.css)
// vincerebbe su una classe.
const SENZA_ANELLO = { outline: "none" } as const;

const corta = new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "numeric", timeZone: "UTC" });
const giornoCorto = (data: string) => corta.format(new Date(`${data}T12:00:00Z`)).replace(",", "");

async function chiama(azione: string, credenziale: Credenziale, extra: Record<string, string> = {}) {
  try {
    const r = await fetch("/api/appuntamento", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ azione, credenziale, ...extra }),
      cache: "no-store",
    });
    return { stato: r.status, corpo: await r.json().catch(() => ({})) };
  } catch {
    return { stato: 0, corpo: { errore: "Connessione assente. Riprova fra poco." } };
  }
}

export function GestioneAppuntamento({
  credenziale,
  iniziale,
  modo,
  onPrenota,
  onIndietro,
  onCambiato,
  piede,
}: {
  credenziale: Credenziale;
  iniziale: Riepilogo;
  /** "cliente": riconosciuto da questo dispositivo (v2); "link" e "codice":
      le credenziali della v1, ancora valide per chi le ha. */
  modo: "cliente" | "link" | "codice";
  /** Dentro il foglio della home: apre il widget invece di cambiare pagina. */
  onPrenota?: () => void;
  /** Torna all'elenco dei propri appuntamenti. */
  onIndietro?: () => void;
  /** Dopo una disdetta o uno spostamento (per aggiornare i bottoni). */
  onCambiato?: () => void;
  /** Sotto Disdici, sopra il calendario: Face ID / impronta (SpazioCliente). */
  piede?: ReactNode;
}) {
  const [app, setApp] = useState(iniziale);
  const [schermata, setSchermata] = useState<Schermata>("riepilogo");
  const [inVolo, setInVolo] = useState(false);
  const [errore, setErrore] = useState("");
  const [da, setDa] = useState<{ data: string; ora: string } | null>(null);
  const titolo = useRef<HTMLHeadingElement>(null);

  // Ogni schermata nuova porta il focus sul suo titolo: chi usa uno screen
  // reader sente subito dove si trova.
  useEffect(() => {
    titolo.current?.focus();
  }, [schermata]);

  const vai = (s: Schermata) => {
    setErrore("");
    setSchermata(s);
  };

  const rileggi = async () => {
    const { stato, corpo } = await chiama("leggi", credenziale);
    if (stato === 404) vai("sparito");
    else if (corpo?.appuntamento) setApp(corpo.appuntamento);
  };

  const disdici = async () => {
    setInVolo(true);
    setErrore("");
    const { stato, corpo } = await chiama("disdici", credenziale);
    setInVolo(false);
    if (stato === 200) {
      onCambiato?.();
      return vai("disdetto");
    }
    if (stato === 404) return vai("sparito");
    setErrore(corpo?.errore ?? "Non è andata a buon fine. Riprova.");
    if (stato === 403) await rileggi();
  };

  const quando = `${giornoLungo(app.data)} alle ${app.ora}`;

  return (
    <div>
      {schermata === "riepilogo" && (
        <>
          {onIndietro && (
            <button type="button" onClick={onIndietro} className="eyebrow -mt-2 mb-4 inline-flex min-h-11 cursor-pointer items-center text-steel hover:text-ink">
              ← Tutti i tuoi appuntamenti
            </button>
          )}
          <Titolo rif={titolo} sopra={modo === "cliente" ? "Il mio appuntamento" : "Gestisci il tuo appuntamento"}>
            {app.nome ? `Ciao ${app.nome}` : "Il tuo appuntamento"}
          </Titolo>
          {/* 1. Riepilogo. */}
          <Scheda app={app} />
          {/* 2. Fino a quando si può fare cosa (C2), o perché non più (C4). */}
          <RigaTermine app={app} />
          <Errore testo={errore} />
          {/* 3. "Scegli un altro orario", aperto da subito (C3). */}
          {app.spostabile && (
            <SceltaOrario
              key={`${app.data}-${app.ora}`}
              app={app}
              credenziale={credenziale}
              onSpostato={(nuovo, vecchio) => {
                setDa(vecchio);
                setApp(nuovo);
                onCambiato?.();
                vai("spostato");
              }}
              onSparito={() => vai("sparito")}
              onBloccato={async (messaggio) => {
                await rileggi();
                setErrore(messaggio);
              }}
            />
          )}
          {/* 4. Disdici, secondario, con conferma nella pagina. */}
          {app.disdicibile && (
            <div className="mt-8 border-t border-ink/15 pt-6">
              <button type="button" onClick={() => vai("disdici")} className={bottoneVuoto}>
                Disdici
              </button>
              {app.spostabile && <p className="info mt-3 text-steel">Per cambiare servizio, disdici e prenota di nuovo.</p>}
            </div>
          )}
          {/* 5. Face ID / impronta (da SpazioCliente), 6. calendario. */}
          {piede}
          <div className="mt-8 border-t border-ink/15 pt-5">
            <SalvaAppuntamento appuntamento={app} soloCalendario />
          </div>
        </>
      )}

      {schermata === "disdici" && (
        <>
          <Titolo rif={titolo} sopra="Disdetta">
            Vuoi disdire?
          </Titolo>
          <p className="mt-5 text-lg">
            Disdire l&apos;appuntamento di <b>{quando}</b>?
          </p>
          <p className="mt-2 text-base text-steel">L&apos;orario torna libero per altri clienti. Non si può annullare.</p>
          <Errore testo={errore} />
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => vai("riepilogo")} disabled={inVolo} className={bottoneVuoto}>
              No, tienilo
            </button>
            <button type="button" onClick={disdici} disabled={inVolo} aria-busy={inVolo} className={bottonePieno}>
              {inVolo && <Rotella />}
              {inVolo ? "Un attimo…" : "Sì, disdici"}
            </button>
          </div>
        </>
      )}

      {schermata === "disdetto" && (
        <>
          <Titolo rif={titolo} sopra="Fatto">
            Appuntamento disdetto
          </Titolo>
          <p className="mt-5 text-base">
            Abbiamo avvisato Francesco: l&apos;appuntamento di {quando} non c&apos;è più. Grazie di averlo fatto in tempo.
          </p>
          <PrenotaDiNuovo onPrenota={onPrenota} />
        </>
      )}

      {schermata === "spostato" && (
        <>
          <Titolo rif={titolo} sopra="Fatto">
            Appuntamento spostato
          </Titolo>
          {da && (
            <p className="info mt-4 text-steel">
              Da {giornoCorto(da.data)} {da.ora} → a {giornoCorto(app.data)} {app.ora}
            </p>
          )}
          <Scheda app={app} />
          <p className="mt-4 text-base">
            Abbiamo avvisato Francesco.
            {modo === "link" ? " Il tuo link resta lo stesso." : modo === "codice" ? " Il tuo codice resta lo stesso." : " Lo ritrovi sempre in «Il mio appuntamento»."}
          </p>
          <div className="mt-6">
            <p className="mb-2 text-sm text-steel">Aggiorna il calendario del telefono:</p>
            <SalvaAppuntamento appuntamento={app} soloCalendario />
          </div>
          <button type="button" onClick={() => vai("riepilogo")} className={cn(bottoneVuoto, "mt-4")}>
            Torna al riepilogo
          </button>
        </>
      )}

      {schermata === "sparito" && (
        <>
          <Titolo rif={titolo} sopra="Gestisci il tuo appuntamento">
            Questo appuntamento non c&apos;è più
          </Titolo>
          <p className="mt-5 text-base">
            Forse è già stato disdetto. Per qualsiasi dubbio chiama il salone al{" "}
            <a href={salone.telefonoHref} className="font-semibold underline underline-offset-4">
              {salone.telefono}
            </a>
            .
          </p>
          <PrenotaDiNuovo onPrenota={onPrenota} />
        </>
      )}
    </div>
  );
}

function PrenotaDiNuovo({ onPrenota }: { onPrenota?: () => void }) {
  return onPrenota ? (
    <button type="button" onClick={onPrenota} className={cn(bottonePieno, "mt-6")}>
      Prenota un nuovo orario
    </button>
  ) : (
    <Link href="/?prenota=gestione" prefetch={false} className={cn(bottonePieno, "mt-6")}>
      Prenota un nuovo orario
    </Link>
  );
}

/* Titoli delle pagine di gestione: "APPUNTAMENTO", la parola più lunga, è
   9,55 em in Syne Bold. Il minimo è il più piccolo fra 2 rem e 100cqi / 9,8,
   così la parola sta nella shell anche a 320 px e con il testo di sistema
   ingrandito (prima a 320 px sporgeva di 26 px). Stessa formula in
   SpazioCliente, CercaAppuntamento e nella pagina "non c'è più". */
function Titolo({ rif, sopra, children }: { rif: React.RefObject<HTMLHeadingElement | null>; sopra: string; children: ReactNode }) {
  return (
    <>
      <p className="eyebrow text-steel">{sopra}</p>
      <h1 ref={rif} tabIndex={-1} style={SENZA_ANELLO} className="display mt-3 text-[clamp(min(2rem,calc(100cqi/9.8)),9.6cqi,4rem)]">
        {children}
      </h1>
    </>
  );
}

function Scheda({ app }: { app: Riepilogo }) {
  return (
    <div className="mt-6 border border-ink p-5">
      <p className="info text-steel">
        {giornoLungo(app.data)} · {app.ora}–{app.finisceAlle}
      </p>
      <p className="mt-2 text-2xl font-extrabold tracking-[-0.02em]">{app.servizio}</p>
      <p className="info mt-2">{formatoPrezzo(app.prezzo)}</p>
      <p className="mt-3 text-sm text-steel">
        {salone.nomeCompleto} · {salone.via}
      </p>
    </div>
  );
}

/* Fino a quando si può modificare (C1, C2), o perché non più (C4). Ore e
   giorni arrivano già calcolati dal server in ora di Roma (C6): qui non si
   usa l'ora del dispositivo, se non per dire "oggi". */
function RigaTermine({ app }: { app: Riepilogo }) {
  if (app.motivoBlocco === "termine") {
    return (
      <div className="mt-5 border-2 border-dashed border-ink px-4 py-4">
        <p className="text-base">
          Mancano meno di {MARGINE_GESTIONE_MINUTI} minuti: ora le modifiche si fanno solo per telefono.
        </p>
        <Contatti app={app} />
      </div>
    );
  }
  const fino = (
    <>
      fino alle <b>{app.termine.ora}</b>
      {app.termine.data !== oraDiRoma().data && <> di {giornoLungo(app.termine.data)}</>}
    </>
  );
  if (app.motivoBlocco === "spostamenti") {
    return (
      <div className="mt-5 border-2 border-dashed border-ink px-4 py-4">
        <p className="text-base">
          Hai già spostato questo appuntamento {SPOSTAMENTI_MAX} volte. Puoi disdirlo, oppure chiamarci.
        </p>
        {app.disdicibile && <p className="mt-2 text-base text-steel">Puoi disdirlo {fino}.</p>}
        <Contatti app={app} />
      </div>
    );
  }
  if (!app.disdicibile) return null;
  return (
    <p className="mt-5 text-base">
      {app.inRipensamento ? "Hai cambiato idea? Puoi modificarlo " : "Puoi modificarlo "}
      {fino}.
      {app.spostabile && app.spostamentiRimasti < SPOSTAMENTI_MAX && (
        <span className="text-steel">
          {" "}
          {app.spostamentiRimasti === 1 ? "Puoi spostarlo ancora una volta." : `Spostamenti rimasti: ${app.spostamentiRimasti}.`}
        </span>
      )}
    </p>
  );
}

/** Chiama e WhatsApp al salone, con il messaggio già avviato. */
function Contatti({ app }: { app: Riepilogo }) {
  const messaggio = `Ciao Francesco, vorrei modificare il mio appuntamento di ${giornoLungo(app.data)} alle ${app.ora}.`;
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <a href={salone.telefonoHref} className={bottonePieno}>
        Chiama · {salone.telefono}
      </a>
      <a
        href={`https://wa.me/${salone.telefonoHref.replace(/\D/g, "")}?text=${encodeURIComponent(messaggio)}`}
        target="_blank"
        rel="noopener noreferrer"
        className={bottoneVuoto}
      >
        Scrivi su WhatsApp
      </a>
    </div>
  );
}

function Errore({ testo }: { testo: string }) {
  return (
    <div aria-live="polite">
      {testo && (
        <p role="alert" className="mt-5 border border-ink bg-ink px-4 py-3 text-sm text-paper">
          {testo}
        </p>
      )}
    </div>
  );
}

/* ── Scegli un altro orario (C3) ────────────────────────────────────────────
   Dentro il riepilogo, aperto da subito: striscia dei giorni e griglia del
   widget, "Il tuo orario" segnato, conferma sotto la griglia. Le regole
   sono quelle di sempre, decise dal server: slotPerSpostamento, occupati
   senza sé stesso, 409 con le alternative, SPOSTAMENTI_MAX. */

function SceltaOrario({
  app,
  credenziale,
  onSpostato,
  onSparito,
  onBloccato,
}: {
  app: Riepilogo;
  credenziale: Credenziale;
  onSpostato: (nuovo: Riepilogo, da: { data: string; ora: string }) => void;
  onSparito: () => void;
  onBloccato: (messaggio: string) => void;
}) {
  const [giorni] = useState(giorniProposti);
  const primoAperto = giorni.find((g) => g.iso === app.data && g.aperto)?.iso ?? giorni.find((g) => g.aperto)?.iso ?? giorni[0].iso;
  const [data, setData] = useState("");
  const [orari, setOrari] = useState<Orari | null>(null);
  const [carica, setCarica] = useState(false);
  const [ora, setOra] = useState<string | null>(null);
  const [inVolo, setInVolo] = useState(false);
  const [errore, setErrore] = useState("");
  const avviso = useRef<HTMLDivElement>(null);
  const ultima = useRef(0);

  const caricaOrari = async (giorno: string) => {
    const n = ++ultima.current;
    setData(giorno);
    setOra(null);
    setCarica(true);
    const { stato, corpo } = await chiama("orari", credenziale, { data: giorno });
    if (n !== ultima.current) return; // è arrivata prima una risposta più recente
    setCarica(false);
    if (stato === 200) return setOrari(corpo as Orari);
    if (stato === 404) return onSparito();
    if (stato === 403) return onBloccato(corpo?.errore ?? "Non si può più spostare online.");
    setOrari(null);
    setErrore(corpo?.errore ?? "Non riusciamo a leggere gli orari. Riprova.");
  };

  // Primo giorno, quello dell'appuntamento: si carica al montaggio (rinviato
  // con setTimeout, non dentro l'effetto, per il React Compiler).
  const avviato = useRef(false);
  useEffect(() => {
    if (avviato.current) return;
    avviato.current = true;
    const t = setTimeout(() => void caricaOrari(primoAperto), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- una volta sola all'apertura
  }, []);

  const conferma = async () => {
    if (!ora || inVolo) return;
    setInVolo(true);
    setErrore("");
    const vecchio = { data: app.data, ora: app.ora };
    const { stato, corpo } = await chiama("sposta", credenziale, { data, ora });
    setInVolo(false);
    if (stato === 200) return onSpostato(corpo.appuntamento as Riepilogo, vecchio);
    if (stato === 404) return onSparito();
    if (stato === 403) return onBloccato(corpo?.errore ?? "Non si può più spostare online.");
    if (stato === 409) {
      // Gara persa: qualcuno ha preso l'orario mentre sceglievi. Orari
      // aggiornati subito, scelta azzerata, messaggio in vista.
      setOra(null);
      setOrari({ ...(corpo.alternative as Orari), prossimiGiorni: corpo.prossimiGiorni });
      setErrore(corpo.errore ?? "Spiacenti, l'orario scelto non è più disponibile.");
      setTimeout(() => avviso.current?.focus(), 0);
      return;
    }
    setErrore(corpo?.errore ?? "Non è andata a buon fine. Riprova.");
  };

  const pieno = orari && orari.aperto && orari.liberi === 0;

  return (
    <section aria-labelledby="titolo-scelta" className="mt-8 border-t border-ink/15 pt-6">
      <h2 id="titolo-scelta" className="text-xl font-extrabold tracking-[-0.02em]">
        Scegli un altro orario
      </h2>
      <p className="info mt-2 text-steel">
        {app.servizio} · {app.fine - app.inizio} min · stesso prezzo
      </p>

      <div className="mt-6">
        <StrisciaGiorni giorni={giorni} scelto={data} onScegli={(g) => void caricaOrari(g)} className="-mx-5 overflow-x-auto px-5 md:-mx-10 md:px-10" />
      </div>

      <div ref={avviso} tabIndex={-1} style={SENZA_ANELLO}>
        <Errore testo={errore} />
      </div>

      <div className="mt-6 min-h-24">
        {carica ? (
          <p className="info flex items-center gap-3 py-8 text-steel" role="status">
            <Rotella /> Cerco gli orari…
          </p>
        ) : !orari ? null : !orari.aperto ? (
          <p className="py-8 text-steel">Il {orari.giornoNome.toLowerCase()} il salone è chiuso. Scegli un altro giorno.</p>
        ) : (
          <>
            {pieno ? (
              <div className="border-2 border-dashed border-ink px-4 py-4">
                <p className="text-base font-semibold">Nessun orario libero questo giorno.</p>
                {orari.prossimiGiorni && orari.prossimiGiorni.length > 0 && (
                  <>
                    <p className="mt-1 text-sm text-steel">I primi giorni con posto:</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {orari.prossimiGiorni.map((g) => (
                        <button
                          key={g.data}
                          type="button"
                          onClick={() => void caricaOrari(g.data)}
                          className="info min-h-11 cursor-pointer border border-ink px-4 hover:bg-ink hover:text-paper"
                        >
                          {giornoCorto(g.data)} · {g.liberi} {g.liberi === 1 ? "orario" : "orari"}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : null}
            <div className={cn(pieno && "mt-5")}>
              <GrigliaOrari slot={orari.slot} scelto={ora} onScegli={setOra} proprio={orari.proprio} />
            </div>
          </>
        )}
      </div>

      {/* Conferma sotto la griglia, non in una barra fissa: dentro il foglio
          della home una barra fissa finirebbe sotto il bordo del foglio. */}
      <div className="mt-5 border border-ink p-4">
        <p className="info min-h-5 text-steel" aria-live="polite">
          {ora ? `Da ${giornoCorto(app.data)} ${app.ora} → a ${giornoCorto(data)} ${ora}` : "Scegli un giorno e un orario"}
        </p>
        <button type="button" onClick={conferma} disabled={!ora || inVolo} aria-busy={inVolo} className={cn(bottonePieno, "mt-3")}>
          {inVolo && <Rotella />}
          {inVolo ? "Sposto…" : "Conferma spostamento"}
        </button>
      </div>
    </section>
  );
}

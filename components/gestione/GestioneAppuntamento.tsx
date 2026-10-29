"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Rotella } from "@/components/agenda/FoglioInBasso";
import { giorniProposti, GrigliaOrari, StrisciaGiorni } from "@/components/prenotazione/GiorniEOrari";
import { giornoLungo, SalvaAppuntamento } from "@/components/prenotazione/SalvaAppuntamento";
import type { BookingSlot } from "@/lib/prenotazioni/tipi";
import { salone, SPOSTAMENTI_MAX } from "@/lib/salone";
import { cn, formatoPrezzo } from "@/lib/utils";

/* "Gestisci il tuo appuntamento", lato cliente: riepilogo, disdetta in due
   tocchi, spostamento su un orario che il server proporrebbe.

   Il client non decide niente: termine, limite di spostamenti e orari liberi
   arrivano da POST /api/appuntamento a ogni passo, e se nel frattempo
   l'orario viene preso il server risponde 409 con gli orari rimasti. Niente
   framer-motion, GSAP né Lenis: la pagina resta leggera. */

export type Credenziale = { token: string } | { telefono: string; codice: string };

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

type Schermata = "riepilogo" | "disdici" | "disdetto" | "sposta" | "spostato" | "sparito";

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
  conLink,
}: {
  credenziale: Credenziale;
  iniziale: Riepilogo;
  /** Aperta dal link personale (non da telefono + codice). */
  conLink: boolean;
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
    if (stato === 200) return vai("disdetto");
    if (stato === 404) return vai("sparito");
    setErrore(corpo?.errore ?? "Non è andata a buon fine. Riprova.");
    if (stato === 403) await rileggi();
  };

  const quando = `${giornoLungo(app.data)} alle ${app.ora}`;

  return (
    <div>
      {schermata === "riepilogo" && (
        <>
          <Titolo rif={titolo} sopra="Gestisci il tuo appuntamento">
            {app.nome ? `Ciao ${app.nome}` : "Il tuo appuntamento"}
          </Titolo>
          <Scheda app={app} />
          {app.disdicibile ? (
            <p className="mt-5 text-base">
              Puoi {app.spostabile ? "spostarlo o disdirlo" : "disdirlo"} fino alle <b>{app.termine.ora}</b> di{" "}
              {giornoLungo(app.termine.data)}.
              {app.spostabile && app.spostamentiRimasti < SPOSTAMENTI_MAX && (
                <span className="text-steel">
                  {" "}
                  {app.spostamentiRimasti === 1 ? "Puoi spostarlo ancora una volta." : `Spostamenti rimasti: ${app.spostamentiRimasti}.`}
                </span>
              )}
            </p>
          ) : null}
          {app.motivoBlocco && (
            <p className="mt-5 border-2 border-dashed border-ink px-4 py-3 text-base">
              {app.motivoBlocco === "termine"
                ? "Ormai non si può più modificare online. "
                : `Hai già spostato questo appuntamento ${SPOSTAMENTI_MAX} volte: puoi ancora disdirlo. `}
              Per modifiche chiama il salone:{" "}
              <a href={salone.telefonoHref} className="font-semibold underline underline-offset-4">
                {salone.telefono}
              </a>
              .
            </p>
          )}
          <Errore testo={errore} />
          {(app.spostabile || app.disdicibile) && (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {app.spostabile && (
                <button type="button" onClick={() => vai("sposta")} className={bottonePieno}>
                  Sposta
                </button>
              )}
              {app.disdicibile && (
                <button type="button" onClick={() => vai("disdici")} className={bottoneVuoto}>
                  Disdici
                </button>
              )}
            </div>
          )}
          {app.spostabile && <p className="info mt-3 text-steel">Per cambiare servizio, disdici e prenota di nuovo.</p>}
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
          <Link href="/?prenota=gestione" className={cn(bottonePieno, "mt-6")}>
            Prenota un nuovo orario
          </Link>
        </>
      )}

      {schermata === "sposta" && (
        <Spostamento
          rif={titolo}
          app={app}
          credenziale={credenziale}
          onIndietro={() => vai("riepilogo")}
          onSpostato={(nuovo, vecchio) => {
            setDa(vecchio);
            setApp(nuovo);
            vai("spostato");
          }}
          onSparito={() => vai("sparito")}
          onBloccato={async (messaggio) => {
            await rileggi();
            vai("riepilogo");
            setErrore(messaggio);
          }}
        />
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
            Abbiamo avvisato Francesco. {conLink ? "Il tuo link resta lo stesso." : "Il tuo codice resta lo stesso."}
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
          <Link href="/?prenota=gestione" className={cn(bottonePieno, "mt-6")}>
            Prenota un nuovo orario
          </Link>
        </>
      )}
    </div>
  );
}

function Titolo({ rif, sopra, children }: { rif: React.RefObject<HTMLHeadingElement | null>; sopra: string; children: ReactNode }) {
  return (
    <>
      <p className="eyebrow text-steel">{sopra}</p>
      <h1 ref={rif} tabIndex={-1} style={SENZA_ANELLO} className="display mt-3 text-[clamp(2rem,9.6cqi,4rem)]">
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

/* ── Spostamento ────────────────────────────────────────────────────────── */

function Spostamento({
  rif,
  app,
  credenziale,
  onIndietro,
  onSpostato,
  onSparito,
  onBloccato,
}: {
  rif: React.RefObject<HTMLHeadingElement | null>;
  app: Riepilogo;
  credenziale: Credenziale;
  onIndietro: () => void;
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

  // Primo giorno: si carica al montaggio, da un tocco ("Sposta") e non da un
  // effetto che aggiorna lo stato; il giorno resta quello dell'appuntamento.
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
    <div className="pb-40">
      <p className="eyebrow text-steel">Sposta l&apos;appuntamento</p>
      <h1 ref={rif} tabIndex={-1} style={SENZA_ANELLO} className="display mt-3 text-[clamp(2rem,9.6cqi,4rem)]">
        Scegli il nuovo orario
      </h1>
      <p className="info mt-4 text-steel">
        Ora: {giornoCorto(app.data)} {app.ora} · {app.servizio} · {app.fine - app.inizio} min
      </p>

      <div className="mt-6">
        <StrisciaGiorni giorni={giorni} scelto={data} onScegli={(g) => void caricaOrari(g)} className="-mx-5 overflow-x-auto px-5 md:-mx-10 md:px-10" />
      </div>

      <div ref={avviso} tabIndex={-1} style={SENZA_ANELLO}>
        <Errore testo={errore} />
      </div>

      <div className="mt-6 min-h-40">
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

      {/* Barra delle azioni: sempre a portata di pollice. */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-ink bg-paper pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {/* Stessa colonna della pagina (shell max-w-2xl), anche su desktop. */}
        <div className="shell max-w-2xl">
          <p className="info min-h-5 text-steel" aria-live="polite">
            {ora ? `Da ${giornoCorto(app.data)} ${app.ora} → a ${giornoCorto(data)} ${ora}` : "Scegli un giorno e un orario"}
          </p>
          <div className="mt-2 grid grid-cols-[auto_1fr] gap-3">
            <button type="button" onClick={onIndietro} disabled={inVolo} className={cn(bottoneVuoto, "min-h-12 px-5")}>
              Indietro
            </button>
            <button type="button" onClick={conferma} disabled={!ora || inVolo} aria-busy={inVolo} className={cn(bottonePieno, "min-h-12")}>
              {inVolo && <Rotella />}
              {inVolo ? "Sposto…" : "Conferma spostamento"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Rotella } from "@/components/agenda/FoglioInBasso";
import { giornoLungo, SalvaAppuntamento } from "@/components/prenotazione/SalvaAppuntamento";
import { oraDiRoma } from "@/lib/orari";
import { MARGINE_GESTIONE_MINUTI, salone } from "@/lib/salone";
import { cn, formatoPrezzo } from "@/lib/utils";

/* "Gestisci il tuo appuntamento", lato cliente: riepilogo e disdetta in due
   tocchi. Per cambiare orario si contatta il salone.

   Il client non decide niente: il termine arriva da POST /api/appuntamento a
   ogni passo. Niente framer-motion, GSAP né Lenis: la pagina resta leggera. */

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
  motivoBlocco?: "termine";
  termine: { data: string; ora: string };
  fineRipensamento?: { data: string; ora: string };
  /** Oltre il termine normale, ma ancora nel ripensamento (C2). */
  inRipensamento?: boolean;
};

type Schermata = "riepilogo" | "disdici" | "disdetto" | "sparito";

const bottonePieno =
  "eyebrow inline-flex min-h-14 w-full cursor-pointer items-center justify-center gap-3 border border-ink bg-ink px-6 text-paper transition-colors duration-200 hover:bg-paper hover:text-ink disabled:cursor-not-allowed disabled:border-ink/20 disabled:bg-ink/20 disabled:text-paper";
const bottoneVuoto =
  "eyebrow inline-flex min-h-14 w-full cursor-pointer items-center justify-center gap-3 border border-ink px-6 transition-colors duration-200 hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:opacity-50";

// Il focus va sul titolo (o sull'avviso) solo per gli screen reader: niente
// anello visibile. Inline perché il :focus-visible globale (app/globals.css)
// vincerebbe su una classe.
const SENZA_ANELLO = { outline: "none" } as const;

async function chiama(azione: string, credenziale: Credenziale) {
  try {
    const r = await fetch("/api/appuntamento", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ azione, credenziale }),
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
  /** Dopo una disdetta (per aggiornare i bottoni). */
  onCambiato?: () => void;
  /** Sotto Disdici, sopra il calendario: Face ID / impronta (SpazioCliente). */
  piede?: ReactNode;
}) {
  const [app, setApp] = useState(iniziale);
  const [schermata, setSchermata] = useState<Schermata>("riepilogo");
  const [inVolo, setInVolo] = useState(false);
  const [errore, setErrore] = useState("");
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
          {/* 3. Disdici, con conferma nella pagina. */}
          {app.disdicibile && (
            <div className="mt-8 border-t border-ink/15 pt-6">
              <button type="button" onClick={() => vai("disdici")} className={bottoneVuoto}>
                Disdici
              </button>
              <p className="info mt-3 text-steel">Per cambiare servizio, disdici e prenota di nuovo.</p>
              {/* 4. L'orario lo cambia il salone. */}
              <p className="mt-6 text-base font-semibold">Vuoi cambiare orario? Contatta il salone</p>
              <Contatti app={app} />
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

/* Fino a quando si può disdire (C1, C2), o perché non più (C4). Ore e
   giorni arrivano già calcolati dal server in ora di Roma (C6): qui non si
   usa l'ora del dispositivo, se non per dire "oggi". */
function RigaTermine({ app }: { app: Riepilogo }) {
  if (app.motivoBlocco === "termine") {
    return (
      <div className="mt-5 border-2 border-dashed border-ink px-4 py-4">
        <p className="text-base">
          Mancano meno di {MARGINE_GESTIONE_MINUTI} minuti: ora per disdire o cambiare orario contatta il salone.
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
  if (!app.disdicibile) return null;
  return (
    <p className="mt-5 text-base">
      {app.inRipensamento ? "Hai cambiato idea? Puoi disdirlo " : "Puoi disdirlo "}
      {fino}.
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

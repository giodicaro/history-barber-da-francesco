"use client";

import { useState, useSyncExternalStore } from "react";
import { chiusureInVista, dataParlata, giornoDopo, periodoParlato, type ChiusuraPubblica } from "@/lib/chiusure";
import { useChiusure } from "@/lib/chiusure-sito";
import { giornoDellaData, oraDiRoma, turniDellaGiornata } from "@/lib/orari";
import { apriPrenotazione } from "@/lib/prenotazione";
import { orari } from "@/lib/salone";
import { ArrowRight } from "./icons";

/* La notizia della chiusura, in home: compare da sola quando Francesco
   aggiunge una chiusura nell'agenda (GET /api/chiusure) e sparisce da sola
   il giorno dopo la fine, perché l'API dà solo le chiusure non ancora finite.

   Riquadro chiaro con il bordo pieno, fisso sotto la barra: sulla hero scura
   salta all'occhio, e non spostando niente della pagina non fa saltare il
   testo mentre si legge. "Ho capito" lo chiude per quella chiusura (ricordato
   nel browser); la stessa notizia resta comunque nel footer, sotto gli orari. */

const CHIAVE = (c: ChiusuraPubblica) => `hb-avviso-chiusura:${c.id}:${c.dal}:${c.al}`;

function letta(c: ChiusuraPubblica) {
  try {
    return localStorage.getItem(CHIAVE(c)) === "1";
  } catch {
    return false;
  }
}

/** Il primo giorno in cui si torna a lavorare, dopo la chiusura. */
function riapertura(c: ChiusuraPubblica, tutte: readonly ChiusuraPubblica[]): string | null {
  let giorno = giornoDopo(c.al);
  for (let i = 0; i < 60; i++, giorno = giornoDopo(giorno)) {
    const chiuso = tutte.some((x) => x.dal <= giorno && giorno <= x.al);
    if (!chiuso && turniDellaGiornata(giorno).length > 0) return giorno;
  }
  return null;
}

const nessuno = () => () => {};

export function NotiziaChiusura() {
  const { chiusure } = useChiusure();
  // localStorage solo nel browser: sul server (e al primo disegno) niente.
  const nelBrowser = useSyncExternalStore(nessuno, () => true, () => false);
  const [chiuse, setChiuse] = useState<string[]>([]);
  if (!nelBrowser) return null;

  const oggi = oraDiRoma().data;
  const c = chiusureInVista(chiusure, oggi).find((x) => !letta(x) && !chiuse.includes(x.id));
  if (!c) return null;

  const inCorso = c.dal <= oggi;
  const torna = riapertura(c, chiusure);
  const titolo = inCorso
    ? `Oggi siamo chiusi${c.motivo ? ` · ${c.motivo}` : ""}`
    : `${c.motivo ?? "Chiusura"} ${periodoParlato(c)}`;
  const testo = inCorso
    ? `Il salone è chiuso fino al ${dataParlata(c.al)}.`
    : `Il salone resta chiuso ${periodoParlato(c)}.`;

  const chiudi = () => {
    try {
      localStorage.setItem(CHIAVE(c), "1");
    } catch {
      // Senza memoria del browser si chiude solo per questa visita.
    }
    setChiuse((x) => [...x, c.id]);
  };

  return (
    <aside
      aria-label="Avviso di chiusura"
      className="pointer-events-none fixed inset-x-0 top-[calc(var(--nav-h)+0.5rem)] z-30 motion-safe:animate-[avviso-entra_0.5s_var(--ease-crisp)_both]"
    >
      <div className="shell">
        <div className="pointer-events-auto ml-auto max-w-md border-2 border-ink bg-paper text-ink md:mr-0">
          <div className="flex items-start justify-between gap-2 pl-4 pt-3">
            <p className="eyebrow">Avviso · Chiusura</p>
            <button
              type="button"
              onClick={chiudi}
              aria-label="Ho capito, chiudi l'avviso"
              className="-mt-3 flex size-11 shrink-0 cursor-pointer items-center justify-center hover:bg-fog"
            >
              <svg viewBox="0 0 24 24" aria-hidden className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <div className="px-4 pb-4">
            <p className="text-xl font-extrabold leading-tight tracking-[-0.02em]">{titolo}</p>
            <p className="mt-1 text-base">
              {testo}
              {torna && (
                <>
                  {" "}
                  Riapriamo {orari[giornoDellaData(torna)].giorno.toLowerCase()} {dataParlata(torna)}.
                </>
              )}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
              <button
                type="button"
                onClick={() => apriPrenotazione("hero")}
                className="eyebrow inline-flex min-h-11 cursor-pointer items-center gap-2 underline-offset-4 hover:underline"
              >
                Prenota un altro giorno <ArrowRight className="size-3" />
              </button>
              <button
                type="button"
                onClick={chiudi}
                className="eyebrow inline-flex min-h-11 cursor-pointer items-center text-steel underline-offset-4 hover:text-ink hover:underline"
              >
                Ho capito
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

/** La stessa notizia, sempre al suo posto: nel footer, sotto gli orari. */
export function NotaChiusureFooter() {
  const { chiusure } = useChiusure();
  const nelBrowser = useSyncExternalStore(nessuno, () => true, () => false);
  if (!nelBrowser) return null;
  const vicine = chiusureInVista(chiusure, oraDiRoma().data);
  if (vicine.length === 0) return null;
  return (
    <div className="mt-5 border border-paper/40 px-4 py-3">
      <p className="eyebrow text-paper">Chiusure</p>
      <ul className="mt-1 space-y-1">
        {vicine.map((c) => (
          <li key={c.id} className="info">
            Chiuso {periodoParlato(c)}
            {c.motivo && <span className="text-smoke"> · {c.motivo}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

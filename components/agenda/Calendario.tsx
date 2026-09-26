"use client";

import { useState } from "react";
import { giornoDellaData } from "@/lib/orari";
import { aperto } from "@/lib/prenotazioni/agenda";
import { ordineSettimana, orari } from "@/lib/salone";
import { cn } from "@/lib/utils";

/* Griglia del mese per saltare a un giorno qualsiasi. La settimana parte dal
   lunedì, come in salone; i giorni di chiusura si vedono ma non si scelgono.
   Le date sono stringhe "YYYY-MM-DD" dall'inizio alla fine: nessun oggetto
   Date locale, quindi nessun fuso orario che sposti un giorno. */

const nomeMese = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" });

const iso = (anno: number, mese: number, giorno: number) =>
  `${anno}-${String(mese + 1).padStart(2, "0")}-${String(giorno).padStart(2, "0")}`;

export function Calendario({
  selezionata,
  oggi,
  onScegli,
}: {
  selezionata: string;
  oggi: string;
  onScegli: (data: string) => void;
}) {
  const [mese, setMese] = useState(() => {
    const [a, m] = selezionata.split("-").map(Number);
    return { anno: a, mese: m - 1 };
  });

  const giorniNelMese = new Date(Date.UTC(mese.anno, mese.mese + 1, 0)).getUTCDate();
  const primo = iso(mese.anno, mese.mese, 1);
  // Caselle vuote prima dell'1: quante colonne dopo il lunedì cade.
  const vuote = ordineSettimana.indexOf(giornoDellaData(primo));

  const sposta = (verso: 1 | -1) =>
    setMese(({ anno, mese: m }) => {
      const n = m + verso;
      return n < 0 ? { anno: anno - 1, mese: 11 } : n > 11 ? { anno: anno + 1, mese: 0 } : { anno, mese: n };
    });

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <Freccia verso={-1} onClick={() => sposta(-1)} />
        <p className="text-lg font-extrabold capitalize tracking-[-0.01em]" aria-live="polite">
          {nomeMese.format(new Date(`${primo}T12:00:00Z`))}
        </p>
        <Freccia verso={1} onClick={() => sposta(1)} />
      </div>

      <div className="mt-5 grid grid-cols-7 gap-1" role="grid">
        {ordineSettimana.map((g) => (
          <p key={g} className="info pb-2 text-center text-steel" aria-hidden>
            {orari[g].breve.slice(0, 2)}
          </p>
        ))}
        {Array.from({ length: vuote }, (_, i) => (
          <span key={`v${i}`} />
        ))}
        {Array.from({ length: giorniNelMese }, (_, i) => {
          const data = iso(mese.anno, mese.mese, i + 1);
          const chiuso = !aperto(data);
          const scelta = data === selezionata;
          return (
            <button
              key={data}
              type="button"
              disabled={chiuso}
              onClick={() => onScegli(data)}
              aria-current={data === oggi ? "date" : undefined}
              aria-pressed={scelta}
              aria-label={`${orari[giornoDellaData(data)].giorno} ${i + 1}${chiuso ? ", chiuso" : ""}`}
              className={cn(
                "flex aspect-square min-h-11 cursor-pointer items-center justify-center text-base tabular-nums transition-colors duration-150",
                scelta
                  ? "bg-ink font-bold text-paper"
                  : chiuso
                    ? "cursor-not-allowed text-smoke line-through"
                    : "hover:bg-fog",
                data === oggi && !scelta && "outline outline-2 -outline-offset-2 outline-ink",
              )}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="info text-steel">Barrati: salone chiuso</p>
        <button
          type="button"
          onClick={() => onScegli(oggi)}
          className="eyebrow min-h-12 cursor-pointer border border-ink px-5 hover:bg-ink hover:text-paper"
        >
          Vai a oggi
        </button>
      </div>
    </div>
  );
}

function Freccia({ verso, onClick }: { verso: 1 | -1; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={verso < 0 ? "Mese precedente" : "Mese successivo"}
      className="flex size-12 cursor-pointer items-center justify-center border border-ink hover:bg-ink hover:text-paper"
    >
      <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d={verso < 0 ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
      </svg>
    </button>
  );
}

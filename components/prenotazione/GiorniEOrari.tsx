"use client";

import { giornoDellaData, oraDiRoma, sommaGiorni, turniDellaGiornata } from "@/lib/orari";
import type { BookingSlot } from "@/lib/prenotazioni/tipi";
import { GIORNI_PRENOTABILI } from "@/lib/salone";
import { cn } from "@/lib/utils";

/* Striscia dei giorni e griglia degli orari, in comune fra il widget di
   prenotazione (components/BookingWidget.tsx) e "Gestisci il tuo
   appuntamento" (components/gestione/). Estratte dal widget senza cambiare
   una classe: il widget si comporta come prima.

   Niente framer-motion né Lenis qui dentro: la pagina di gestione resta
   leggera. */

export const GIORNI_BREVI = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
export const MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

export type GiornoProposto = {
  iso: string;
  settimana: number;
  aperto: boolean;
  giorno: number;
  mese: string;
  oggi: boolean;
};

/** Da oggi (ora di Roma) a GIORNI_PRENOTABILI in avanti. I giorni di chiusura
    restano nella lista, spenti: vedere "LUN CHIUSO" spiega più di un buco. */
export function giorniProposti(): GiornoProposto[] {
  const oggi = oraDiRoma().data;
  return Array.from({ length: GIORNI_PRENOTABILI + 1 }, (_, i) => {
    const iso = sommaGiorni(oggi, i);
    const settimana = giornoDellaData(iso);
    return {
      iso,
      settimana,
      aperto: turniDellaGiornata(iso).length > 0,
      giorno: Number(iso.slice(8, 10)),
      mese: MESI[Number(iso.slice(5, 7)) - 1],
      oggi: i === 0,
    };
  });
}

export function StrisciaGiorni({
  giorni,
  scelto,
  onScegli,
  className = "-mx-5 overflow-x-auto px-5 md:-mx-8 md:px-8",
}: {
  giorni: GiornoProposto[];
  scelto: string;
  onScegli: (iso: string) => void;
  className?: string;
}) {
  return (
    // Striscia dei giorni: scorre in orizzontale, si tocca con il pollice.
    <div className={className} data-lenis-prevent>
      <ul className="flex gap-2 pb-2">
        {giorni.map((g) => (
          <li key={g.iso}>
            <button
              type="button"
              disabled={!g.aperto}
              onClick={() => onScegli(g.iso)}
              aria-pressed={scelto === g.iso}
              className={cn(
                "flex min-h-[4.5rem] w-16 cursor-pointer flex-col items-center justify-center border px-1",
                scelto === g.iso ? "border-ink bg-ink text-paper" : "border-ink/15 hover:border-ink",
                !g.aperto && "cursor-not-allowed border-dashed text-ink/25 hover:border-ink/15",
              )}
            >
              <span className="info text-[0.625rem] opacity-70">{g.oggi ? "Oggi" : GIORNI_BREVI[g.settimana]}</span>
              <span className="mt-1 text-lg font-bold leading-none tabular-nums">{g.giorno}</span>
              <span className="info text-[0.625rem] opacity-70">{g.mese}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const MOTIVI: Record<NonNullable<BookingSlot["motivo"]>, string> = {
  occupato: "Già prenotato",
  passato: "Troppo tardi per oggi",
  chiusura: "Non ci sta prima della chiusura",
};

export function GrigliaOrari({
  slot,
  scelto,
  onScegli,
  proprio,
}: {
  slot: BookingSlot[];
  scelto: string | null;
  onScegli: (ora: string) => void;
  /** L'orario attuale di chi sta spostando: si vede, ma non si sceglie. */
  proprio?: string | null;
}) {
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {slot.map((s) =>
        s.ora === proprio ? (
          <li key={s.ora}>
            <span
              aria-label={`${s.ora}, il tuo orario`}
              className="info flex min-h-12 w-full flex-col items-center justify-center border-2 border-dashed border-ink text-center tabular-nums"
            >
              {s.ora}
              <span className="text-[0.625rem] leading-tight">Il tuo orario</span>
            </span>
          </li>
        ) : (
          <li key={s.ora}>
            <button
              type="button"
              disabled={!s.disponibile}
              onClick={() => onScegli(s.ora)}
              aria-pressed={scelto === s.ora}
              className={cn(
                "info min-h-12 w-full cursor-pointer border text-center tabular-nums transition-colors duration-200",
                scelto === s.ora ? "border-ink bg-ink text-paper" : "border-ink/15 hover:border-ink",
                !s.disponibile && "cursor-not-allowed border-ink/10 text-ink/25 line-through hover:border-ink/10",
              )}
              title={s.motivo ? MOTIVI[s.motivo] : undefined}
            >
              {s.ora}
            </button>
          </li>
        ),
      )}
    </ul>
  );
}

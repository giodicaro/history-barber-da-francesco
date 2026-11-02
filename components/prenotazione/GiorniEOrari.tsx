"use client";

import { avvisoGiornoChiuso, chiusoIl, periodoParlato, type ChiusuraPubblica } from "@/lib/chiusure";
import { giornoDellaData, oraDiRoma, sommaGiorni, turniDellaGiornata } from "@/lib/orari";
import type { BookingSlot } from "@/lib/prenotazioni/tipi";
import { GIORNI_PRENOTABILI, PREAVVISO_MINUTI, salone } from "@/lib/salone";
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
  /** Chiuso per una chiusura di Francesco (ferie): spento e scritto "Chiuso". */
  chiusura?: { motivo?: string };
};

/** Da oggi (ora di Roma) a GIORNI_PRENOTABILI in avanti. I giorni di chiusura
    restano nella lista, spenti: vedere "LUN CHIUSO" spiega più di un buco.
    Le chiusure (lib/chiusure-sito.ts) spengono anche i giorni di ferie; il
    server comunque li rifiuta da sé. */
export function giorniProposti(chiusure: readonly ChiusuraPubblica[] = []): GiornoProposto[] {
  const oggi = oraDiRoma().data;
  return Array.from({ length: GIORNI_PRENOTABILI + 1 }, (_, i) => {
    const iso = sommaGiorni(oggi, i);
    const settimana = giornoDellaData(iso);
    const chiusa = chiusoIl(iso, chiusure);
    return {
      iso,
      settimana,
      aperto: !chiusa && turniDellaGiornata(iso).length > 0,
      giorno: Number(iso.slice(8, 10)),
      mese: MESI[Number(iso.slice(5, 7)) - 1],
      oggi: i === 0,
      ...(chiusa ? { chiusura: { ...(chiusa.motivo ? { motivo: chiusa.motivo } : {}) } } : {}),
    };
  });
}

/** Riga sopra la striscia: chiusure che iniziano nei prossimi 14 giorni (o in
    corso), ben visibile. Il giorno chiuso, se lo si sceglie, lo dice anche
    la griglia. */
export function AvvisoChiusureVicine({ chiusure }: { chiusure: readonly ChiusuraPubblica[] }) {
  const oggi = oraDiRoma().data;
  const vicine = chiusure.filter((c) => c.al >= oggi && c.dal <= sommaGiorni(oggi, 14));
  if (vicine.length === 0) return null;
  return (
    <div role="note" className="mb-4 border-2 border-ink px-4 py-3">
      <p className="eyebrow">Avviso</p>
      {vicine.map((c) => (
        <p key={c.id} className="mt-1 text-base">
          Il salone è chiuso {periodoParlato(c)}
          {c.motivo ? ` (${c.motivo})` : ""}.
        </p>
      ))}
    </div>
  );
}

/** Al posto della griglia, il giorno chiuso spiegato. */
export function GiornoChiuso({ motivo }: { motivo?: string }) {
  return <p className="py-8 text-base">{avvisoGiornoChiuso({ motivo })}</p>;
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
              aria-label={g.chiusura ? `${GIORNI_BREVI[g.settimana]} ${g.giorno} ${g.mese}, chiuso${g.chiusura.motivo ? ` (${g.chiusura.motivo})` : ""}` : undefined}
              className={cn(
                "flex min-h-[4.5rem] w-16 cursor-pointer flex-col items-center justify-center border px-1",
                scelto === g.iso ? "border-ink bg-ink text-paper" : "border-ink/15 hover:border-ink",
                !g.aperto && "cursor-not-allowed border-dashed text-ink/25 hover:border-ink/15",
              )}
            >
              <span className="info text-[0.625rem] opacity-70">{g.oggi ? "Oggi" : GIORNI_BREVI[g.settimana]}</span>
              <span className="mt-1 text-lg font-bold leading-none tabular-nums">{g.giorno}</span>
              {/* Ferie: al posto del mese, "Chiuso" (il motivo nell'etichetta). */}
              <span className="info text-[0.625rem] opacity-70">{g.chiusura ? "Chiuso" : g.mese}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "1 ora", "30 minuti", "1 ora e 30 minuti": il preavviso detto a parole. */
export function aParole(minuti: number): string {
  const ore = Math.floor(minuti / 60);
  const resto = minuti % 60;
  const h = ore === 0 ? "" : ore === 1 ? "1 ora" : `${ore} ore`;
  const m = resto === 0 ? "" : `${resto} minuti`;
  return [h, m].filter(Boolean).join(" e ");
}

const PREAVVISO =
  PREAVVISO_MINUTI === 60 ? "entro l'ora di preavviso" : `entro i ${aParole(PREAVVISO_MINUTI)} di preavviso`;

// Il motivo di ogni orario spento: nel title per il mouse e nell'aria-label
// per i lettori di schermo. Su telefono il title non si vede: per questo il
// preavviso ha anche una riga visibile sopra la griglia.
const MOTIVI: Record<NonNullable<BookingSlot["motivo"]>, { title: string; voce: string }> = {
  occupato: { title: "Già prenotato", voce: "già occupato" },
  passato: { title: "Orario già passato", voce: "già passato" },
  preavviso: { title: `Oggi si prenota fino a ${aParole(PREAVVISO_MINUTI)} prima`, voce: PREAVVISO },
  chiusura: { title: "Non ci sta prima della chiusura", voce: "il servizio finirebbe dopo la chiusura" },
};

export function GrigliaOrari({
  slot,
  scelto,
  onScegli,
}: {
  slot: BookingSlot[];
  scelto: string | null;
  onScegli: (ora: string) => void;
}) {
  const preavviso = slot.some((s) => s.motivo === "preavviso");
  return (
    <>
      {preavviso && (
        <p className="info mb-4 border-l-2 border-ink pl-3 text-ink">
          Oggi si prenota fino a {aParole(PREAVVISO_MINUTI)} prima. Per un orario più vicino chiama il salone:{" "}
          <a href={salone.telefonoHref} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
            {salone.telefono}
          </a>
        </p>
      )}
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {slot.map((s) => (
          <li key={s.ora}>
            <button
              type="button"
              disabled={!s.disponibile}
              onClick={() => onScegli(s.ora)}
              aria-pressed={scelto === s.ora}
              className={cn(
                "info min-h-12 w-full cursor-pointer border text-center tabular-nums transition-colors duration-200",
                scelto === s.ora ? "border-ink bg-ink text-paper" : "border-ink/15 hover:border-ink",
                !s.disponibile &&
                  (s.motivo === "preavviso"
                    ? // Nel futuro ma troppo vicino: tratteggio come nell'agenda, non barrato.
                      "cursor-not-allowed border-dashed border-ink/30 text-ink/40 hover:border-ink/30"
                    : "cursor-not-allowed border-ink/10 text-ink/25 line-through hover:border-ink/10"),
              )}
              title={s.motivo ? MOTIVI[s.motivo].title : undefined}
              aria-label={s.motivo ? `${s.ora}, ${MOTIVI[s.motivo].voce}` : undefined}
            >
              {s.ora}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

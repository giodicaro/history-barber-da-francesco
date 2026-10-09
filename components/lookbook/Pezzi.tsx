"use client";

import { useRef, useState } from "react";
export { dataLook } from "@/lib/lookbook/formato";
import { CAMPI_NOTE, NOMI_CAMPO, NOMI_POSIZIONE, type FotoLook, type Look } from "@/lib/lookbook/tipi";
import { cn } from "@/lib/utils";

/* Pezzi condivisi fra la scheda del barbiere e "Il mio stile" del cliente.

   Le foto sono <img> e non next/image: arrivano da rotte protette (sessione
   o token) che l'ottimizzatore di Next, chiamando dal server senza cookie,
   non potrebbe leggere. Sono già della misura giusta (miniatura 360 px,
   intera 1080 px). */

export function Stella({ piena, className = "size-5" }: { piena: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill={piena ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8">
      <path strokeLinejoin="miter" d="M12 2.8l2.8 6 6.5.7-4.9 4.4 1.4 6.4L12 17l-5.8 3.3 1.4-6.4-4.9-4.4 6.5-.7z" />
    </svg>
  );
}

export type IndirizzoFoto = (id: string, versione: "mini" | "full") => string;

/** Le voci compilate di un look, in ordine. */
export const voceDelLook = (look: Look) =>
  CAMPI_NOTE.filter((c) => look[c]).map((c) => ({ campo: c, etichetta: NOMI_CAMPO[c], valore: look[c]! }));

/** Note di un look in lista: etichetta in eyebrow, valore leggibile. */
export function NoteDelLook({ look, tema }: { look: Look; tema: "chiaro" | "scuro" }) {
  const voci = voceDelLook(look);
  if (voci.length === 0) {
    return <p className={cn("text-base", tema === "scuro" ? "text-smoke" : "text-steel")}>Nessuna nota per questo taglio.</p>;
  }
  return (
    <dl className={cn("divide-y", tema === "scuro" ? "divide-paper/15" : "divide-ink/10")}>
      {voci.map((v) => (
        <div key={v.campo} className="grid grid-cols-[6.5rem_1fr] items-baseline gap-3 py-3">
          <dt className={cn("eyebrow", tema === "scuro" ? "text-smoke" : "text-steel")}>{v.etichetta}</dt>
          <dd className="text-base break-words">{v.valore}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Foto di un look a scorrimento orizzontale (scroll-snap), con le
    etichette delle posizioni che portano alla foto e dicono quale si vede. */
export function CaroselloFoto({
  foto,
  indirizzo,
  tema,
  adatta = "copri",
  rientro = false,
  className,
}: {
  foto: FotoLook[];
  indirizzo: IndirizzoFoto;
  tema: "chiaro" | "scuro";
  /** "copri" ritaglia in un 4:5; "contieni" mostra la foto intera (Mostra al barbiere). */
  adatta?: "copri" | "contieni";
  /** Foto a filo dello schermo: le etichette sotto tengono il margine del testo. */
  rientro?: boolean;
  className?: string;
}) {
  const nastro = useRef<HTMLUListElement>(null);
  const [visibile, setVisibile] = useState(0);

  const vai = (i: number) => {
    const n = nastro.current;
    if (!n) return;
    const riduci = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    n.scrollTo({ left: i * n.clientWidth, behavior: riduci ? "auto" : "smooth" });
  };

  return (
    <div className={cn("flex flex-col", className)}>
      <ul
        ref={nastro}
        onScroll={(e) => {
          const n = e.currentTarget;
          setVisibile(Math.round(n.scrollLeft / Math.max(1, n.clientWidth)));
        }}
        className="flex min-h-0 flex-auto snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ touchAction: "pan-x pan-y pinch-zoom" }}
      >
        {foto.map((f) => (
          <li
            key={f.id}
            className={cn(
              "relative w-full shrink-0 snap-center",
              adatta === "copri" ? "aspect-[4/5]" : "h-full",
              tema === "scuro" ? "bg-paper/5" : "bg-fog",
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- rotte protette, vedi in cima */}
            <img
              src={indirizzo(f.id, "full")}
              alt={`Foto ${NOMI_POSIZIONE[f.posizione].toLowerCase()} del taglio`}
              decoding="async"
              draggable={false}
              className={cn("absolute inset-0 size-full", adatta === "copri" ? "object-cover" : "object-contain")}
            />
          </li>
        ))}
      </ul>
      {foto.length > 1 && (
        <div className={cn("mt-2 flex shrink-0 gap-1", rientro && "px-5 md:px-0")} role="group" aria-label="Scegli la foto">
          {foto.map((f, i) => (
            <button
              key={f.id}
              type="button"
              onClick={() => vai(i)}
              aria-current={visibile === i}
              className={cn(
                "info min-h-11 flex-1 cursor-pointer border-t-2 pt-2 text-left transition-colors duration-150",
                visibile === i
                  ? tema === "scuro"
                    ? "border-paper text-paper"
                    : "border-ink text-ink"
                  : tema === "scuro"
                    ? "border-paper/20 text-smoke"
                    : "border-ink/15 text-steel",
              )}
            >
              {NOMI_POSIZIONE[f.posizione]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

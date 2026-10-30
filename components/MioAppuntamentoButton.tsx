"use client";

import type { FocusEvent, PointerEvent } from "react";
import { animate, motion, useMotionValue, useReducedMotion } from "framer-motion";
import { giornoDellaData } from "@/lib/orari";
import { apriGestione, useMiei, type OrigineGestione } from "@/lib/gestione";
import { cn } from "@/lib/utils";
import { GIORNI_BREVI, MESI } from "./prenotazione/GiorniEOrari";

/* "Il mio appuntamento": il gemello di "Prenota" (BookButton), con lo stesso
   peso. Stessa altezza, stessa tipografia, stesso riempimento al passaggio;
   "Prenota" è pieno, questo a contorno.

   Due righe fisse: "Il mio appuntamento" e, sotto, "Sposta o disdici",
   che diventa "Mer 4 nov · 10:00" quando il cliente è riconosciuto e ha un
   appuntamento in arrivo. L'altezza non cambia: niente salti.

   Varianti: "coppia" (hero e footer, accanto a Prenota), "barra" (testo,
   da md) e "icona" (44 px, sotto md, solo con un appuntamento in arrivo). */

const CURVA = [0.16, 1, 0.3, 1] as const;

/** "Mer 4 nov · 10:00": lo stesso formato della striscia dei giorni del widget. */
export function etichettaProssimo(p: { data: string; ora: string }) {
  return `${GIORNI_BREVI[giornoDellaData(p.data)]} ${Number(p.data.slice(8, 10))} ${MESI[Number(p.data.slice(5, 7)) - 1]} · ${p.ora}`;
}

type Props = {
  origine: OrigineGestione;
  variante?: "coppia" | "barra" | "icona";
  suScuro?: boolean;
  className?: string;
};

export function MioAppuntamentoButton({ origine, variante = "coppia", suScuro = true, className }: Props) {
  const miei = useMiei();
  const ridotto = useReducedMotion();
  const riempimento = useMotionValue("101%");
  const durata = ridotto ? 0 : 0.55;
  const riempi = () => animate(riempimento, ["101%", "0%"], { duration: durata, ease: CURVA });
  const svuota = () => {
    if (riempimento.get() === "101%") return;
    animate(riempimento, "-101%", { duration: durata, ease: CURVA });
  };
  const entra = (e: PointerEvent<HTMLButtonElement>) => e.pointerType === "mouse" && riempi();
  const esce = (e: PointerEvent<HTMLButtonElement>) => e.pointerType === "mouse" && svuota();
  const focus = (e: FocusEvent<HTMLButtonElement>) => e.currentTarget.matches(":focus-visible") && riempi();

  const prossimo = miei.riconosciuto && miei.prossimo ? etichettaProssimo(miei.prossimo) : null;

  if (variante === "icona") {
    // Fra md e lg, e solo quando serve (sotto md spingerebbe il logo).
    if (!prossimo) return null;
    return (
      <button
        type="button"
        onClick={() => apriGestione(origine)}
        aria-label={`Il mio appuntamento: ${prossimo}`}
        className={cn("flex size-11 cursor-pointer items-center justify-center", className)}
      >
        <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3.5" y="5" width="17" height="15.5" />
          <path d="M3.5 10h17M8 3v4M16 3v4M9 15l2 2 4-4" />
        </svg>
      </button>
    );
  }

  const comune = {
    type: "button" as const,
    onClick: () => apriGestione(origine),
    onPointerEnter: entra,
    onPointerLeave: esce,
    onFocus: focus,
    onBlur: svuota,
    "data-mio-appuntamento": origine,
  };

  if (variante === "barra") {
    return (
      <button
        {...comune}
        className={cn(
          "group eyebrow relative isolate inline-flex min-h-11 cursor-pointer items-center justify-center overflow-hidden border px-4 md:px-5",
          suScuro ? "border-paper text-paper" : "border-ink text-ink",
          className,
        )}
      >
        {/* Su fondo scuro come "Prenota" (bianco che sale, testo in
            difference). Su fondo chiaro il difference renderebbe il testo
            bianco su bianco: lì sale il nero e il testo passa al bianco. */}
        <motion.span aria-hidden style={{ y: riempimento }} className={cn("absolute inset-0 -z-10", suScuro ? "bg-paper" : "bg-ink")} />
        <span
          className={cn(
            suScuro
              ? "mix-blend-difference"
              : "transition-colors duration-300 [@media(hover:hover)]:group-hover:text-paper group-focus-visible:text-paper",
          )}
        >
          Il mio appuntamento
        </span>
      </button>
    );
  }

  return (
    <button
      {...comune}
      className={cn(
        "relative isolate inline-flex h-14 cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden border px-6 text-paper",
        suScuro ? "border-paper" : "border-ink",
        className,
      )}
    >
      {/* Contorno: il fondo resta quello della sezione; al passaggio sale il
          bianco e il testo in difference diventa nero, come in "Prenota". */}
      <motion.span aria-hidden style={{ y: riempimento }} className="absolute inset-0 -z-10 bg-paper" />
      <span className="eyebrow mix-blend-difference">Il mio appuntamento</span>
      <span className="info mix-blend-difference">{prossimo ?? "Sposta o disdici"}</span>
    </button>
  );
}

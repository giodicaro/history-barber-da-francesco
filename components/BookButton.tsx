"use client";

import type { FocusEvent, PointerEvent, ReactNode } from "react";
import { animate, motion, useMotionValue, useReducedMotion } from "framer-motion";
import { apriPrenotazione, type OrigineCta } from "@/lib/prenotazione";
import { cn } from "@/lib/utils";
import { ArrowRight } from "./icons";

const CURVA = [0.16, 1, 0.3, 1] as const;

type Props = {
  origine: OrigineCta;
  children?: ReactNode;
  size?: "md" | "lg";
  // Su fondo nero il bottone resta nero: il bordo bianco gli dà il contorno.
  suScuro?: boolean;
  className?: string;
};

/* Unico bottone "Prenota" del sito: nero pieno, testo bianco.

   Al passaggio del mouse resta fermo al suo posto e si riempie di bianco dal
   basso; uscendo, il bianco prosegue verso l'alto. Il testo è in
   mix-blend-difference dentro un gruppo isolato: diventa nero esattamente
   dove il riempimento lo attraversa, riga per riga di pixel.

   È un link segnaposto (href="#") come da brief: il clic non segue l'ancora
   e passa da lib/prenotazione.ts, dove verrà innestato il sistema nativo. */
export function BookButton({ origine, children = "Prenota", size = "md", suScuro = false, className }: Props) {
  const ridotto = useReducedMotion();

  // La posizione del riempimento è solo di framer-motion. Niente classi
  // translate-y di Tailwind: in v4 usano la proprietà CSS "translate", che si
  // somma al "transform" di framer e sposterebbe i conti di un'altezza intera.
  const riempimento = useMotionValue("101%");
  const durata = ridotto ? 0 : 0.55;
  const riempi = () => animate(riempimento, ["101%", "0%"], { duration: durata, ease: CURVA });
  // Se il bottone non è mai stato riempito (101%, sotto) non c'è niente da
  // svuotare: animarlo verso -101% lo farebbe attraversare tutto, un lampo.
  const svuota = () => {
    if (riempimento.get() === "101%") return;
    animate(riempimento, "-101%", { duration: durata, ease: CURVA });
  };

  // Solo mouse: su touch l'hover non esiste e il riempimento resterebbe
  // acceso dopo il tocco.
  const entra = (e: PointerEvent<HTMLAnchorElement>) => {
    if (e.pointerType === "mouse") riempi();
  };

  const esce = (e: PointerEvent<HTMLAnchorElement>) => {
    if (e.pointerType === "mouse") svuota();
  };

  // Da tastiera l'inversione fa da indicatore di focus, insieme all'anello.
  const focus = (e: FocusEvent<HTMLAnchorElement>) => {
    if (e.currentTarget.matches(":focus-visible")) riempi();
  };

  return (
    <a
      href="#"
      data-prenota={origine}
      onClick={(e) => {
        e.preventDefault();
        apriPrenotazione(origine);
      }}
      onPointerEnter={entra}
      onPointerLeave={esce}
      onFocus={focus}
      onBlur={svuota}
      className={cn(
        "eyebrow relative isolate inline-flex cursor-pointer items-center justify-center overflow-hidden border bg-ink text-paper",
        suScuro ? "border-paper" : "border-ink",
        size === "lg" ? "min-h-14 px-8" : "min-h-11 px-4 md:px-5",
        className,
      )}
    >
      {/* inset-0 e non oltre: il bordo resta visibile anche a bottone pieno,
          così su fondo chiaro l'inversione ha ancora il suo contorno nero. */}
      <motion.span
        data-riempimento
        aria-hidden
        style={{ y: riempimento }}
        className="absolute inset-0 -z-10 bg-paper"
      />
      <span className="flex items-center gap-3 text-paper mix-blend-difference">
        <span>{children}</span>
        <ArrowRight className="size-3.5" />
      </span>
    </a>
  );
}

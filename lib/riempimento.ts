"use client";

import { useRef } from "react";

/* Riempimento dei bottoni "Prenota" e "Il mio appuntamento" al passaggio del
   mouse: il fondo sale dal basso (101% → 0%) e, uscendo, prosegue verso
   l'alto (→ -101%), ripartendo dal punto in cui si trova.

   Web Animations API del browser invece di framer-motion: stesso movimento
   (curva e durata identiche, verificate fotogramma per fotogramma), ma
   framer non entra più nel JavaScript della prima apertura. */

const CURVA = "cubic-bezier(0.16, 1, 0.3, 1)";
const DURATA = 550;

export function useRiempimento<T extends HTMLElement>() {
  const fondo = useRef<T>(null);
  const corrente = useRef<Animation | null>(null);
  // Dove sta (o sta andando) il fondo: "101%" = sotto, mai riempito.
  const meta = useRef("101%");

  const vai = (da: string | null, a: string) => {
    const el = fondo.current;
    if (!el) return;
    // Il punto di partenza si legge prima di fermare l'animazione in corso:
    // lo stile calcolato la comprende.
    const partenza = da ?? getComputedStyle(el).transform;
    corrente.current?.cancel();
    el.style.transform = `translateY(${a})`;
    meta.current = a;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    corrente.current = el.animate([{ transform: partenza }, { transform: `translateY(${a})` }], {
      duration: DURATA,
      easing: CURVA,
    });
  };

  const riempi = () => vai("translateY(101%)", "0%");
  // Se il bottone non è mai stato riempito non c'è niente da svuotare:
  // animarlo verso -101% lo farebbe attraversare tutto, un lampo.
  const svuota = () => {
    if (meta.current === "101%") return;
    vai(null, "-101%");
  };

  return { fondo, riempi, svuota };
}

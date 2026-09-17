"use client";

import { useEffect, useLayoutEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Registrato una volta sola, e solo nel browser: ScrollTrigger legge window
// al momento della registrazione.
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export { gsap, ScrollTrigger };

// useLayoutEffect nel browser, così lo stato iniziale delle animazioni viene
// applicato prima del primo disegno; useEffect sul server, dove l'altro avvisa.
export const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// Curva unica del sito: partenza decisa, arrivo lungo.
export const EASE = "expo.out";

/* Presa in carico degli elementi che il CSS parte nascondendo
   ([data-reveal], [data-slide], [data-mask-line]).

   Ogni elemento preso in carico riceve data-animato: da quel momento la rete
   di sicurezza in globals.css (che dopo qualche secondo mostra comunque gli
   elementi rimasti orfani) non lo tocca più, e la sua comparsa è affare di
   GSAP.

   Se un elemento è già visibile perché la rete di sicurezza è scattata prima
   di noi (JavaScript arrivato molto tardi), lo si fissa visibile e non lo si
   anima: nasconderlo di nuovo per farlo ricomparire sarebbe un lampo.

   Restituisce solo gli elementi ancora da animare. */
export function prendiInCarico<T extends HTMLElement>(elementi: T[]): T[] {
  const daAnimare: T[] = [];
  for (const el of elementi) {
    if (el.hasAttribute("data-animato")) continue;
    // Per le maschere conta la riga interna, che è quella traslata.
    const mobile = (el.hasAttribute("data-mask-line") ? el.firstElementChild : el) as HTMLElement | null;
    const stile = mobile ? getComputedStyle(mobile) : null;
    const giaVisibile =
      !!stile && (el.hasAttribute("data-mask-line") ? stile.transform === "none" : parseFloat(stile.opacity) > 0);
    // Valori in linea e non clearProps: senza la rete di sicurezza (che non
    // si applica più agli elementi marcati) tornerebbe a valere lo stato
    // nascosto del CSS.
    if (giaVisibile && mobile) gsap.set(mobile, { opacity: 1, y: 0, yPercent: 0 });
    el.setAttribute("data-animato", "");
    if (!giaVisibile) daAnimare.push(el);
  }
  return daAnimare;
}

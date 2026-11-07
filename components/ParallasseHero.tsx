"use client";

import { gsap, prefersReducedMotion, useIsoLayoutEffect } from "@/lib/gsap";

// Di quanto sale la foto mentre la hero esce dallo schermo, in % della sua
// altezza. Oltre il 15% sul mobile si vede il bordo del contenitore.
const PARALLASSE = 12;

/* La parallasse della foto della hero, unica parte della hero che ha bisogno
   di JavaScript. Sta in un componente a sé, che non disegna nulla: la hero
   resta un componente server e il browser non deve idratarla tutta (testi,
   griglia, foto) solo per questo. */
export function ParallasseHero() {
  useIsoLayoutEffect(() => {
    const sezione = document.querySelector<HTMLElement>("[data-hero]");
    if (!sezione || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.to("[data-hero-parallax]", {
        yPercent: PARALLASSE,
        ease: "none",
        scrollTrigger: { trigger: sezione, start: "top top", end: "bottom top", scrub: true },
      });
    }, sezione);
    return () => ctx.revert();
  }, []);

  return null;
}

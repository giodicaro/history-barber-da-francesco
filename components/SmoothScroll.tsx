"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { ReactLenis, useLenis, type LenisRef } from "lenis/react";
import { gsap, prefersReducedMotion, ScrollTrigger } from "@/lib/gsap";

export function SmoothScroll({ children }: { children: ReactNode }) {
  const lenisRef = useRef<LenisRef>(null);

  // Un solo requestAnimationFrame per tutto il sito: Lenis avanza dal ticker
  // di GSAP. Con due loop separati le animazioni legate allo scroll vanno
  // fuori fase rispetto allo scorrimento morbido e tremano.
  useEffect(() => {
    const avanza = (tempo: number) => lenisRef.current?.lenis?.raf(tempo * 1000);
    gsap.ticker.add(avanza);
    gsap.ticker.lagSmoothing(0);
    return () => gsap.ticker.remove(avanza);
  }, []);

  useLenis(() => ScrollTrigger.update());

  return (
    <ReactLenis root ref={lenisRef} options={{ autoRaf: false, lerp: 0.1 }}>
      {children}
    </ReactLenis>
  );
}

/* Scorrimento verso una sezione. Lenis legge lo scroll-margin-top del
   bersaglio, quindi l'altezza della barra è compensata da CSS in un punto
   solo (scroll-mt-(--nav-h) sulle sezioni), sia qui sia nel salto nativo che
   avviene senza JavaScript. */
export function useVaiASezione() {
  const lenis = useLenis();

  return useCallback(
    (id: string) => {
      const bersaglio = document.getElementById(id);
      if (!bersaglio) return;

      const approdo = () => bersaglio.focus({ preventScroll: true });
      if (lenis) {
        // force: il menu ha appena riattivato Lenis e il suo stato interno
        // può essere ancora "fermo" in questo stesso fotogramma.
        lenis.scrollTo(bersaglio, { force: true, duration: 1.4, onComplete: approdo });
      } else {
        bersaglio.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth" });
        approdo();
      }
      history.replaceState(null, "", `#${id}`);
    },
    [lenis],
  );
}

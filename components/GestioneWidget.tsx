"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLenis } from "lenis/react";
import { ascoltaGestione } from "@/lib/gestione";
import { apriPrenotazione } from "@/lib/prenotazione";
import { SpazioCliente } from "./gestione/SpazioCliente";

/* "Il mio appuntamento" nella home: il foglio gemello del widget di
   prenotazione (BookingWidget), con gli stessi comportamenti: dialog
   modale, pagina sotto inerte, Lenis fermo, Esc chiude, Tab gira dentro.

   Lo aprono i bottoni "Il mio appuntamento" (lib/gestione.ts) e l'indirizzo
   /?gestione=1, dove porta l'accesso monouso mandato da Francesco. Il
   contenuto è lo stesso della pagina /appuntamento (SpazioCliente). */

export function GestioneWidget() {
  const [aperto, setAperto] = useState(false);
  const foglioRef = useRef<HTMLDivElement>(null);
  const titoloId = useId();
  const lenis = useLenis();
  const chiudi = useCallback(() => setAperto(false), []);

  useEffect(() => {
    const smetti = ascoltaGestione(() => setAperto(true));
    const indirizzo = new URL(window.location.href);
    if (indirizzo.searchParams.get("gestione") === "1") {
      indirizzo.searchParams.delete("gestione");
      window.history.replaceState(null, "", indirizzo.pathname + indirizzo.search + indirizzo.hash);
      // Dopo il montaggio di tutti gli ascoltatori, come un tocco sul bottone.
      setTimeout(() => window.dispatchEvent(new CustomEvent("gestione:apri", { detail: "link" })), 0);
    }
    return smetti;
  }, []);

  useEffect(() => {
    if (!aperto) return;
    const contenuto = document.getElementById("contenuto");
    contenuto?.toggleAttribute("inert", true);
    lenis?.stop();
    return () => {
      contenuto?.toggleAttribute("inert", false);
      lenis?.start();
    };
  }, [aperto, lenis]);

  useEffect(() => {
    if (!aperto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return chiudi();
      if (e.key !== "Tab" || !foglioRef.current) return;
      const fuoco = foglioRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (fuoco.length === 0) return;
      const primo = fuoco[0];
      const ultimo = fuoco[fuoco.length - 1];
      if (e.shiftKey && document.activeElement === primo) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primo.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [aperto, chiudi]);

  // "Prenota ora" / "Prenota un nuovo orario" da dentro il foglio: si chiude
  // questo e si apre il widget di prenotazione.
  const prenota = () => {
    setAperto(false);
    setTimeout(() => apriPrenotazione("gestione"), 350);
  };

  return (
    <AnimatePresence>
      {aperto && (
        <motion.div
          key="gestione"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titoloId}
          className="fixed inset-0 z-50 bg-ink/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onMouseDown={(e) => e.target === e.currentTarget && chiudi()}
        >
          <motion.div
            ref={foglioRef}
            className="absolute inset-x-0 bottom-0 top-0 mx-auto flex max-w-2xl flex-col bg-paper text-ink md:inset-y-6 md:border md:border-ink"
            initial={{ y: "4%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "3%", opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <header className="flex items-center justify-between border-b border-ink px-5 py-4 md:px-8">
              <div>
                <p className="eyebrow text-steel">History Barber</p>
                <h2 id={titoloId} className="mt-1 text-xl font-extrabold tracking-[-0.02em] md:text-2xl">
                  Il mio appuntamento
                </h2>
              </div>
              <button
                type="button"
                onClick={chiudi}
                className="eyebrow -mr-2 flex min-h-11 cursor-pointer items-center px-2 text-steel hover:text-ink"
              >
                Chiudi ✕
              </button>
            </header>
            <div className="shell flex-1 overflow-y-auto overscroll-contain py-6 md:px-8" data-lenis-prevent>
              <SpazioCliente onPrenota={prenota} />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { EVENTO_GESTIONE } from "@/lib/gestione";
import { EVENTO_PRENOTAZIONE } from "@/lib/prenotazione";

/* I due fogli della home (prenotazione e "Il mio appuntamento") non si vedono
   finché non li si apre: il loro codice si scarica quando il browser è
   libero, e si montano al primo tocco o tasto. Così non rallentano il primo
   caricamento sul telefono (erano due "long task" durante l'avvio).

   Se il cliente tocca un bottone prima, si caricano subito: la richiesta
   d'apertura aspetta in lib/prenotazione.ts / lib/gestione.ts e arriva al
   foglio appena si monta. Anche ?prenota=… e ?gestione=1 nell'indirizzo li
   leggono i fogli stessi al montaggio. */

const caricaPrenotazione = () => import("./BookingWidget");
const caricaGestione = () => import("./GestioneWidget");
const BookingWidget = dynamic(() => caricaPrenotazione().then((m) => m.BookingWidget), { ssr: false });
const GestioneWidget = dynamic(() => caricaGestione().then((m) => m.GestioneWidget), { ssr: false });
// Primo segno di vita del cliente: da lì in poi i fogli devono essere pronti.
const INTERAZIONI = ["pointerdown", "keydown", "touchstart"] as const;

export function FogliDifferiti() {
  const [pronti, setPronti] = useState(false);

  useEffect(() => {
    const subito = () => setPronti(true);
    const url = new URLSearchParams(window.location.search);
    // Indirizzo che chiede un foglio (notifica, accesso da WhatsApp): subito.
    if (url.has("prenota") || url.has("gestione")) {
      const t = setTimeout(subito, 0);
      return () => clearTimeout(t);
    }
    window.addEventListener(EVENTO_PRENOTAZIONE, subito);
    window.addEventListener(EVENTO_GESTIONE, subito);
    INTERAZIONI.forEach((e) => window.addEventListener(e, subito, { once: true, passive: true }));
    // Nel frattempo, a browser libero, solo il download del codice.
    const scarica = () => void Promise.all([caricaPrenotazione(), caricaGestione()]).catch(() => {});
    const idle = window.requestIdleCallback?.(scarica, { timeout: 5000 });
    const riserva = idle === undefined ? setTimeout(scarica, 3000) : undefined;
    return () => {
      window.removeEventListener(EVENTO_PRENOTAZIONE, subito);
      window.removeEventListener(EVENTO_GESTIONE, subito);
      INTERAZIONI.forEach((e) => window.removeEventListener(e, subito));
      if (idle !== undefined) window.cancelIdleCallback(idle);
      clearTimeout(riserva);
    };
  }, []);

  if (!pronti) return null;
  return (
    <>
      <BookingWidget />
      <GestioneWidget />
    </>
  );
}

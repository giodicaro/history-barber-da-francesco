"use client";

import { useEffect } from "react";

/* Registra il service worker di "Il mio stile" (public/sw-stile.js) e gli
   chiede di salvare subito questa pagina, le sue foto e i file del sito che
   servono a disegnarla. Così, vista una volta online, la pagina si riapre
   anche in modalità aereo.

   Lo scope resta "/stile/": uno più largo prenderebbe anche /admin, dove le
   notifiche dell'agenda dipendono da sw-agenda.js. */

export function RegistraSW({ foto }: { foto: string[] }) {
  // Una stringa come dipendenza: l'effetto riparte solo se le foto cambiano.
  const elenco = foto.join("\n");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
    let vivo = true;

    navigator.serviceWorker
      .register("/sw-stile.js", { scope: "/stile/" })
      .then(() => navigator.serviceWorker.ready)
      .then((registrazione) => {
        if (!vivo) return;
        // I file già caricati dalla pagina prima che il service worker la
        // controllasse: CSS, JavaScript e font hanno nomi con l'hash.
        const statici = performance
          .getEntriesByType("resource")
          .map((r) => r.name)
          .filter((u) => {
            const url = new URL(u);
            return url.origin === location.origin && url.pathname.startsWith("/_next/static/");
          });
        registrazione.active?.postMessage({
          tipo: "precarica",
          pagina: location.pathname,
          file: [...elenco.split("\n").filter(Boolean), ...statici],
        });
      })
      .catch(() => {
        // Niente service worker (navigazione privata, browser vecchio): la
        // pagina funziona lo stesso, solo non offline.
      });

    // Aperta come app dalla schermata Home: si chiede al browser di non
    // cancellare la copia offline quando manca spazio. Solo lì, perché
    // Firefox lo chiede con una finestra.
    if (window.matchMedia("(display-mode: standalone)").matches) void navigator.storage?.persist?.().catch(() => {});

    return () => {
      vivo = false;
    };
  }, [elenco]);

  return null;
}

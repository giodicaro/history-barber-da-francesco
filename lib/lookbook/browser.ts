"use client";

import { useSyncExternalStore } from "react";

/* Ciò che dipende dal browser e non esiste sul server (rete, app installata,
   iPhone, fotocamera, condivisione), letto con useSyncExternalStore: sul
   server e nel primo render vale il valore "prudente", poi quello vero,
   senza setState negli effetti e senza differenze d'idratazione. */

const nessunaIscrizione = () => () => {};

function ascoltaRete(avvisa: () => void) {
  window.addEventListener("online", avvisa);
  window.addEventListener("offline", avvisa);
  return () => {
    window.removeEventListener("online", avvisa);
    window.removeEventListener("offline", avvisa);
  };
}

/** false solo quando il browser sa di essere senza rete. */
export const useInLinea = () =>
  useSyncExternalStore(ascoltaRete, () => navigator.onLine, () => true);

const MODO_APP = "(display-mode: standalone)";

function ascoltaModo(avvisa: () => void) {
  const m = window.matchMedia(MODO_APP);
  m.addEventListener("change", avvisa);
  return () => m.removeEventListener("change", avvisa);
}

const installata = () =>
  window.matchMedia(MODO_APP).matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** Aperta dalla schermata Home, come app. */
export const useInstallata = () => useSyncExternalStore(ascoltaModo, installata, () => true);

const suIOS = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export const useSuIOS = () => useSyncExternalStore(nessunaIscrizione, suIOS, () => false);

/** Il viewfinder dal vivo esiste solo in un contesto sicuro (https o
    localhost): da http://172.20.10.x l'iPhone non ha getUserMedia. */
export const useFotocameraDalVivo = () =>
  useSyncExternalStore(
    nessunaIscrizione,
    () => window.isSecureContext && typeof navigator.mediaDevices?.getUserMedia === "function",
    () => false,
  );

export const useCondivisione = () =>
  useSyncExternalStore(nessunaIscrizione, () => typeof navigator.share === "function", () => false);

/** UUID v4 anche fuori da https: crypto.randomUUID esiste solo nei contesti
    sicuri, getRandomValues ovunque. */
export function nuovoId(): string {
  if (typeof crypto.randomUUID === "function" && window.isSecureContext) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

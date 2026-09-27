"use client";

import { useEffect, useState, useTransition } from "react";
import { attivaNotifiche, disattivaNotifiche, notificaDiProva } from "@/app/admin/azioni";
import { Rotella } from "./FoglioInBasso";

/* Riquadro "Notifiche" in fondo all'agenda: iscrive questo dispositivo alle
   notifiche delle nuove prenotazioni (Web Push, vedi lib/prenotazioni/notifiche.ts).

   Sull'iPhone Apple le permette solo all'agenda aggiunta alla schermata Home
   (iOS 16.4+): in Safari normale il riquadro spiega come installarla. */

type Stato =
  | { tipo: "verifica" }
  | { tipo: "non-supportato" }
  | { tipo: "installa-ios" }
  | { tipo: "negato" }
  | { tipo: "spente" }
  | { tipo: "attive" };

const SCOPE = "/admin";

// La chiave VAPID arriva in base64 "url-safe"; il browser la vuole in byte.
function chiaveInByte(base64: string) {
  const riempita = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const binaria = atob(riempita);
  return Uint8Array.from(binaria, (c) => c.charCodeAt(0));
}

const suIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const installata = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

function nomeDispositivo() {
  const ua = navigator.userAgent;
  const sistema = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Dispositivo";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : "Safari";
  return installata() ? `${sistema} (app)` : `${sistema} · ${browser}`;
}

async function leggiStato(): Promise<Stato> {
  const supportato = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!supportato) return suIOS() && !installata() ? { tipo: "installa-ios" } : { tipo: "non-supportato" };
  if (Notification.permission === "denied") return { tipo: "negato" };
  const registrazione = await navigator.serviceWorker.getRegistration(SCOPE);
  const iscrizione = await registrazione?.pushManager.getSubscription();
  return iscrizione && Notification.permission === "granted" ? { tipo: "attive" } : { tipo: "spente" };
}

export function Notifiche({ chiave }: { chiave: string | null }) {
  const [stato, setStato] = useState<Stato>({ tipo: "verifica" });
  const [messaggio, setMessaggio] = useState("");
  const [inCorso, avvia] = useTransition();

  useEffect(() => {
    let vivo = true;
    leggiStato()
      .then((s) => vivo && setStato(s))
      .catch(() => vivo && setStato({ tipo: "non-supportato" }));
    return () => {
      vivo = false;
    };
  }, []);

  if (!chiave || stato.tipo === "verifica") return null;

  const attiva = () => {
    setMessaggio("");
    // Il permesso va chiesto subito, dentro il tocco: Safari lo nega se prima
    // c'è un'attesa.
    const permesso = Notification.requestPermission();
    avvia(async () => {
      try {
        if ((await permesso) !== "granted") {
          setStato({ tipo: "negato" });
          return;
        }
        const registrazione = await navigator.serviceWorker.register("/sw-agenda.js", { scope: SCOPE });
        await navigator.serviceWorker.ready;
        const iscrizione =
          (await registrazione.pushManager.getSubscription()) ??
          (await registrazione.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chiaveInByte(chiave) }));
        const esito = await attivaNotifiche(iscrizione.toJSON(), nomeDispositivo());
        if (!esito.ok) {
          setMessaggio(esito.errore);
          return;
        }
        setStato({ tipo: "attive" });
        // Subito una notifica di prova: si vede che funziona, qui e ora.
        const prova = await notificaDiProva();
        setMessaggio(prova.ok ? "Fatto: dovresti aver ricevuto una notifica di prova." : prova.errore);
      } catch {
        setMessaggio("Non è stato possibile attivare le notifiche su questo dispositivo. Riprova.");
      }
    });
  };

  const prova = () => {
    setMessaggio("");
    avvia(async () => {
      try {
        const esito = await notificaDiProva();
        setMessaggio(esito.ok ? "Notifica di prova inviata." : esito.errore);
      } catch {
        setMessaggio("Connessione assente: riprova.");
      }
    });
  };

  const disattiva = () => {
    setMessaggio("");
    avvia(async () => {
      try {
        const registrazione = await navigator.serviceWorker.getRegistration(SCOPE);
        const iscrizione = await registrazione?.pushManager.getSubscription();
        if (iscrizione) {
          await disattivaNotifiche(iscrizione.endpoint);
          await iscrizione.unsubscribe();
        }
        setStato({ tipo: "spente" });
        setMessaggio("Notifiche disattivate su questo dispositivo.");
      } catch {
        setMessaggio("Connessione assente: riprova.");
      }
    });
  };

  const bottone =
    "eyebrow flex min-h-12 cursor-pointer items-center justify-center gap-3 border border-ink px-5 transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <section aria-labelledby="titolo-notifiche" className="mt-10 border-t border-ink/15 pt-6">
      <h2 id="titolo-notifiche" className="eyebrow text-steel">
        Notifiche delle prenotazioni
      </h2>

      {stato.tipo === "installa-ios" && (
        <div className="mt-3 max-w-[52ch] text-base">
          <p>Sull&apos;iPhone le notifiche arrivano solo all&apos;agenda installata come app:</p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-steel">
            <li>in Safari tocca il pulsante Condividi (il quadrato con la freccia);</li>
            <li>scegli &ldquo;Aggiungi alla schermata Home&rdquo;;</li>
            <li>apri l&apos;agenda dalla nuova icona HB e torna qui.</li>
          </ol>
        </div>
      )}

      {stato.tipo === "non-supportato" && (
        <p className="mt-3 max-w-[52ch] text-base text-steel">
          Questo browser non riceve notifiche. Sull&apos;iPhone serve iOS 16.4 o successivo.
        </p>
      )}

      {stato.tipo === "negato" && (
        <p className="mt-3 max-w-[52ch] text-base text-steel">
          Le notifiche sono bloccate per l&apos;agenda. Sull&apos;iPhone: Impostazioni → Notifiche → Agenda HB → Consenti.
          Su computer: il lucchetto accanto all&apos;indirizzo → Notifiche → Consenti. Poi ricarica la pagina.
        </p>
      )}

      {(stato.tipo === "spente" || stato.tipo === "attive") && (
        <>
          <p className="mt-3 max-w-[52ch] text-base">
            {stato.tipo === "attive"
              ? "Attive su questo dispositivo: a ogni prenotazione dal sito arriva una notifica."
              : "Ricevi una notifica su questo dispositivo a ogni prenotazione dal sito."}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {stato.tipo === "spente" ? (
              <button type="button" onClick={attiva} disabled={inCorso} className={`${bottone} bg-ink text-paper hover:bg-paper hover:text-ink`}>
                {inCorso && <Rotella />}
                {inCorso ? "Attivazione…" : "Attiva notifiche"}
              </button>
            ) : (
              <>
                <button type="button" onClick={prova} disabled={inCorso} className={`${bottone} hover:bg-ink hover:text-paper`}>
                  {inCorso && <Rotella />}
                  Invia una prova
                </button>
                <button type="button" onClick={disattiva} disabled={inCorso} className={`${bottone} border-ink/30 text-steel hover:border-ink hover:text-ink`}>
                  Disattiva
                </button>
              </>
            )}
          </div>
        </>
      )}

      {messaggio && (
        <p role="status" className="info mt-3 text-steel">
          {messaggio}
        </p>
      )}
    </section>
  );
}

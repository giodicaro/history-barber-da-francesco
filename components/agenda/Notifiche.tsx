"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { attivaNotifiche, disattivaNotifiche, notificaDiProva } from "@/app/admin/azioni";
import { Rotella } from "./FoglioInBasso";

/* Notifiche delle prenotazioni sul telefono (Web Push, vedi
   lib/prenotazioni/notifiche.ts). Due pezzi, con uno stato solo:
   - <Notifiche>, in fondo all'agenda (app/admin/page.tsx), sopra "Esci":
     una riga di stato e l'azione (attiva, prova, disattiva) o le istruzioni;
   - <PromemoriaNotifiche>, in testata accanto al titoletto: una campanella
     barrata da 44 px, solo quando le notifiche non sono attive; porta al
     blocco in fondo.
   Fino al 30/10 c'era un riquadro nero in cima che spingeva la giornata
   sotto la piega: tolto, la giornata viene prima.

   Sull'iPhone Apple le permette solo all'agenda aggiunta alla schermata Home
   (iOS 16.4+): in Safari normale il blocco spiega come fare. */

type Stato =
  | { tipo: "verifica" }
  | { tipo: "non-supportato" }
  | { tipo: "installa-ios" }
  | { tipo: "negato" }
  | { tipo: "spente" }
  | { tipo: "attive" };

const SCOPE = "/admin";
const ID_BLOCCO = "notifiche";

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

/* ── Lo stato, uno per pagina ────────────────────────────────────────────
   Lo leggono testata e blocco in fondo: lo si legge una volta sola, al primo
   che lo chiede. */

let stato: Stato = { tipo: "verifica" };
let letto = false;
const ascoltatori = new Set<() => void>();
const imposta = (s: Stato) => {
  stato = s;
  ascoltatori.forEach((f) => f());
};

function leggiUnaVolta() {
  if (letto) return;
  letto = true;
  leggiStato()
    .then(async (s) => {
      imposta(s);
      // Notifiche attive sul telefono: si ricorda al server l'iscrizione a
      // ogni apertura, così torna a funzionare da sola se il server l'aveva
      // persa (chiavi cambiate, database nuovo). Una volta sola per apertura.
      if (s.tipo === "attive") {
        const iscrizione = await (await navigator.serviceWorker.getRegistration(SCOPE))?.pushManager.getSubscription();
        if (iscrizione) await attivaNotifiche(iscrizione.toJSON(), nomeDispositivo()).catch(() => {});
      }
    })
    .catch(() => imposta({ tipo: "non-supportato" }));
}

function iscrivi(f: () => void) {
  ascoltatori.add(f);
  leggiUnaVolta();
  return () => ascoltatori.delete(f);
}

const VERIFICA: Stato = { tipo: "verifica" };
const useStato = () => useSyncExternalStore(iscrivi, () => stato, () => VERIFICA);

/* ── In testata: la campanella barrata ─────────────────────────────────── */

export function PromemoriaNotifiche({ chiave }: { chiave: string | null }) {
  const s = useStato();
  if (!chiave || !["spente", "installa-ios", "negato"].includes(s.tipo)) return null;
  const vai = () => {
    const blocco = document.getElementById(ID_BLOCCO);
    if (!blocco) return;
    const ridotto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    blocco.scrollIntoView({ behavior: ridotto ? "auto" : "smooth", block: "center" });
    blocco.focus({ preventScroll: true });
  };
  return (
    <button
      type="button"
      onClick={vai}
      aria-label="Notifiche spente: vai alle impostazioni"
      title="Notifiche spente"
      className="-my-2 flex size-11 shrink-0 cursor-pointer items-center justify-center text-steel transition-colors duration-150 hover:text-ink"
    >
      <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M6 16V11a6 6 0 0 1 9.5-4.9M18 11v5l1.5 2h-15" />
        <path d="M10 20.5a2 2 0 0 0 4 0M3.5 3.5l17 17" />
      </svg>
    </button>
  );
}

/* ── In fondo: il blocco ─────────────────────────────────────────────────── */

export function Notifiche({ chiave }: { chiave: string | null }) {
  const s = useStato();
  const [messaggio, setMessaggio] = useState("");
  const [inCorso, avvia] = useTransition();

  if (s.tipo === "verifica") return null;

  const attiva = () => {
    if (!chiave) return;
    setMessaggio("");
    // Il permesso va chiesto subito, dentro il tocco: Safari lo nega se prima
    // c'è un'attesa.
    const permesso = Notification.requestPermission();
    avvia(async () => {
      try {
        if ((await permesso) !== "granted") {
          imposta({ tipo: "negato" });
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
        imposta({ tipo: "attive" });
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
        imposta({ tipo: "spente" });
        setMessaggio("Notifiche disattivate su questo dispositivo.");
      } catch {
        setMessaggio("Connessione assente: riprova.");
      }
    });
  };

  const bottone =
    "eyebrow flex min-h-12 cursor-pointer items-center justify-center gap-3 border border-ink px-5 transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50";
  const comeFare = "eyebrow inline-flex min-h-11 cursor-pointer items-center text-steel underline-offset-4 hover:text-ink hover:underline";

  return (
    <section
      id={ID_BLOCCO}
      tabIndex={-1}
      aria-labelledby="titolo-notifiche"
      // Il focus arriva qui dalla campanella in testata: niente anello, si
      // vede già dove si è arrivati.
      style={{ outline: "none" }}
      className="mt-10 scroll-mt-6 border border-ink/15 bg-paper px-4 py-4 sm:px-5"
    >
      <h2 id="titolo-notifiche" className="eyebrow text-steel">
        Notifiche
      </h2>

      {!chiave ? (
        <p className="info mt-2 text-steel">Non disponibili: sul server mancano le chiavi VAPID (vedi .env.example).</p>
      ) : s.tipo === "non-supportato" ? (
        <p className="info mt-2 text-steel">Questo browser non riceve notifiche.</p>
      ) : s.tipo === "installa-ios" ? (
        <>
          <p className="mt-2 text-base">Su iPhone le notifiche funzionano con l&apos;agenda aggiunta alla Home.</p>
          <details className="mt-1">
            <summary className={comeFare}>Come fare</summary>
            <ol className="mb-1 mt-1 list-decimal space-y-1 pl-5 text-base text-steel">
              <li>in Safari tocca il pulsante Condividi (il quadrato con la freccia);</li>
              <li>scegli &ldquo;Aggiungi alla schermata Home&rdquo;;</li>
              <li>apri l&apos;agenda dalla nuova icona HB: qui comparirà il bottone per attivarle.</li>
            </ol>
          </details>
        </>
      ) : s.tipo === "negato" ? (
        <>
          <p className="mt-2 text-base">Notifiche bloccate.</p>
          <details className="mt-1">
            <summary className={comeFare}>Come sbloccarle</summary>
            <ul className="mb-1 mt-1 space-y-2 text-base text-steel">
              <li>
                <b className="text-ink">iPhone:</b> Impostazioni → Notifiche → Agenda HB → Consenti notifiche.
              </li>
              <li>
                <b className="text-ink">Android:</b> tieni premuta l&apos;icona dell&apos;agenda → Info app → Notifiche → Consenti.
              </li>
              <li>
                <b className="text-ink">Computer:</b> il lucchetto accanto all&apos;indirizzo → Notifiche → Consenti.
              </li>
            </ul>
            <p className="text-base text-steel">Poi riapri l&apos;agenda.</p>
          </details>
        </>
      ) : (
        <>
          <p className="mt-2 text-base">
            {s.tipo === "attive" ? "Notifiche attive su questo telefono" : "Notifiche spente su questo telefono"}
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            {s.tipo === "spente" ? (
              <button type="button" onClick={attiva} disabled={inCorso} className={`${bottone} bg-ink text-paper hover:bg-paper hover:text-ink`}>
                {inCorso && <Rotella />}
                {inCorso ? "Attivazione…" : "Attiva"}
              </button>
            ) : (
              <>
                <button type="button" onClick={prova} disabled={inCorso} className={`${bottone} hover:bg-ink hover:text-paper`}>
                  {inCorso && <Rotella />}
                  Prova
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

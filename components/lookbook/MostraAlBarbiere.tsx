"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { Look } from "@/lib/lookbook/tipi";
import { cn } from "@/lib/utils";
import { CaroselloFoto, dataLook, voceDelLook, type IndirizzoFoto } from "./Pezzi";

/* "Mostra al barbiere": il cliente gira il telefono e il barbiere legge.

   Tutto schermo, nero con testo bianco: il contrasto più alto possibile. Il
   Web non può alzare la luminosità dello schermo, quindi la leggibilità la
   fanno contrasto, dimensione (note ad almeno 28 px) e pulizia.
   - Schermo sempre acceso (Screen Wake Lock), dove il browser lo permette;
     richiesto di nuovo quando la pagina torna visibile, rilasciato alla
     chiusura. Dove non c'è, niente errori.
   - "Specchio" rovescia il contenuto in orizzontale, per leggerlo nel
     riflesso dello specchio del salone. È un'ipotesi da provare con
     Francesco: se non serve, si toglie.
   - Si chiude con la X, con Esc e trascinando in basso la testata. */

const SOGLIA_CHIUSURA = 90;

export function MostraAlBarbiere({
  look,
  indirizzo,
  onChiudi,
}: {
  look: Look;
  indirizzo: IndirizzoFoto;
  onChiudi: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [specchio, setSpecchio] = useState(false);
  const inizio = useRef<number | null>(null);
  const [spostamento, setSpostamento] = useState<number | null>(null);
  const voci = voceDelLook(look);

  useEffect(() => {
    const d = ref.current;
    const daRidare = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (d && !d.open) d.showModal();
    const html = document.documentElement;
    const prima = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = prima;
      if (d?.open) d.close();
      if (daRidare?.isConnected) daRidare.focus({ preventScroll: true });
    };
  }, []);

  // Schermo acceso finché il foglio è aperto.
  useEffect(() => {
    let sentinella: WakeLockSentinel | null = null;
    let aperto = true;
    const chiedi = async () => {
      if (!("wakeLock" in navigator) || document.visibilityState !== "visible") return;
      try {
        const s = await navigator.wakeLock.request("screen");
        if (aperto) sentinella = s;
        else void s.release();
      } catch {
        // Negato (batteria scarica, iframe, browser vecchio): pazienza.
      }
    };
    const tornata = () => {
      // Il sistema rilascia il blocco quando la pagina va in secondo piano.
      if (document.visibilityState === "visible") void chiedi();
    };
    void chiedi();
    document.addEventListener("visibilitychange", tornata);
    return () => {
      aperto = false;
      document.removeEventListener("visibilitychange", tornata);
      void sentinella?.release().catch(() => {});
    };
  }, []);

  const trascinamento = {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (e.pointerType === "mouse" || (e.target as Element).closest("button")) return;
      inizio.current = e.clientY;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Puntatore già rilasciato.
      }
      setSpostamento(0);
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      if (inizio.current !== null) setSpostamento(Math.max(0, e.clientY - inizio.current));
    },
    onPointerUp: (e: PointerEvent<HTMLElement>) => {
      if (inizio.current === null) return;
      const percorso = e.clientY - inizio.current;
      inizio.current = null;
      setSpostamento(null);
      if (percorso > SOGLIA_CHIUSURA) onChiudi();
    },
    onPointerCancel: () => {
      inizio.current = null;
      setSpostamento(null);
    },
  };

  return (
    <dialog
      ref={ref}
      aria-label={`Il mio taglio del ${dataLook(look.data)}, da mostrare al barbiere`}
      onCancel={(e) => {
        e.preventDefault();
        onChiudi();
      }}
      style={spostamento !== null ? { translate: `0 ${spostamento}px`, transition: "none" } : undefined}
      className={cn(
        "m-0 h-dvh max-h-none w-full max-w-none bg-ink p-0 text-paper backdrop:bg-ink open:flex open:flex-col",
        "transition-opacity duration-200 starting:open:opacity-0 motion-reduce:transition-none",
      )}
    >
      <header
        {...trascinamento}
        className="flex shrink-0 touch-none items-center justify-between gap-3 border-b border-paper/20 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]"
      >
        <button
          type="button"
          onClick={() => setSpecchio((v) => !v)}
          aria-pressed={specchio}
          className={cn(
            "eyebrow flex min-h-12 cursor-pointer items-center gap-2 border px-4 transition-colors duration-150",
            specchio ? "border-paper bg-paper text-ink" : "border-paper/30 text-smoke hover:border-paper hover:text-paper",
          )}
        >
          <svg viewBox="0 0 24 24" aria-hidden className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3v18M8 7l-4 5 4 5M16 7l4 5-4 5" />
          </svg>
          Specchio
        </button>
        <p className="info hidden text-smoke sm:block">{dataLook(look.data)}</p>
        <button
          type="button"
          onClick={onChiudi}
          aria-label="Chiudi"
          className="flex size-12 shrink-0 cursor-pointer items-center justify-center text-paper"
        >
          <svg viewBox="0 0 24 24" aria-hidden className="size-7" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M5 5l14 14M19 5L5 19" />
          </svg>
        </button>
      </header>

      <div className={cn("min-h-0 flex-auto overflow-y-auto overscroll-contain", specchio && "-scale-x-100")}>
        <div className="md:grid md:grid-cols-[1.15fr_1fr] md:items-start md:gap-8 md:px-8 md:py-6">
          <CaroselloFoto
            foto={look.foto}
            indirizzo={indirizzo}
            tema="scuro"
            adatta="contieni"
            rientro
            className="h-[62svh] md:h-[calc(100dvh-8rem)]"
          />
          <dl className="px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-4 md:px-0 md:pt-0">
            {voci.length === 0 ? (
              <p className="py-4 text-xl text-smoke">Nessuna nota: guarda le foto.</p>
            ) : (
              voci.map((v) => (
                <div key={v.campo} className="border-t border-paper/20 py-4 first:border-t-0 md:first:border-t">
                  <dt className="eyebrow text-smoke">{v.etichetta}</dt>
                  <dd className="mt-2 break-words text-[clamp(1.75rem,7.5vw,2.5rem)] font-bold leading-[1.1] tracking-[-0.015em]">
                    {v.valore}
                  </dd>
                </div>
              ))
            )}
          </dl>
        </div>
      </div>
    </dialog>
  );
}

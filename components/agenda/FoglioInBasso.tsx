"use client";

import { useEffect, useId, useRef, useState, type PointerEvent, type ReactNode } from "react";

/* Foglio che sale dal basso (bottom sheet) sul telefono, finestra centrata
   da tablet in su.

   È un <dialog> nativo aperto con showModal(): il browser dà gratis la
   trappola del focus, Esc, lo sfondo inerte e il livello più alto della
   pagina (top layer), sopra qualsiasi z-index. Qui si aggiungono:
   - il blocco dello scorrimento sotto;
   - `bloccato`, che impedisce di chiudere mentre un salvataggio è in volo:
     su una rete lenta chiudere a metà lascerebbe il dubbio "è salvato?";
   - la tastiera del telefono: il foglio resta sopra, non sotto;
   - il trascinamento verso il basso per chiudere, dalla testata;
   - il focus che torna al bottone da cui si era aperto.

   Altezza: il foglio è alto quanto il suo contenuto, al massimo lo schermo
   meno un margine. Il corpo ha `flex: 1 1 auto` e NON `flex: 1` (base 0%):
   in una colonna flex senza altezza definita Safari/WebKit legge la base 0%
   come zero, il corpo si riduce al suo padding e il foglio resta "a metà",
   con testata, 40px di campi e il bottone. Con base auto il corpo parte
   dall'altezza vera e, se non ci sta, si restringe e scorre. */

/** Oltre quanti pixel di trascinamento verso il basso il foglio si chiude. */
const SOGLIA_CHIUSURA = 90;

/** Sotto questa differenza è la barra del browser che si muove, non una tastiera. */
const MINIMO_TASTIERA = 80;

export function FoglioInBasso({
  aperto,
  onChiudi,
  sopratitolo,
  titolo,
  bloccato = false,
  tema = "chiaro",
  children,
  piede,
}: {
  aperto: boolean;
  onChiudi: () => void;
  sopratitolo?: ReactNode;
  titolo: ReactNode;
  bloccato?: boolean;
  /** "scuro" per le pagine del cliente (lookbook): nero ink, testo paper. */
  tema?: "chiaro" | "scuro";
  children: ReactNode;
  /** Bottoni d'azione: restano incollati in fondo, sopra la tastiera. */
  piede?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titoloId = useId();
  const inizioTrascinamento = useRef<number | null>(null);
  const [spostamento, setSpostamento] = useState<number | null>(null);
  const [tastiera, setTastiera] = useState<{ sotto: number; altezza: number } | null>(null);

  // Apertura e chiusura. Alla chiusura (o se il foglio viene smontato da
  // aperto, come fa l'agenda) il focus torna dov'era: di solito il "+".
  useEffect(() => {
    const d = ref.current;
    if (!d || !aperto) return;
    const daRidare = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!d.open) d.showModal();
    return () => {
      if (d.open) d.close();
      if (daRidare?.isConnected) daRidare.focus({ preventScroll: true });
    };
  }, [aperto]);

  useEffect(() => {
    if (!aperto) return;
    const html = document.documentElement;
    const prima = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = prima;
    };
  }, [aperto]);

  // Tastiera del telefono. La tastiera non cambia il viewport "di layout" a
  // cui è ancorato il foglio, ma solo quello visibile (visualViewport): senza
  // questo il fondo del foglio, bottone compreso, finirebbe sotto i tasti.
  // Con la tastiera aperta il foglio si appoggia sopra e si accorcia.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!aperto || !vv) return;
    const aggiorna = () => {
      const sotto = Math.round(window.innerHeight - vv.height - vv.offsetTop);
      if (sotto < MINIMO_TASTIERA) {
        setTastiera(null);
        return;
      }
      setTastiera({ sotto, altezza: Math.round(vv.height) });
    };
    vv.addEventListener("resize", aggiorna);
    vv.addEventListener("scroll", aggiorna);
    return () => {
      vv.removeEventListener("resize", aggiorna);
      vv.removeEventListener("scroll", aggiorna);
      setTastiera(null);
    };
  }, [aperto]);

  // Il campo attivo resta in vista nel corpo accorciato. Dopo il rendering,
  // non dentro l'evento: prima il foglio deve aver preso la nuova altezza.
  useEffect(() => {
    if (!tastiera) return;
    const attivo = document.activeElement;
    if (attivo instanceof HTMLElement && ref.current?.contains(attivo)) {
      attivo.scrollIntoView({ block: "nearest" });
    }
  }, [tastiera]);

  const chiudi = () => {
    if (!bloccato) onChiudi();
  };

  const t = TEMI[tema];

  // Trascinamento verso il basso dalla testata (solo dita e penna: col mouse
  // la testata resta selezionabile). Il corpo non trascina: lì si scorre.
  const trascinamento = {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (bloccato || e.pointerType === "mouse") return;
      if ((e.target as Element).closest("button, a, input, select, textarea")) return;
      inizioTrascinamento.current = e.clientY;
      try {
        // Il dito può uscire dalla testata senza perdere il trascinamento.
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Puntatore già rilasciato (tocco annullato dal sistema): pazienza.
      }
      setSpostamento(0);
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      if (inizioTrascinamento.current === null) return;
      setSpostamento(Math.max(0, e.clientY - inizioTrascinamento.current));
    },
    onPointerUp: (e: PointerEvent<HTMLElement>) => {
      if (inizioTrascinamento.current === null) return;
      const percorso = e.clientY - inizioTrascinamento.current;
      inizioTrascinamento.current = null;
      setSpostamento(null);
      if (percorso > SOGLIA_CHIUSURA) chiudi();
    },
    onPointerCancel: () => {
      inizioTrascinamento.current = null;
      setSpostamento(null);
    },
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titoloId}
      aria-modal="true"
      // Esc: il browser chiuderebbe da solo, ma lo stato è di React.
      onCancel={(e) => {
        e.preventDefault();
        chiudi();
      }}
      // Tocco sullo sfondo scuro: il bersaglio è il <dialog> stesso, perché
      // il contenuto lo riempie tutto.
      onClick={(e) => e.target === e.currentTarget && chiudi()}
      style={{
        ...(tastiera && { marginBottom: tastiera.sotto, maxHeight: tastiera.altezza - 12 }),
        ...(spostamento !== null && { translate: `0 ${spostamento}px`, transition: "none" }),
      }}
      className={[
        // Chiuso il <dialog> ha display:none dal browser: "flex" solo da aperto.
        "m-0 mt-auto w-full max-w-none flex-col overflow-hidden p-0 open:flex",
        t.foglio,
        // Altezza massima: 100vh dove dvh non c'è (iOS < 15.4), altrimenti il
        // viewport dinamico, che segue la barra del browser che entra ed esce.
        "max-h-[calc(100vh-1.5rem)] supports-[height:100dvh]:max-h-[calc(100dvh-1.5rem)]",
        "md:m-auto md:max-h-[85vh] md:max-w-lg md:border md:supports-[height:100dvh]:max-h-[85dvh]",
        // Entrata: sale dal basso fino a 0. @starting-style dove c'è
        // (Safari 17.5+, Chrome 117+); altrimenti appare già aperto.
        "translate-y-0 transition-transform duration-300 ease-crisp starting:open:translate-y-full",
        "md:starting:open:translate-y-6 motion-reduce:transition-none",
      ].join(" ")}
    >
      <header
        {...trascinamento}
        className={`flex shrink-0 touch-none items-start justify-between gap-4 border-b px-5 pb-4 pt-3 md:touch-auto md:px-6 md:pt-5 ${t.bordo}`}
      >
        <div className="min-w-0 pt-2 md:pt-0">
          {/* Maniglia: dice "questo è un foglio" e si trascina, solo sul telefono. */}
          <span aria-hidden className={`absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 md:hidden ${t.maniglia}`} />
          {sopratitolo && <p className={`info ${t.secondario}`}>{sopratitolo}</p>}
          <h2 id={titoloId} className="mt-1 text-xl font-extrabold tracking-[-0.02em] md:text-2xl">
            {titolo}
          </h2>
        </div>
        <button
          type="button"
          onClick={chiudi}
          disabled={bloccato}
          aria-label="Chiudi"
          className={`-mr-3 mt-1 flex size-12 shrink-0 cursor-pointer items-center justify-center disabled:cursor-not-allowed disabled:opacity-40 ${t.chiudi}`}
        >
          <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>

      <div className="min-h-0 flex-auto overflow-y-auto overscroll-contain px-5 py-5 [-webkit-overflow-scrolling:touch] md:px-6">
        {children}
      </div>

      {piede && (
        <div className={`shrink-0 border-t px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-6 ${t.piede}`}>
          {piede}
        </div>
      )}
    </dialog>
  );
}

/* Le classi che cambiano col tema. "chiaro" è l'agenda così com'era. */
const TEMI = {
  chiaro: {
    foglio: "bg-paper text-ink backdrop:bg-ink/70 md:border-ink",
    bordo: "border-ink",
    maniglia: "bg-ink/20",
    secondario: "text-steel",
    chiudi: "text-steel hover:text-ink",
    piede: "border-ink bg-paper",
  },
  scuro: {
    foglio: "border-t border-paper/25 bg-ink text-paper backdrop:bg-ink/80 md:border-paper/40",
    bordo: "border-paper/25",
    maniglia: "bg-paper/30",
    secondario: "text-smoke",
    chiudi: "text-smoke hover:text-paper",
    piede: "border-paper/25 bg-ink",
  },
};

/** Rotella di caricamento: eredita il colore del testo. */
export function Rotella({ className = "size-4" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent ${className}`}
    />
  );
}

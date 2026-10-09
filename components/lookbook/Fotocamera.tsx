"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Rotella } from "@/components/agenda/FoglioInBasso";
import { useFotocameraDalVivo } from "@/lib/lookbook/browser";
import { NOMI_POSIZIONE, POSIZIONI, type Posizione } from "@/lib/lookbook/tipi";
import { cn } from "@/lib/utils";

/* Le tre foto del Nuovo look: Dietro · Profilo · Davanti.

   Due modi di scattare, dal più sicuro:
   1. "Scatta" e "Galleria" in ogni riquadro: <input type="file">, con e
      senza `capture`. Funziona ovunque, anche nell'app installata
      sull'iPhone e su http:// in sviluppo, dove la fotocamera dal vivo non
      esiste.
   2. "Scatta in sequenza": mirino dal vivo (getUserMedia) che passa da una
      posizione all'altra. Solo in un contesto sicuro; se il permesso manca o
      la fotocamera non parte, si torna al metodo 1 senza perdere niente.

   Lo stato delle foto (e la compressione) è del foglio che contiene questo
   componente: qui arrivano i file grezzi e si mostrano le anteprime. */

export type Scatto =
  | { stato: "vuoto" }
  | { stato: "lavoro" }
  | { stato: "pronta"; anteprima: string }
  | { stato: "errore"; messaggio: string };

const tratteggio = {
  backgroundImage: "repeating-linear-gradient(135deg, transparent 0 9px, rgb(10 10 10 / 0.07) 9px 11px)",
};

export function Fotocamera({
  scatti,
  onFile,
  onTogli,
  disabilitata,
}: {
  scatti: Record<Posizione, Scatto>;
  onFile: (posizione: Posizione, file: Blob) => void;
  onTogli: (posizione: Posizione) => void;
  disabilitata: boolean;
}) {
  const dalVivo = useFotocameraDalVivo();
  const [mirino, setMirino] = useState(false);
  const [avviso, setAvviso] = useState("");
  const daScattare = POSIZIONI.filter((p) => scatti[p].stato !== "pronta" && scatti[p].stato !== "lavoro");
  const errori = POSIZIONI.filter((p) => scatti[p].stato === "errore");

  return (
    <div>
      {dalVivo && daScattare.length > 0 && (
        <button
          type="button"
          disabled={disabilitata}
          onClick={() => {
            setAvviso("");
            setMirino(true);
          }}
          className="eyebrow mb-3 flex min-h-12 w-full cursor-pointer items-center justify-center gap-3 border border-ink bg-ink px-5 text-paper transition-colors duration-150 hover:bg-paper hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          <IconaFotocamera />
          Scatta in sequenza
        </button>
      )}

      <ul className="grid grid-cols-3 gap-2">
        {POSIZIONI.map((p) => (
          <Riquadro
            key={p}
            posizione={p}
            scatto={scatti[p]}
            disabilitato={disabilitata}
            onFile={(f) => onFile(p, f)}
            onTogli={() => onTogli(p)}
          />
        ))}
      </ul>

      <div aria-live="polite">
        {avviso && <p className="info mt-3 border border-ink px-4 py-3">{avviso}</p>}
        {errori.map((p) => (
          <p key={p} className="info mt-3 border border-ink bg-ink px-4 py-3 text-paper">
            {NOMI_POSIZIONE[p]}: {(scatti[p] as { messaggio: string }).messaggio}
          </p>
        ))}
      </div>

      {mirino && (
        <Mirino
          posizioni={daScattare}
          onScatto={onFile}
          onFine={(messaggio) => {
            setMirino(false);
            if (messaggio) setAvviso(messaggio);
          }}
        />
      )}
    </div>
  );
}

function Riquadro({
  posizione,
  scatto,
  disabilitato,
  onFile,
  onTogli,
}: {
  posizione: Posizione;
  scatto: Scatto;
  disabilitato: boolean;
  onFile: (f: Blob) => void;
  onTogli: () => void;
}) {
  const nome = NOMI_POSIZIONE[posizione];
  const scegli = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    // Svuotato subito: si può riscegliere lo stesso file dopo un errore.
    e.target.value = "";
    if (f) onFile(f);
  };

  return (
    <li className="relative aspect-[3/4] overflow-hidden border border-ink/30" style={scatto.stato === "pronta" ? undefined : tratteggio}>
      <span className="eyebrow absolute left-0 top-0 z-10 bg-ink px-2 py-1 text-paper">{nome}</span>

      {scatto.stato === "pronta" && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- anteprima locale (blob:) */}
          <img src={scatto.anteprima} alt={`Foto ${nome.toLowerCase()}, pronta`} className="absolute inset-0 size-full object-cover" />
          <button
            type="button"
            onClick={onTogli}
            disabled={disabilitato}
            aria-label={`Togli la foto ${nome.toLowerCase()}`}
            className="absolute bottom-0 right-0 flex size-11 cursor-pointer items-center justify-center bg-ink text-paper disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </>
      )}

      {scatto.stato === "lavoro" && (
        <span className="info absolute inset-0 flex flex-col items-center justify-center gap-2 text-steel">
          <Rotella className="size-5" />
          Preparo…
        </span>
      )}

      {(scatto.stato === "vuoto" || scatto.stato === "errore") && (
        <span className="absolute inset-x-0 bottom-0 flex flex-col">
          <BottoneFile etichetta="Scatta" descrizione={`Scatta la foto ${nome.toLowerCase()}`} cattura disabilitato={disabilitato} onChange={scegli} />
          <BottoneFile etichetta="Galleria" descrizione={`Scegli la foto ${nome.toLowerCase()} dalla galleria`} disabilitato={disabilitato} onChange={scegli} />
        </span>
      )}
    </li>
  );
}

function BottoneFile({
  etichetta,
  descrizione,
  cattura = false,
  disabilitato,
  onChange,
}: {
  etichetta: string;
  descrizione: string;
  cattura?: boolean;
  disabilitato: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label
      className={cn(
        "eyebrow flex min-h-11 cursor-pointer items-center justify-center border-t border-ink/30 bg-paper transition-colors duration-150 hover:bg-ink hover:text-paper has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-ink",
        disabilitato && "pointer-events-none opacity-50",
      )}
    >
      {etichetta}
      <input
        type="file"
        accept="image/*"
        {...(cattura ? { capture: "environment" as const } : {})}
        aria-label={descrizione}
        disabled={disabilitato}
        onChange={onChange}
        className="sr-only"
      />
    </label>
  );
}

function IconaFotocamera() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7h4l2-3h6l2 3h4v13H3z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

/* ── Mirino dal vivo ────────────────────────────────────────────────────── */

const MESSAGGIO_SPENTA = "La fotocamera non è attiva. Puoi scattare con l'app Fotocamera o scegliere una foto.";

function spiegaErrore(e: unknown): string {
  const nome = e instanceof DOMException ? e.name : "";
  if (nome === "NotAllowedError" || nome === "SecurityError") {
    return `${MESSAGGIO_SPENTA} Per riattivarla: impostazioni del browser → Fotocamera → Consenti.`;
  }
  if (nome === "NotFoundError" || nome === "OverconstrainedError") {
    return "Non trovo una fotocamera su questo dispositivo. Puoi scegliere una foto dalla galleria.";
  }
  if (nome === "NotReadableError") {
    return `${MESSAGGIO_SPENTA} Forse la sta usando un'altra app: chiudila e riprova.`;
  }
  return MESSAGGIO_SPENTA;
}

function Mirino({
  posizioni,
  onScatto,
  onFine,
}: {
  /** Le posizioni ancora da scattare, nell'ordine. */
  posizioni: Posizione[];
  onScatto: (posizione: Posizione, file: Blob) => void;
  /** Chiusura; con un messaggio se la fotocamera non è partita. */
  onFine: (messaggio?: string) => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [coda] = useState(posizioni);
  const [indice, setIndice] = useState(0);
  const [pronto, setPronto] = useState(false);
  const [scattando, setScattando] = useState(false);
  // Dall'effetto si chiama la versione più recente di onFine senza
  // riavviare la fotocamera a ogni render.
  const fineDallEffetto = useEffectEvent((messaggio?: string) => onFine(messaggio));

  useEffect(() => {
    const d = dialogo.current;
    if (d && !d.open) d.showModal();
    let flusso: MediaStream | null = null;
    let vivo = true;
    const ferma = () => flusso?.getTracks().forEach((t) => t.stop());

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } }, audio: false })
      .then(async (s) => {
        if (!vivo) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        flusso = s;
        const v = video.current;
        if (!v) return;
        v.srcObject = s;
        await v.play();
        if (vivo) setPronto(true);
      })
      .catch((e) => {
        if (vivo) fineDallEffetto(spiegaErrore(e));
      });

    // Cambio di scheda o app in secondo piano: la fotocamera si spegne
    // (anche per la batteria) e il mirino si chiude.
    const nascosta = () => {
      if (document.visibilityState === "hidden") fineDallEffetto();
    };
    document.addEventListener("visibilitychange", nascosta);

    return () => {
      vivo = false;
      document.removeEventListener("visibilitychange", nascosta);
      ferma();
      if (d?.open) d.close();
    };
  }, []);

  const posizione = coda[indice];

  const avanza = () => {
    if (indice + 1 >= coda.length) onFine();
    else setIndice(indice + 1);
  };

  const scatta = () => {
    const v = video.current;
    if (!v || !pronto || scattando || !v.videoWidth) return;
    setScattando(true);
    const tela = document.createElement("canvas");
    tela.width = v.videoWidth;
    tela.height = v.videoHeight;
    tela.getContext("2d")?.drawImage(v, 0, 0);
    // JPEG di buona qualità: la riduzione e la codifica vere le fa poi
    // lib/lookbook/immagine.ts, come per le foto scelte da file.
    tela.toBlob(
      (blob) => {
        setScattando(false);
        if (blob) onScatto(posizione, blob);
        avanza();
      },
      "image/jpeg",
      0.92,
    );
  };

  return (
    <dialog
      ref={dialogo}
      aria-label={`Fotocamera: foto ${NOMI_POSIZIONE[posizione].toLowerCase()}`}
      onCancel={(e) => {
        // Esc chiude solo il mirino, non il foglio del look che lo contiene.
        e.preventDefault();
        e.stopPropagation();
        onFine();
      }}
      className="m-0 h-dvh max-h-none w-full max-w-none bg-ink p-0 text-paper backdrop:bg-ink open:flex open:flex-col"
    >
      <div className="flex shrink-0 items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <p className="eyebrow" aria-live="polite">
          {indice + 1}/{coda.length} · {NOMI_POSIZIONE[posizione]}
        </p>
        <button
          type="button"
          onClick={() => onFine()}
          aria-label="Chiudi la fotocamera"
          className="flex size-12 cursor-pointer items-center justify-center"
        >
          <svg viewBox="0 0 24 24" aria-hidden className="size-6" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div className="relative min-h-0 flex-auto">
        <video ref={video} playsInline muted autoPlay className="absolute inset-0 size-full object-contain" />
        {!pronto && (
          <p className="info absolute inset-0 flex items-center justify-center gap-3 text-smoke">
            <Rotella /> Accendo la fotocamera…
          </p>
        )}
      </div>

      <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center px-4 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <button type="button" onClick={avanza} className="eyebrow min-h-12 cursor-pointer justify-self-start px-2 text-smoke hover:text-paper">
          Salta
        </button>
        <button
          type="button"
          onClick={scatta}
          disabled={!pronto || scattando}
          aria-label={`Scatta la foto ${NOMI_POSIZIONE[posizione].toLowerCase()}`}
          className="flex size-20 cursor-pointer items-center justify-center border-4 border-paper disabled:opacity-40"
        >
          <span className="size-14 bg-paper" />
        </button>
        <span className="info justify-self-end text-right text-smoke">
          {coda[indice + 1] ? `Poi: ${NOMI_POSIZIONE[coda[indice + 1]]}` : "Ultima"}
        </span>
      </div>
    </dialog>
  );
}

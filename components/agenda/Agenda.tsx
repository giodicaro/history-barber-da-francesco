"use client";

import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useState, useTransition, type MouseEvent } from "react";
import { formatoOra } from "@/lib/orari";
import {
  costruisciTimeline,
  durataLeggibile,
  giornoApertoVicino,
  MINUTI_RIGA,
  statistiche,
  turniDellaData,
} from "@/lib/prenotazioni/agenda";
import type { TipoArchivio } from "@/lib/prenotazioni/db";
import type { VoceAgenda } from "@/lib/prenotazioni/tipi";
import { orari, salone } from "@/lib/salone";
import { cn, formatoPrezzo } from "@/lib/utils";
import { Calendario } from "./Calendario";
import { FoglioInBasso, Rotella } from "./FoglioInBasso";
import { etichettaGiorno, FoglioVoce, type Bersaglio } from "./FoglioVoce";

/* L'agenda di un giorno: navigazione fra i giorni, numeri, timeline.

   I dati arrivano dalla pagina server (app/admin/page.tsx), che li legge dal
   database a ogni richiesta. Cambiare giorno = cambiare ?data= nell'indirizzo:
   la pagina server rilegge quel giorno. Qui non c'è nessuna copia dei dati
   da tenere allineata: statistiche e timeline si calcolano dalle voci
   ricevute, e dopo ogni salvataggio la Server Action ridisegna la pagina.

   Il giorno mostrato in testata è "ottimistico": cambia subito al tocco della
   freccia, mentre la timeline sotto resta velata con la rotella finché il
   giorno nuovo non è arrivato. Su una rete lenta si vede dove si sta andando,
   e due tocchi rapidi portano avanti di due giorni. */

/** Altezza di mezz'ora nella timeline, in rem: le schede crescono con la durata. */
const REM_MEZZORA = 3.5;

/** Indirizzo di un giorno: oggi resta /admin, gli altri ?data=YYYY-MM-DD. */
const indirizzo = (data: string, oggi: string) => (data === oggi ? "/admin" : `/admin?data=${data}`);

type Foglio = null | { tipo: "calendario" } | { tipo: "nuovo"; inizio: number } | { tipo: "voce"; id: string };

export function Agenda({
  data,
  oggi,
  adesso,
  voci,
  archivio,
}: {
  data: string;
  oggi: string;
  /** Minuti dalla mezzanotte a Roma, al momento del rendering. */
  adesso: number;
  voci: VoceAgenda[];
  archivio: TipoArchivio;
}) {
  const router = useRouter();
  const [navigando, avviaNavigazione] = useTransition();
  const [dataMostrata, setDataMostrata] = useOptimistic(data);
  const [foglio, setFoglio] = useState<Foglio>(null);

  // Frecce e "Torna a oggi" sono link veri: funzionano anche prima che React
  // si sia caricato (o se non si carica). Con React attivo il clic passa di
  // qui, per la transizione con il giorno ottimistico e la rotella.
  const clicLink = (d: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    vai(d);
  };

  const vai = (d: string) => {
    setFoglio(null);
    avviaNavigazione(() => {
      setDataMostrata(d);
      router.push(indirizzo(d, oggi), { scroll: false });
    });
  };

  // Un tablet alla cassa resta acceso tutto il giorno: ogni minuto si
  // rileggono le prenotazioni arrivate dal sito. Mai con un foglio aperto
  // (non si cambia la pagina sotto le dita) né con la scheda nascosta.
  useEffect(() => {
    if (foglio) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 60_000);
    return () => clearInterval(timer);
  }, [foglio, router]);

  const turni = turniDellaData(data);
  const righe = costruisciTimeline(voci, turni);
  const numeri = statistiche(voci, turni);
  const eOggi = data === oggi;
  const passato = data < oggi;
  const giornoNome = orari[new Date(`${dataMostrata}T12:00:00Z`).getUTCDay()].giorno;
  const voceAperta = foglio?.tipo === "voce" ? voci.find((v) => v.id === foglio.id) : undefined;
  const bersaglio: Bersaglio | null =
    foglio?.tipo === "nuovo"
      ? { tipo: "nuovo", inizio: foglio.inizio }
      : voceAperta
        ? { tipo: "voce", voce: voceAperta }
        : null;

  return (
    <>
      {archivio === "memoria" && (
        <p className="info mb-6 border border-ink bg-ink px-4 py-3 text-paper">
          Archivio in memoria: manca DATABASE_URL, quindi queste voci spariscono al prossimo riavvio.
          Vedi .env.example e <b>npm run db:init</b>.
        </p>
      )}

      <header className="border-b border-ink pb-5">
        <p className="eyebrow text-steel">{salone.nomeCompleto} · agenda</p>

        {/* Navigazione: freccia, giorno (apre il calendario), freccia. */}
        <div className="mt-4 flex items-stretch gap-2">
          <FrecciaGiorno
            verso={-1}
            href={indirizzo(giornoApertoVicino(dataMostrata, -1), oggi)}
            onClick={clicLink(giornoApertoVicino(dataMostrata, -1))}
          />
          <button
            type="button"
            onClick={() => setFoglio({ tipo: "calendario" })}
            aria-label={`${etichettaGiorno(dataMostrata)}: scegli un altro giorno`}
            className="group flex min-h-14 min-w-0 flex-1 cursor-pointer items-center justify-between gap-3 border border-ink px-3 text-left transition-colors duration-150 hover:bg-fog sm:px-4"
          >
            <span className="min-w-0">
              <span className="display block truncate text-[clamp(1.5rem,7.2vw,3.25rem)] leading-none">
                {giornoNome}
              </span>
              <span className="info mt-1.5 block text-steel">
                {etichettaGiorno(dataMostrata).replace(/^\S+\s/, "")}
                {dataMostrata === oggi && ` · oggi · ${formatoOra(adesso)}`}
              </span>
            </span>
            {navigando ? (
              <Rotella className="size-5" />
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden className="hidden size-5 shrink-0 sm:block" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3.5" y="5" width="17" height="15.5" />
                <path d="M3.5 10h17M8 3v4M16 3v4" />
              </svg>
            )}
          </button>
          <FrecciaGiorno
            verso={1}
            href={indirizzo(giornoApertoVicino(dataMostrata, 1), oggi)}
            onClick={clicLink(giornoApertoVicino(dataMostrata, 1))}
          />
        </div>

        {dataMostrata !== oggi && (
          <a
            href="/admin"
            onClick={clicLink(oggi)}
            className="eyebrow mt-3 inline-flex min-h-11 cursor-pointer items-center text-steel underline-offset-4 hover:text-ink hover:underline"
          >
            ← Torna a oggi
          </a>
        )}

        <dl
          className={cn(
            "mt-5 grid grid-cols-3 border-t border-ink/15 pt-4 transition-opacity duration-200",
            navigando && "opacity-40",
          )}
        >
          <Numero etichetta="Appuntamenti" valore={String(numeri.appuntamenti)} />
          <Numero
            etichetta="Poltrona"
            valore={`${numeri.poltrona}%`}
            nota={turni.length ? `${durataLeggibile(numeri.minutiLiberi)} libere` : undefined}
          />
          <Numero etichetta="Previsto" valore={formatoPrezzo(numeri.previsto)} />
        </dl>
      </header>

      {/* inert durante il cambio di giorno: la timeline vecchia si vede ma
          non si tocca, così non si crea un appuntamento nel giorno sbagliato. */}
      <section aria-busy={navigando} inert={navigando} className="relative">
        {navigando && (
          <p className="info sticky top-4 z-10 mx-auto mt-6 flex w-fit items-center gap-3 border border-ink bg-paper px-4 py-3">
            <Rotella /> Carico {etichettaGiorno(dataMostrata)}…
          </p>
        )}

        <div className={cn("transition-opacity duration-200", navigando && "opacity-30")}>
          {turni.length === 0 && (
            <div className="py-12">
              <p className="display text-3xl">Salone chiuso</p>
              <button
                type="button"
                onClick={() => vai(giornoApertoVicino(data, 1))}
                className="eyebrow mt-6 min-h-12 cursor-pointer border border-ink px-5 hover:bg-ink hover:text-paper"
              >
                {etichettaGiorno(giornoApertoVicino(data, 1))} →
              </button>
            </div>
          )}

          <ol className="mt-6">
            {righe.map((riga) => {
              if (riga.tipo === "pausa") {
                return (
                  <li key={`p${riga.inizio}`} className="info border-t border-dashed border-ink/30 py-3 pl-[4.5rem] text-steel md:pl-24">
                    Pausa pranzo · {formatoOra(riga.inizio)}–{formatoOra(riga.fine)}
                  </li>
                );
              }

              if (riga.tipo === "libero") {
                const trascorso = passato || (eOggi && riga.fine <= adesso);
                const ora = eOggi && adesso >= riga.inizio && adesso < riga.fine;
                return (
                  <li key={`l${riga.inizio}`} className="border-t border-ink/10">
                    <button
                      type="button"
                      onClick={() => setFoglio({ tipo: "nuovo", inizio: riga.inizio })}
                      aria-label={`Libero dalle ${formatoOra(riga.inizio)} alle ${formatoOra(riga.fine)}: aggiungi`}
                      style={{ minHeight: `${Math.max(3, (REM_MEZZORA * (riga.fine - riga.inizio)) / MINUTI_RIGA)}rem` }}
                      className={cn(
                        "group grid w-full cursor-pointer grid-cols-[4.5rem_1fr_auto] items-center text-left transition-colors duration-150 hover:bg-fog active:bg-fog md:grid-cols-[6rem_1fr_auto]",
                        ora && "bg-fog",
                      )}
                    >
                      <span className={cn("info tabular-nums", trascorso ? "text-smoke" : "text-steel")}>
                        {formatoOra(riga.inizio)}
                      </span>
                      <span className={cn("info pl-4", trascorso ? "text-smoke" : "text-steel")}>
                        {ora ? "Adesso · libero" : "Libero"}
                        {riga.fine - riga.inizio < MINUTI_RIGA && ` · ${riga.fine - riga.inizio} min`}
                      </span>
                      <span
                        aria-hidden
                        className="mr-2 flex size-10 items-center justify-center border border-transparent text-steel transition-colors group-hover:border-ink group-hover:text-ink"
                      >
                        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                      </span>
                    </button>
                  </li>
                );
              }

              const v = riga.voce;
              const durata = v.fine - v.inizio;
              const inCorso = eOggi && adesso >= v.inizio && adesso < v.fine;
              return (
                <li key={v.id} className="border-t border-ink/10 py-1">
                  <button
                    type="button"
                    onClick={() => setFoglio({ tipo: "voce", id: v.id })}
                    style={{ minHeight: `${Math.max(3.5, (REM_MEZZORA * durata) / MINUTI_RIGA) - 0.5}rem` }}
                    className="grid w-full cursor-pointer grid-cols-[4.5rem_1fr] items-stretch text-left md:grid-cols-[6rem_1fr]"
                  >
                    <span className="info flex flex-col justify-between py-2 tabular-nums text-ink">
                      <span>{formatoOra(v.inizio)}</span>
                      {durata > MINUTI_RIGA && <span className="text-smoke">{formatoOra(v.fine)}</span>}
                    </span>
                    {v.tipo === "appuntamento" ? (
                      <span className="flex flex-col justify-center border-l-4 border-ink bg-ink px-4 py-3 text-paper transition-opacity duration-150 hover:opacity-90">
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="truncate text-lg font-extrabold tracking-[-0.02em] md:text-xl">
                            {v.cliente.nome}
                          </span>
                          <span className="info shrink-0 tabular-nums text-smoke">{formatoPrezzo(v.prezzo)}</span>
                        </span>
                        <span className="mt-1 truncate text-sm text-smoke">
                          {v.servizioNome} · {durataLeggibile(durata)}
                          {v.cliente.note && " · con nota"}
                        </span>
                        {inCorso && <span className="info mt-2 w-fit bg-paper px-2 py-0.5 text-ink">In corso</span>}
                      </span>
                    ) : (
                      <span
                        className="flex flex-col justify-center border border-ink px-4 py-3 text-ink"
                        style={{
                          // Tratteggio diagonale: "qui non si prenota", senza colori.
                          backgroundImage:
                            "repeating-linear-gradient(135deg, transparent 0 9px, rgb(10 10 10 / 0.09) 9px 11px)",
                        }}
                      >
                        <span className="info">Bloccato · {durataLeggibile(durata)}</span>
                        {v.motivo && <span className="mt-1 text-base font-bold">{v.motivo}</span>}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {archivio === "file" && (
        <p className="info mt-10 text-steel">Archivio locale su file (.data/agenda): i dati restano fra un riavvio e l&apos;altro.</p>
      )}

      <FoglioInBasso
        aperto={foglio?.tipo === "calendario"}
        onChiudi={() => setFoglio(null)}
        sopratitolo="Vai al giorno"
        titolo="Calendario"
      >
        {foglio?.tipo === "calendario" && <Calendario selezionata={dataMostrata} oggi={oggi} onScegli={vai} />}
      </FoglioInBasso>

      {bersaglio && (
        <FoglioVoce
          key={foglio?.tipo === "voce" ? foglio.id : `nuovo-${bersaglio.tipo === "nuovo" ? bersaglio.inizio : ""}`}
          data={data}
          voci={voci}
          bersaglio={bersaglio}
          onChiudi={() => setFoglio(null)}
        />
      )}
    </>
  );
}

function FrecciaGiorno({
  verso,
  href,
  onClick,
}: {
  verso: 1 | -1;
  href: string;
  onClick: (e: MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <a
      href={href}
      onClick={onClick}
      aria-label={verso < 0 ? "Giorno di apertura precedente" : "Giorno di apertura successivo"}
      className="flex w-12 shrink-0 cursor-pointer items-center justify-center border border-ink sm:w-14 transition-colors duration-150 hover:bg-ink hover:text-paper active:bg-ink active:text-paper"
    >
      <svg viewBox="0 0 24 24" aria-hidden className="size-6" fill="none" stroke="currentColor" strokeWidth="2">
        <path d={verso < 0 ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
      </svg>
    </a>
  );
}

function Numero({ etichetta, valore, nota }: { etichetta: string; valore: string; nota?: string }) {
  return (
    <div className="min-w-0">
      <dt className="info truncate text-steel">{etichetta}</dt>
      <dd className="mt-1.5 text-2xl font-extrabold tabular-nums md:text-3xl">{valore}</dd>
      {nota && <dd className="info mt-1 truncate text-steel">{nota}</dd>}
    </div>
  );
}

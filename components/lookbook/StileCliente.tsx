"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { segnaPreferitoCliente } from "@/app/stile/[token]/azioni";
import { FoglioInBasso, Rotella } from "@/components/agenda/FoglioInBasso";
import { Logo } from "@/components/Logo";
import { useInLinea, useInstallata, useSuIOS } from "@/lib/lookbook/browser";
import type { FotoLook, Look } from "@/lib/lookbook/tipi";
import { salone } from "@/lib/salone";
import { cn } from "@/lib/utils";
import { MostraAlBarbiere } from "./MostraAlBarbiere";
import { CaroselloFoto, dataLook, NoteDelLook, Stella, type IndirizzoFoto } from "./Pezzi";
import { RegistraSW } from "./RegistraSW";

/* "Il mio stile", sul telefono del cliente. Nero ink, testo paper.

   Dall'alto: il titolo, l'ultimo taglio in grande con "Mostra al barbiere",
   lo storico a griglia (come il Portfolio del sito) con il filtro dei
   preferiti, e in fondo come prenotare e come cancellare la scheda.

   Funziona anche offline, dopo essere stata vista una volta online: la
   copia la tiene il service worker (RegistraSW, public/sw-stile.js). Senza
   rete la stella si spegne, perché scrivere non si può. */

export type FotoCliente = FotoLook & { mini: string; intera: string };
export type LookCliente = Omit<Look, "foto"> & { foto: FotoCliente[] };

const bottoneChiaro =
  "eyebrow flex min-h-14 w-full cursor-pointer items-center justify-center gap-3 border border-paper bg-paper px-5 text-ink transition-colors duration-150 hover:bg-ink hover:text-paper";

export function StileCliente({ token, nome, looks }: { token: string; nome: string; looks: LookCliente[] }) {
  const inLinea = useInLinea();
  const [dettaglio, setDettaglio] = useState<string | null>(null);
  const [mostra, setMostra] = useState<string | null>(null);
  const [soloPreferiti, setSoloPreferiti] = useState(false);

  const indirizzi = new Map(looks.flatMap((l) => l.foto.map((f) => [f.id, f] as const)));
  const indirizzo: IndirizzoFoto = (id, v) => {
    const f = indirizzi.get(id);
    return f ? (v === "mini" ? f.mini : f.intera) : "";
  };

  const ultimo = looks[0];
  const storico = soloPreferiti ? looks.filter((l) => l.preferito) : looks;
  const lookDettaglio = looks.find((l) => l.id === dettaglio);
  const lookMostrato = looks.find((l) => l.id === mostra);
  const tutteLeFoto = looks.flatMap((l) => l.foto.flatMap((f) => [f.mini, f.intera]));

  return (
    <main className="min-h-svh bg-ink text-paper">
      <RegistraSW foto={tutteLeFoto} />

      <div aria-live="polite" className="sticky top-0 z-20">
        {!inLinea && (
          <p className="info bg-paper px-5 py-2 text-center text-ink">Sei offline: ti mostro l&apos;ultima copia salvata</p>
        )}
      </div>

      <div className="shell max-w-3xl pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-6 md:pt-10">
        <header>
          <div className="flex items-center justify-between gap-4">
            <Logo variante="adattivo" className="h-10 text-paper sm:h-11" />
            <p className="eyebrow text-smoke">History Barber</p>
          </div>
          <h1 className="display mt-12 text-[clamp(3.5rem,22cqi,9rem)]">
            Il tuo
            <br />
            stile
          </h1>
          <p className="info mt-4 text-smoke">
            {nome} · {looks.length === 1 ? "1 taglio" : `${looks.length} tagli`}
          </p>
        </header>

        <InstallaSuIPhone />

        {ultimo ? (
          <>
            <section aria-labelledby="titolo-ultimo" className="mt-12">
              <h2 id="titolo-ultimo" className="eyebrow flex items-baseline justify-between gap-4 text-smoke">
                <span>(01) Ultimo taglio</span>
                <span className="info">{dataLook(ultimo.data)}</span>
              </h2>
              <button
                type="button"
                onClick={() => setDettaglio(ultimo.id)}
                aria-label={`Apri il taglio del ${dataLook(ultimo.data)}`}
                className="group relative mt-4 block aspect-[4/5] w-full cursor-pointer overflow-hidden bg-paper/5"
              >
                {ultimo.foto[0] && (
                  // eslint-disable-next-line @next/next/no-img-element -- rotta protetta dal token
                  <img
                    src={ultimo.foto[0].intera}
                    alt="Foto del tuo ultimo taglio"
                    decoding="async"
                    className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-crisp group-hover:scale-[1.02]"
                  />
                )}
                {ultimo.preferito && <BadgePreferito />}
              </button>
              <p className="mt-4 text-xl font-bold tracking-[-0.01em]">{ultimo.sfumatura ?? ultimo.sopra ?? "Il tuo taglio"}</p>
              {altreNote(ultimo) && <p className="info mt-2 text-smoke">{altreNote(ultimo)}</p>}
              <button type="button" onClick={() => setMostra(ultimo.id)} className={cn(bottoneChiaro, "mt-6")}>
                <IconaSchermo />
                Mostra al barbiere
              </button>
            </section>

            {looks.length > 1 && (
              <section aria-labelledby="titolo-storico" className="mt-14">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 id="titolo-storico" className="eyebrow text-smoke">
                    (02) Storico
                  </h2>
                  <button
                    type="button"
                    onClick={() => setSoloPreferiti((v) => !v)}
                    aria-pressed={soloPreferiti}
                    className={cn(
                      "eyebrow flex min-h-11 cursor-pointer items-center gap-2 border px-4 transition-colors duration-150",
                      soloPreferiti ? "border-paper bg-paper text-ink" : "border-paper/30 text-smoke hover:border-paper hover:text-paper",
                    )}
                  >
                    <Stella piena={soloPreferiti} className="size-4" />
                    Solo i preferiti
                  </button>
                </div>
                {storico.length === 0 ? (
                  <p className="mt-4 border border-paper/20 px-4 py-6 text-base text-smoke">
                    Nessun preferito ancora. Apri un taglio e tocca la stella per ritrovarlo qui.
                  </p>
                ) : (
                  <ul className="mt-4 grid grid-cols-2 md:grid-cols-3">
                    {storico.map((l) => (
                      <li key={l.id}>
                        <button
                          type="button"
                          onClick={() => setDettaglio(l.id)}
                          aria-label={`Taglio del ${dataLook(l.data)}${l.preferito ? ", preferito" : ""}`}
                          className="group relative block aspect-square w-full cursor-pointer overflow-hidden bg-paper/5"
                        >
                          {l.foto[0] && (
                            // eslint-disable-next-line @next/next/no-img-element -- rotta protetta dal token
                            <img
                              src={l.foto[0].mini}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-crisp group-hover:scale-105"
                            />
                          )}
                          <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-linear-to-t from-ink/85 via-ink/40 to-transparent p-3 pt-10 text-left">
                            <span className="info text-paper">{dataLook(l.data)}</span>
                            {l.preferito && <Stella piena className="size-4 shrink-0" />}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </>
        ) : (
          <section className="mt-12 border border-paper/20 px-5 py-8">
            <p className="eyebrow text-smoke">Ancora vuoto</p>
            <p className="mt-3 max-w-[40ch] text-xl font-bold leading-snug">
              Il tuo primo taglio arriva qui dopo il prossimo appuntamento.
            </p>
            <p className="mt-3 max-w-[44ch] text-base text-smoke">
              Francesco fotografa il lavoro finito e annota com&apos;è fatto: la volta dopo ti basta mostrarlo.
            </p>
          </section>
        )}

        <footer className="mt-16 grid gap-8 border-t border-paper/20 pt-8 md:grid-cols-2">
          <div>
            <p className="eyebrow text-smoke">Prenota</p>
            <a href={salone.telefonoHref} className="info mt-3 inline-flex min-h-11 items-center underline underline-offset-4">
              Tel. {salone.telefono}
            </a>
            <Link href="/" className="eyebrow mt-1 flex min-h-11 items-center hover:underline">
              Sul sito →
            </Link>
          </div>
          <div>
            <p className="max-w-[40ch] text-sm text-smoke">
              Questa pagina la vedi solo tu, con il tuo link. Per cancellare la tua scheda chiama il {salone.telefono} o
              passa in salone.
            </p>
            <Link href="/privacy" className="eyebrow mt-3 inline-flex min-h-11 items-center hover:underline">
              Privacy
            </Link>
          </div>
        </footer>
      </div>

      {lookDettaglio && (
        <DettaglioTaglio
          key={lookDettaglio.id}
          token={token}
          look={lookDettaglio}
          indirizzo={indirizzo}
          inLinea={inLinea}
          onMostra={() => setMostra(lookDettaglio.id)}
          onChiudi={() => setDettaglio(null)}
        />
      )}
      {lookMostrato && <MostraAlBarbiere look={lookMostrato} indirizzo={indirizzo} onChiudi={() => setMostra(null)} />}
    </main>
  );
}

function DettaglioTaglio({
  token,
  look,
  indirizzo,
  inLinea,
  onMostra,
  onChiudi,
}: {
  token: string;
  look: LookCliente;
  indirizzo: IndirizzoFoto;
  inLinea: boolean;
  onMostra: () => void;
  onChiudi: () => void;
}) {
  const [inVolo, avvia] = useTransition();
  const [errore, setErrore] = useState("");

  const stella = () =>
    avvia(async () => {
      setErrore("");
      try {
        const r = await segnaPreferitoCliente(token, look.id, !look.preferito);
        if (!r.ok) setErrore(r.errore);
      } catch {
        setErrore("Connessione assente: riprova quando torna la rete.");
      }
    });

  return (
    <FoglioInBasso
      aperto
      onChiudi={onChiudi}
      tema="scuro"
      sopratitolo={dataLook(look.data)}
      titolo={look.sfumatura ?? "Il tuo taglio"}
      piede={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={stella}
            disabled={inVolo || !inLinea}
            aria-pressed={look.preferito}
            aria-label={look.preferito ? "Togli dai preferiti" : "Segna come preferito"}
            className={cn(
              "flex min-h-14 w-16 shrink-0 cursor-pointer items-center justify-center border transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40",
              look.preferito ? "border-paper bg-paper text-ink" : "border-paper/40 hover:border-paper",
            )}
          >
            {inVolo ? <Rotella className="size-5" /> : <Stella piena={look.preferito} className="size-6" />}
          </button>
          <button
            type="button"
            onClick={() => {
              onChiudi();
              onMostra();
            }}
            className={bottoneChiaro}
          >
            <IconaSchermo />
            Mostra al barbiere
          </button>
        </div>
      }
    >
      <div aria-live="polite">
        {errore && <p className="info mb-4 border border-paper px-4 py-3">{errore}</p>}
        {!inLinea && <p className="info mb-4 text-smoke">Offline: la stella si potrà cambiare quando torna la rete.</p>}
      </div>
      <CaroselloFoto foto={look.foto} indirizzo={indirizzo} tema="scuro" />
      <div className="mt-5">
        <NoteDelLook look={look} tema="scuro" />
      </div>
    </FoglioInBasso>
  );
}

/** Sotto il titolo dell'ultimo taglio: le note che il titolo non mostra già. */
const altreNote = (l: LookCliente) =>
  [l.sfumatura ? l.sopra : undefined, l.barba, l.prodotto].filter(Boolean).join(" · ");

function BadgePreferito() {
  return (
    <span className="eyebrow absolute left-0 top-0 flex items-center gap-2 bg-paper px-3 py-2 text-ink">
      <Stella piena className="size-3.5" />
      Preferito
    </span>
  );
}

function IconaSchermo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="6" y="2.5" width="12" height="19" />
      <path d="M10.5 18.5h3" />
    </svg>
  );
}

function InstallaSuIPhone() {
  const suIOS = useSuIOS();
  const installata = useInstallata();
  const [chiuso, setChiuso] = useState(false);
  if (!suIOS || installata || chiuso) return null;

  return (
    <aside aria-label="Aggiungi alla schermata Home" className="relative mt-10 border border-paper/30 px-5 py-5">
      <button
        type="button"
        onClick={() => setChiuso(true)}
        aria-label="Chiudi il suggerimento"
        className="absolute right-1 top-1 flex size-11 cursor-pointer items-center justify-center text-smoke hover:text-paper"
      >
        <svg viewBox="0 0 24 24" aria-hidden className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
      <p className="eyebrow text-smoke">Tienilo sul telefono</p>
      <p className="mt-3 max-w-[36ch] pr-6 text-base font-bold">
        Aggiungi alla schermata Home per averlo sempre con te, anche senza rete.
      </p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-base text-smoke">
        <li>In Safari tocca Condividi (il quadrato con la freccia in su);</li>
        <li>scegli &ldquo;Aggiungi alla schermata Home&rdquo;.</li>
      </ol>
    </aside>
  );
}

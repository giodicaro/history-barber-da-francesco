"use client";

import { useRef } from "react";
import { EASE, gsap, prefersReducedMotion, prendiInCarico, useIsoLayoutEffect } from "@/lib/gsap";
import { fotoHero, salone } from "@/lib/salone";
import { cn } from "@/lib/utils";
import { BookButton } from "./BookButton";
import { GridLines } from "./GridLines";
import { OpenStatus } from "./OpenStatus";
import { Photo } from "./Photo";

// Di quanto sale la foto mentre la hero esce dallo schermo, in % della sua
// altezza. Oltre il 15% sul mobile si vede il bordo del contenitore.
const PARALLASSE = 12;

// Ogni riga è una maschera a sé: il titolo va a capo dove decidiamo noi.
const RIGHE_TITOLO = ["L'eccellenza", "del grooming", "maschile"];

// Righe informative. Sotto i 380px una colonna è larga al massimo 155px e
// "VIA CA' ROSSA 47/A-B" a 12px ne occupa 156: un punto in meno evita che vada
// a capo sul trattino. Stessa regola nei blocchi del menu (Navbar.tsx).
const INFO = "info max-[380px]:text-[0.6875rem]";

// Larghezza a cui la foto è davvero disegnata. È in object-cover in un
// contenitore alto il 116% della hero: su qualsiasi schermo meno largo di
// 2,1:1 comanda l'altezza, e la foto (16:9) è larga 1,16 × 16/9 ≈ 2,08 volte
// la hero. Con "100vw" un telefono scaricherebbe la versione da 640px e la
// allargherebbe quasi tre volte.
const LARGHEZZA_FOTO = "(min-aspect-ratio: 21/10) 100vw, 208vh";

export function Hero() {
  const sezioneRef = useRef<HTMLElement>(null);

  useIsoLayoutEffect(() => {
    const sezione = sezioneRef.current;
    if (!sezione) return;
    const ridotto = prefersReducedMotion();

    const ctx = gsap.context(() => {
      // Presa in carico anche con il movimento ridotto: il segno data-animato
      // tiene lontana la rete di sicurezza del CSS (vedi lib/gsap.ts).
      const righe = prendiInCarico(gsap.utils.toArray<HTMLElement>("[data-mask-line='hero']", sezione));
      const comparse = prendiInCarico(gsap.utils.toArray<HTMLElement>("[data-reveal]", sezione));
      if (ridotto) return;

      const entrata = gsap.timeline({ defaults: { ease: EASE } });
      entrata
        .fromTo("[data-grid-line]", { scaleY: 0, transformOrigin: "top" }, { scaleY: 1, duration: 1.6, stagger: 0.08 }, 0)
        .fromTo("[data-hero-media]", { scale: 1.18 }, { scale: 1, duration: 2.4 }, 0);
      if (righe.length) {
        // yPercent esplicito da 105: il CSS parte già da lì, e dichiarare y: 0
        // evita che GSAP legga quella traslazione come pixel e la sommi.
        entrata.fromTo(
          righe.map((r) => r.firstElementChild),
          { y: 0, yPercent: 105 },
          { yPercent: 0, duration: 1.3, stagger: 0.12 },
          0.25,
        );
      }
      if (comparse.length) {
        entrata.fromTo(comparse, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 1, stagger: 0.08 }, 0.75);
      }

      gsap.to("[data-hero-parallax]", {
        yPercent: PARALLASSE,
        ease: "none",
        scrollTrigger: { trigger: sezione, start: "top top", end: "bottom top", scrub: true },
      });
    }, sezione);

    return () => {
      ctx.revert();
      // Come in RevealOnScroll: niente stili in linea senza niente segno.
      sezione.querySelectorAll("[data-animato]").forEach((el) => el.removeAttribute("data-animato"));
    };
  }, []);

  return (
    <section
      ref={sezioneRef}
      id="top"
      tabIndex={-1}
      data-hero
      data-nav-scuro
      className="relative isolate flex h-svh min-h-[38rem] flex-col overflow-hidden bg-ink text-paper outline-none"
    >
      {/* Tre livelli per tre movimenti: il contenitore scorre in parallasse,
          quello interno fa lo zoom d'entrata. Nessun tween si contende la
          stessa proprietà sullo stesso nodo. */}
      <div data-hero-parallax className="absolute inset-x-0 -top-[8%] -z-10 h-[116%]">
        <div data-hero-media className="absolute inset-0 text-paper md:will-change-transform">
          <Photo
            src={fotoHero.src}
            alt={fotoHero.alt}
            posizione={fotoHero.posizione}
            sizes={LARGHEZZA_FOTO}
            preload
          />
        </div>
      </div>
      {/* Velo: tiene leggibile il testo bianco su qualsiasi foto. Il centro
          non scende sotto il 45%: con la foto attuale la nuca illuminata passa
          dietro l'eyebrow e la prima riga del titolo, e al 25% il contrasto
          scendeva sotto 3:1 (misurato, vedi la bible §9.17). */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-linear-to-b from-ink/80 via-ink/45 to-ink/90" />
      {/* Sentinella per la barra: finché è visibile, la pagina è in cima. */}
      <div data-cima aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-2" />

      <GridLines />

      {/* Tre blocchi: informazioni, titolo, testo con CTA.
          Mobile: distribuiti su tutta l'altezza (justify-between), così lo
          spazio libero si divide in due fasce uguali invece di accumularsi
          tutto sopra il titolo. gap-8 è la distanza minima sugli schermi bassi.
          Desktop: informazioni in alto, titolo e CTA ancorati in basso. */}
      <div className="shell relative flex flex-1 flex-col justify-between gap-8 pb-6 pt-(--nav-h) md:justify-start md:gap-0 md:pb-10">
        {/* Blocchi informativi in monospazio: una colonna della griglia
            ciascuno da md, due righe da due sul mobile (indirizzo e stato
            sopra, orari e telefono sotto). */}
        <div className="grid grid-cols-2 gap-y-5 border-b grid-line py-5 md:grid-cols-4 md:gap-y-4">
          <p data-reveal className={cn(INFO, "pl-3")}>
            {salone.via}
            <br />
            <span className="text-paper/60">
              {salone.cap} {salone.citta} ({salone.provincia})
            </span>
          </p>
          <p data-reveal className={cn(INFO, "order-1 pl-3 md:order-none")}>
            Martedì — Sabato
            <br />
            <span className="text-paper/60">Solo su appuntamento</span>
          </p>
          <p data-reveal className={cn(INFO, "order-1 pl-3 md:order-none")}>
            {/* Padding compensato da margine negativo: area di tocco più alta
                senza spostare le righe. */}
            <a href={salone.telefonoHref} className="-my-3 inline-block py-3 underline-offset-4 hover:underline">
              Tel. {salone.telefono}
            </a>
            <br />
            <span className="text-paper/60">Per appuntamenti</span>
          </p>
          <div data-reveal className="pl-3">
            <OpenStatus className={INFO} />
          </div>
        </div>

        <div className="md:mt-auto">
          <p data-reveal className="eyebrow mb-5 pl-3 text-paper md:mb-8">
            Barbiere a {salone.citta} ({salone.provincia})
          </p>
          {/* "DEL GROOMING" è la riga più larga: 8,98 em in Syne Bold. La
              dimensione è la larghezza del contenuto della shell (100cqi,
              vedi l'utility shell) meno il rientro, divisa per 9,2. */}
          <h1 className="display pl-3 text-[clamp(2rem,calc((100cqi-0.75rem)/9.2),11rem)]">
            {RIGHE_TITOLO.map((riga) => (
              <span key={riga} data-mask-line="hero" className="-mt-[0.12em] block overflow-hidden pt-[0.12em]">
                <span>{riga}</span>
              </span>
            ))}
          </h1>
        </div>

        <div className="grid grid-cols-1 items-end gap-y-5 border-t grid-line pt-5 md:mt-10 md:grid-cols-4">
          <p data-reveal className="max-w-[28rem] pl-3 pr-4 text-base leading-snug text-paper/80 md:col-span-2 md:text-lg">
            Tagli, sfumature e barba curati al millimetro, in Via Ca&apos; Rossa a {salone.citta}.
            Si riceve solo su appuntamento.
          </p>
          <div data-reveal className="pl-3 md:col-span-2 md:justify-self-end md:pl-0">
            <BookButton origine="hero" size="lg" suScuro className="w-full md:w-auto">
              Prenota ora
            </BookButton>
          </div>
        </div>
      </div>
    </section>
  );
}

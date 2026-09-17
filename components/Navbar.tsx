"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { useLenis } from "lenis/react";
import { salone, vociMenu } from "@/lib/salone";
import { cn } from "@/lib/utils";
import { BookButton } from "./BookButton";
import { GridLines } from "./GridLines";
import { Logo } from "./Logo";
import { useVaiASezione } from "./SmoothScroll";

// Tenda del menu: entra dall'alto, esce verso l'alto.
const TENDA = [0.76, 0, 0.24, 1] as const;
const RIVELA = [0.16, 1, 0.3, 1] as const;

/* Il menu è orchestrato con le varianti: la tenda dà il via, l'elenco fa
   partire le voci in sequenza (staggerChildren). Tre stati invece di due
   perché le voci entrano dal basso ed escono verso l'alto. */
const tenda: Variants = {
  chiuso: { clipPath: "inset(0% 0% 100% 0%)" },
  aperto: { clipPath: "inset(0% 0% 0% 0%)", transition: { duration: 0.75, ease: TENDA } },
  uscita: { clipPath: "inset(0% 0% 100% 0%)", transition: { duration: 0.6, ease: TENDA, delay: 0.15 } },
};

const elenco: Variants = {
  aperto: { transition: { delayChildren: 0.3, staggerChildren: 0.07 } },
  uscita: { transition: { staggerChildren: 0.03 } },
};

const voceMenu: Variants = {
  chiuso: { y: "105%" },
  aperto: { y: "0%", transition: { duration: 0.9, ease: RIVELA } },
  uscita: { y: "-105%", transition: { duration: 0.4, ease: TENDA } },
};

const dissolvenza: Variants = {
  chiuso: { opacity: 0 },
  aperto: { opacity: 1, transition: { delay: 0.7, duration: 0.5 } },
  uscita: { opacity: 0, transition: { duration: 0.2 } },
};

export function Navbar() {
  const [aperto, setAperto] = useState(false);
  const [suScuro, setSuScuro] = useState(true);
  const [inCima, setInCima] = useState(true);
  const barraRef = useRef<HTMLElement>(null);
  const bottoneRef = useRef<HTMLButtonElement>(null);
  // Dove andare quando la tenda ha finito di uscire. null = chiusura semplice.
  const destinazione = useRef<string | null>(null);
  const lenis = useLenis();
  const vaiA = useVaiASezione();

  // La barra ha testo bianco sopra le sezioni scure (data-nav-scuro) e nero
  // altrove. Conta la sezione che sta sotto il suo bordo inferiore: la fascia
  // osservata è alta 2px e cade proprio lì. I margini sono in pixel perché
  // dipendono dall'altezza della finestra, quindi si ricalcolano al resize.
  useEffect(() => {
    const scure = document.querySelectorAll("[data-nav-scuro]");
    const visibili = new Set<Element>();
    let osservatore: IntersectionObserver | undefined;

    const osserva = () => {
      osservatore?.disconnect();
      visibili.clear();
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      const altezzaBarra =
        parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav-h")) * rem;
      osservatore = new IntersectionObserver(
        (voci) => {
          for (const v of voci) {
            if (v.isIntersecting) visibili.add(v.target);
            else visibili.delete(v.target);
          }
          setSuScuro(visibili.size > 0);
        },
        // Fascia di 4px a cavallo del bordo: quando una sezione comincia
        // esattamente sotto la barra (come dopo un clic nel menu), conta lei.
        { rootMargin: `-${altezzaBarra - 2}px 0px -${window.innerHeight - altezzaBarra - 2}px 0px` },
      );
      scure.forEach((s) => osservatore?.observe(s));
    };
    osserva();
    window.addEventListener("resize", osserva);

    // Trasparente solo a pagina ferma in cima: appena si scorre, i testi
    // passerebbero sotto la barra e si sovrapporrebbero alle sue voci.
    const cima = document.querySelector("[data-cima]");
    const osservaCima = new IntersectionObserver(([v]) => setInCima(v.isIntersecting));
    if (cima) osservaCima.observe(cima);

    return () => {
      window.removeEventListener("resize", osserva);
      osservatore?.disconnect();
      osservaCima.disconnect();
    };
  }, []);

  // Con il menu aperto la pagina sotto non scorre e non riceve focus.
  useEffect(() => {
    const contenuto = document.getElementById("contenuto");
    contenuto?.toggleAttribute("inert", aperto);
    if (aperto) lenis?.stop();
    else lenis?.start();
  }, [aperto, lenis]);

  useEffect(() => {
    if (!aperto) return;
    const barra = barraRef.current;
    if (!barra) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAperto(false);
        return;
      }
      if (e.key !== "Tab") return;
      // Il focus gira fra barra e tenda, che vivono nello stesso <header>.
      const focusabili = barra.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
      if (focusabili.length === 0) return;
      const primo = focusabili[0];
      const ultimo = focusabili[focusabili.length - 1];
      if (e.shiftKey && document.activeElement === primo) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primo.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [aperto]);

  const chiudiVerso = (id: string | null) => {
    destinazione.current = id;
    setAperto(false);
  };

  const dopoUscita = () => {
    const id = destinazione.current;
    destinazione.current = null;
    if (id) vaiA(id);
    else bottoneRef.current?.focus();
  };

  const chiaro = !aperto && !suScuro;
  const fondo = aperto || (inCima && suScuro) ? "trasparente" : chiaro ? "chiaro" : "scuro";

  return (
    <header
      ref={barraRef}
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-colors duration-300",
        aperto || suScuro ? "text-paper" : "text-ink",
      )}
    >
      {/* Fondo della barra separato dal contenuto, così la tenda del menu può
          stargli dietro senza che la barra la copra. */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-x-0 top-0 h-(--nav-h) border-b transition-[background-color,border-color] duration-300",
          fondo === "chiaro" && "grid-line bg-paper",
          fondo === "scuro" && "grid-line bg-ink",
          fondo === "trasparente" && "border-transparent bg-transparent",
        )}
      />

      <div className="shell relative z-10 grid h-(--nav-h) grid-cols-[1fr_auto_1fr] items-center">
        <button
          ref={bottoneRef}
          type="button"
          aria-expanded={aperto}
          aria-controls="menu-principale"
          onClick={() => (aperto ? chiudiVerso(null) : setAperto(true))}
          className="group -ml-2 flex min-h-11 cursor-pointer items-center gap-3 justify-self-start px-2"
        >
          <span aria-hidden className="relative block h-3 w-7">
            <span
              className={cn(
                "absolute left-0 top-0 h-px w-full bg-current transition-transform duration-500 ease-crisp",
                aperto && "translate-y-1.5 rotate-45",
              )}
            />
            <span
              className={cn(
                "absolute bottom-0 left-0 h-px w-full bg-current transition-transform duration-500 ease-crisp",
                aperto ? "-translate-y-1.5 -rotate-45" : "group-hover:scale-x-50 origin-left",
              )}
            />
          </span>
          <span className="eyebrow hidden sm:inline">{aperto ? "Chiudi" : "Menu"}</span>
        </button>

        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            if (aperto) chiudiVerso("top");
            else vaiA("top");
          }}
          className="flex min-h-11 items-center justify-center"
          aria-label={`${salone.nomeCompleto}, torna all'inizio`}
        >
          {/* Sotto sm, fra hamburger e "Prenota", il logo intero non ci sta:
              resta il monogramma. Il colore segue quello della barra. */}
          <Logo variante="adattivo" className="h-9 sm:h-11 md:h-12" />
        </a>

        <div className="justify-self-end">
          <BookButton origine={aperto ? "menu" : "navbar"} suScuro={!chiaro} />
        </div>
      </div>

      <AnimatePresence onExitComplete={dopoUscita}>
        {aperto && (
          <motion.div
            key="menu"
            id="menu-principale"
            className="fixed inset-0 bg-ink text-paper"
            variants={tenda}
            initial="chiuso"
            animate="aperto"
            exit="uscita"
            data-lenis-prevent
          >
            <GridLines />
            <nav
              aria-label="Menu principale"
              className="shell relative flex h-full flex-col pt-(--nav-h)"
            >
              <motion.ul
                variants={elenco}
                className="my-auto border-t grid-line [@media(hover:hover)]:[&:hover_a:not(:hover)]:opacity-30"
              >
                {vociMenu.map((voce, i) => (
                  <li key={voce.id} className="overflow-hidden border-b grid-line">
                    {/* "PORTFOLIO" è la voce più larga, 6,49 em in Syne Bold. Dal
                        contenuto della shell (100cqi) si tolgono il rientro e lo
                        spazio del numero a destra (3,5rem in tutto), poi si
                        divide per 6,65. In altezza il limite è 12svh, perché le
                        quattro voci stiano sempre in uno schermo. */}
                    <motion.a
                      variants={voceMenu}
                      href={`#${voce.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        chiudiVerso(voce.id);
                      }}
                      className="display flex items-end justify-between gap-4 pb-[0.12em] pl-3 pt-[0.2em] text-[clamp(2rem,min(calc((100cqi-3.5rem)/6.65),12svh),9rem)] transition-opacity duration-300"
                    >
                      <span>{voce.etichetta}</span>
                      <span className="info mb-[0.5em] pr-3 text-smoke">0{i + 1}</span>
                    </motion.a>
                  </li>
                ))}
              </motion.ul>

              {/* Blocchi informativi, come nella hero: anche qui 11px sotto i
                  380px, perché l'indirizzo non vada a capo sul trattino. */}
              <motion.div
                variants={dissolvenza}
                className="info grid grid-cols-2 gap-y-4 pb-6 max-[380px]:text-[0.6875rem] md:grid-cols-4 md:pb-8"
              >
                <p className="pl-3 text-smoke">
                  {salone.via}
                  <br />
                  {salone.cap} {salone.citta} ({salone.provincia})
                </p>
                <p className="pl-3">
                  <a href={salone.telefonoHref} className="underline-offset-4 hover:underline">
                    Tel. {salone.telefono}
                  </a>
                  <br />
                  <span className="text-smoke">Solo su appuntamento</span>
                </p>
                <p className="hidden pl-3 md:block">
                  <a
                    href={salone.instagramHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline-offset-4 hover:underline"
                  >
                    Instagram
                  </a>
                </p>
              </motion.div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

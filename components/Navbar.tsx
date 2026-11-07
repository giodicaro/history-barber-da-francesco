"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useLenis } from "lenis/react";
import { salone } from "@/lib/salone";
import { cn } from "@/lib/utils";
import { BookButton } from "./BookButton";
import { MioAppuntamentoButton } from "./MioAppuntamentoButton";
import { apriGestione } from "@/lib/gestione";
import { Logo } from "./Logo";
import { useVaiASezione } from "./SmoothScroll";

const MenuTenda = dynamic(() => import("./MenuTenda").then((m) => m.MenuTenda), { ssr: false });

export function Navbar() {
  const [aperto, setAperto] = useState(false);
  const [suScuro, setSuScuro] = useState(true);
  const [inCima, setInCima] = useState(true);
  const [tendaPronta, setTendaPronta] = useState(false);
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

  // Codice della tenda a browser libero: aprire il menu poi è immediato.
  useEffect(() => {
    const pronta = () => setTendaPronta(true);
    const idle = window.requestIdleCallback?.(pronta, { timeout: 5000 });
    const riserva = idle === undefined ? setTimeout(pronta, 3000) : undefined;
    return () => {
      if (idle !== undefined) window.cancelIdleCallback(idle);
      clearTimeout(riserva);
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
      // Solo quelli visibili: sotto md il link a Instagram del menu è nascosto
      // (display: none) e, se fosse l'ultimo, il Tab non tornerebbe al primo.
      const focusabili = [...barra.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")].filter(
        (el) => el.getClientRects().length > 0,
      );
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
    // "Il mio appuntamento" dal menu: si apre il suo foglio a tenda chiusa.
    if (destinazione.current === "mio-appuntamento") {
      destinazione.current = null;
      apriGestione("menu");
      return;
    }
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
          onClick={() => {
            setTendaPronta(true);
            if (aperto) chiudiVerso(null);
            else setAperto(true);
          }}
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
          {/* Sotto sm la scritta non si vede: resta per i lettori di schermo,
              che altrimenti sentirebbero un bottone senza nome. */}
          <span className="eyebrow sr-only sm:not-sr-only">{aperto ? "Chiudi" : "Menu"}</span>
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

        {/* "Il mio appuntamento" accanto a "Prenota": testo da lg (fra md e lg
            non ci starebbe senza spostare il logo dal centro), icona da 44 px
            fra md e lg, solo con un appuntamento in arrivo. Sotto md niente:
            a 375 px l'icona spingeva il logo fuori centro (la data resta nel
            bottone della hero). */}
        <div className="flex items-center gap-2 justify-self-end lg:gap-3">
          {!aperto && (
            <div className="hidden md:block lg:hidden">
              <MioAppuntamentoButton origine="navbar" variante="icona" />
            </div>
          )}
          {/* Contenitore a parte: cn() non fonde le classi, e "hidden" sul bottone
              perderebbe contro il suo inline-flex. */}
          {!aperto && (
            <div className="hidden lg:block">
              <MioAppuntamentoButton origine="navbar" variante="barra" suScuro={!chiaro} />
            </div>
          )}
          <BookButton origine={aperto ? "menu" : "navbar"} suScuro={!chiaro} />
        </div>
      </div>

      {/* La tenda arriva a browser libero; se si tocca il bottone prima,
          si carica in quel momento e si apre appena è pronta. */}
      {tendaPronta && <MenuTenda aperto={aperto} dopoUscita={dopoUscita} chiudiVerso={chiudiVerso} />}
    </header>
  );
}

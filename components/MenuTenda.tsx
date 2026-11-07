"use client";

import { AnimatePresence, motion, type Variants } from "framer-motion";
import { salone, vociMenu } from "@/lib/salone";
import { GridLines } from "./GridLines";

/* La tenda del menu, con le sue animazioni (framer-motion). Sta in un file a
   sé perché parte chiusa: la barra la scarica subito dopo l'idratazione, fuori
   dal primo blocco di JavaScript, e framer non entra in quello della prima
   apertura della pagina. */

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

export function MenuTenda({
  aperto,
  dopoUscita,
  chiudiVerso,
}: {
  aperto: boolean;
  dopoUscita: () => void;
  chiudiVerso: (id: string | null) => void;
}) {
  return (
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
                    className="display flex min-h-11 items-end justify-between gap-4 pb-[0.12em] pl-3 pt-[0.2em] text-[clamp(2rem,min(calc((100cqi-3.5rem)/6.65),12svh),9rem)] transition-opacity duration-300"
                  >
                    <span>{voce.etichetta}</span>
                    <span className="info mb-[0.5em] pr-3 text-smoke">0{i + 1}</span>
                  </motion.a>
                </li>
              ))}
            </motion.ul>

            {/* "Il mio appuntamento": una voce del menu, non gigante come le
                sezioni (non è un'ancora della pagina, apre un foglio). */}
            <motion.div variants={dissolvenza} className="mb-6 pl-3 md:mb-8">
              <button
                type="button"
                onClick={() => chiudiVerso("mio-appuntamento")}
                className="eyebrow flex min-h-14 w-full cursor-pointer items-center justify-between gap-4 border border-paper/40 px-5 transition-colors duration-200 hover:border-paper hover:bg-paper hover:text-ink md:w-auto md:min-w-80"
              >
                Il mio appuntamento
                <span aria-hidden>→</span>
              </button>
            </motion.div>

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
                  className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
                >
                  Instagram
                </a>
              </p>
            </motion.div>
          </nav>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

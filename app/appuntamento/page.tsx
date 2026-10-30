import type { Metadata } from "next";
import { CercaAppuntamento } from "@/components/gestione/CercaAppuntamento";
import { PaginaGestione } from "@/components/gestione/Pagina";
import { SpazioCliente } from "@/components/gestione/SpazioCliente";

/* /appuntamento: "Il mio appuntamento" a tutta pagina, lo stesso spazio del
   foglio della home. Ci arrivano l'accesso monouso scaduto (?scaduto=1) e i
   link diretti. In fondo, in disparte, la ricerca con telefono + codice della
   v1, per chi ha ancora un codice consegnato prima del 30/10/2026. Niente
   GSAP, Lenis né framer-motion. */

export const metadata: Metadata = {
  title: "Il mio appuntamento — History Barber da Francesco",
  description: "Sposta o disdici da solo il tuo appuntamento da History Barber da Francesco.",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default async function PaginaMioAppuntamento(props: PageProps<"/appuntamento">) {
  const scaduto = (await props.searchParams).scaduto === "1";
  return (
    <PaginaGestione>
      {scaduto && (
        <p role="status" className="mb-8 border-2 border-dashed border-ink px-4 py-3 text-base">
          Questo accesso è scaduto o è già stato usato. Se ti serve, chiedine uno nuovo al salone.
        </p>
      )}
      <SpazioCliente />
      <details className="mt-12 border-t border-ink/15 pt-5">
        <summary className="eyebrow inline-flex min-h-11 cursor-pointer items-center text-steel hover:text-ink">
          Hai un codice di 6 caratteri?
        </summary>
        <CercaAppuntamento compatta />
      </details>
    </PaginaGestione>
  );
}

import type { Metadata } from "next";
import { PaginaGestione } from "@/components/gestione/Pagina";
import { SpazioCliente } from "@/components/gestione/SpazioCliente";

/* /appuntamento: "Il mio appuntamento" a tutta pagina, lo stesso spazio del
   foglio della home. Ci arrivano l'accesso monouso scaduto (?scaduto=1) e i
   link diretti. Niente GSAP, Lenis né framer-motion. */

export const metadata: Metadata = {
  title: "Il mio appuntamento — History Barber da Francesco",
  description: "Ritrova e disdici da solo il tuo appuntamento da History Barber da Francesco.",
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
    </PaginaGestione>
  );
}

import type { Metadata } from "next";
import { CercaAppuntamento } from "@/components/gestione/CercaAppuntamento";
import { PaginaGestione } from "@/components/gestione/Pagina";

/* /appuntamento: il cliente ritrova il suo appuntamento con telefono +
   codice, per spostarlo o disdirlo. Tutto il resto passa da
   POST /api/appuntamento. */

export const metadata: Metadata = {
  title: "Gestisci il tuo appuntamento — History Barber da Francesco",
  description: "Sposta o disdici da solo il tuo appuntamento da History Barber da Francesco.",
  robots: { index: false, follow: false, nocache: true },
};

export default function PaginaCerca() {
  return (
    <PaginaGestione>
      <CercaAppuntamento />
    </PaginaGestione>
  );
}

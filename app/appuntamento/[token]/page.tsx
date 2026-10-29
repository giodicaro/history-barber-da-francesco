import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GestioneAppuntamento } from "@/components/gestione/GestioneAppuntamento";
import { PaginaGestione } from "@/components/gestione/Pagina";
import { riepilogo, trovaAppuntamento } from "@/lib/prenotazioni/gestione-dati";

/* /appuntamento/<token>: il link personale ricevuto alla prenotazione.

   Il token è la chiave d'accesso: pagina mai indicizzata, mai in cache e
   senza Referer verso le pagine aperte da qui (anche le intestazioni in
   next.config.ts). Token sbagliato o appuntamento già disdetto danno la
   stessa pagina 404. */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Il tuo appuntamento — History Barber da Francesco",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default async function PaginaLink(props: PageProps<"/appuntamento/[token]">) {
  const { token } = await props.params;
  const a = await trovaAppuntamento({ token });
  if (!a) notFound();
  return (
    <PaginaGestione>
      <GestioneAppuntamento credenziale={{ token }} iniziale={riepilogo(a)} conLink />
    </PaginaGestione>
  );
}

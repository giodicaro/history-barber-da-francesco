import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { GestioneChiusure } from "@/components/agenda/GestioneChiusure";
import { NavAdmin } from "@/components/agenda/NavAdmin";
import { oraDiRoma } from "@/lib/orari";
import { elencoChiusure } from "@/lib/prenotazioni/chiusure";

/* "Chiusure e ferie": Francesco aggiunge, modifica, spegne ed elimina i
   periodi in cui il salone è chiuso. Il sito li rispetta da solo (orari,
   prenotazioni, spostamenti) e li annuncia in home finché durano. */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Chiusure e ferie — Agenda History Barber",
  robots: { index: false, follow: false, nocache: true },
};

export default async function PaginaChiusure() {
  const sessione = await auth();
  if (!sessione?.user) redirect("/admin/login");
  const chiusure = await elencoChiusure();
  return (
    <main className="min-h-svh bg-paper pb-[env(safe-area-inset-bottom)] text-ink">
      <div className="shell max-w-3xl py-6 md:py-10">
        <NavAdmin attiva="chiusure" />
        <GestioneChiusure chiusure={chiusure} oggi={oraDiRoma().data} />
      </div>
    </main>
  );
}

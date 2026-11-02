import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { NavAdmin } from "@/components/agenda/NavAdmin";
import { Settimana } from "@/components/agenda/Settimana";
import { dataValida } from "@/lib/chiusure";
import { giornoDellaData, oraDiRoma, sommaGiorni } from "@/lib/orari";
import { disdetteDellIntervallo, vociDellIntervallo } from "@/lib/prenotazioni/archivio";
import { elencoChiusure } from "@/lib/prenotazioni/chiusure";

/* Vista Settimana dell'agenda, da lunedì a domenica: ?data= un giorno
   qualsiasi della settimana (altrimenti oggi). */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Settimana — Agenda History Barber",
  robots: { index: false, follow: false, nocache: true },
};

export default async function PaginaSettimana(props: PageProps<"/admin/settimana">) {
  const sessione = await auth();
  if (!sessione?.user) redirect("/admin/login");

  const parametro = (await props.searchParams).data;
  const richiesta = Array.isArray(parametro) ? parametro[0] : parametro;
  const oggi = oraDiRoma().data;
  const data = richiesta && dataValida(richiesta) ? richiesta : oggi;
  // La settimana comincia di lunedì (giornoDellaData: 0 = domenica).
  const lunedi = sommaGiorni(data, -((giornoDellaData(data) + 6) % 7));
  const domenica = sommaGiorni(lunedi, 6);

  const [voci, disdette, chiusure] = await Promise.all([
    vociDellIntervallo(lunedi, domenica),
    disdetteDellIntervallo(lunedi, domenica),
    elencoChiusure(),
  ]);

  return (
    <main className="min-h-svh bg-paper pb-[env(safe-area-inset-bottom)] text-ink">
      <div className="shell max-w-3xl py-6 md:py-10 lg:max-w-6xl">
        <NavAdmin attiva="settimana" data={data === oggi ? undefined : data} />
        <Settimana
          lunedi={lunedi}
          oggi={oggi}
          voci={voci}
          disdette={disdette}
          chiusure={chiusure.filter((c) => c.attiva && c.al >= lunedi && c.dal <= domenica)}
        />
      </div>
    </main>
  );
}

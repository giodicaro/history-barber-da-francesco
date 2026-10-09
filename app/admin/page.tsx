import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { auth, signOut } from "@/auth";
import { Agenda } from "@/components/agenda/Agenda";
import { Notifiche } from "@/components/agenda/Notifiche";
import { NavAdmin } from "@/components/lookbook/NavAdmin";
import { oraDiRoma } from "@/lib/orari";
import { eliminaScadute, tipoArchivio, vociDelGiorno } from "@/lib/prenotazioni/archivio";
import { chiavePubblica } from "@/lib/prenotazioni/notifiche";

/* Agenda del salone, pensata per il telefono di Francesco e per un tablet
   appoggiato alla cassa.

   Questa è la parte server: controlla la sessione, legge dal database le voci
   del giorno chiesto (?data=YYYY-MM-DD, altrimenti oggi) e le passa al
   componente client, che disegna navigazione, numeri e timeline e scrive
   tramite le Server Action di ./azioni.ts.

   Accesso: sessione di Auth.js (auth.ts). Senza sessione si finisce alla
   pagina di accesso, e il controllo è qui dentro oltre che nel middleware. */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Agenda — History Barber",
  // Mai nei motori di ricerca: qui ci sono nomi e numeri di telefono.
  robots: { index: false, follow: false, nocache: true },
};

export default async function PaginaAgenda(props: PageProps<"/admin">) {
  const sessione = await auth();
  if (!sessione?.user) redirect("/admin/login");

  const parametro = (await props.searchParams).data;
  const richiesta = Array.isArray(parametro) ? parametro[0] : parametro;
  const adesso = oraDiRoma();
  const data =
    richiesta && /^\d{4}-\d{2}-\d{2}$/.test(richiesta) && !Number.isNaN(Date.parse(`${richiesta}T12:00:00Z`))
      ? richiesta
      : adesso.data;

  const voci = await vociDelGiorno(data);

  // Pulizia dei dati oltre il periodo di conservazione dell'informativa
  // privacy, dopo aver mostrato la pagina.
  after(() => eliminaScadute(adesso.data));

  return (
    <main className="min-h-svh bg-paper pb-[env(safe-area-inset-bottom)] text-ink">
      <div className="shell max-w-3xl py-6 md:py-10">
        <NavAdmin attiva="agenda" />
        <Agenda data={data} oggi={adesso.data} adesso={adesso.minuti} voci={voci} archivio={tipoArchivio} />
        <Notifiche chiave={chiavePubblica()} />

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/admin/login" });
          }}
          className="mt-10 border-t border-ink/15 pt-6"
        >
          <button type="submit" className="eyebrow min-h-11 cursor-pointer text-steel hover:text-ink">
            Esci dall&apos;agenda
          </button>
        </form>
      </div>
    </main>
  );
}

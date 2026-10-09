import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { StileCliente } from "@/components/lookbook/StileCliente";
import { LookbookNonPronto, stileDelToken } from "@/lib/lookbook/archivio";
import { battesimo } from "@/lib/lookbook/formato";

/* "Il mio stile": la pagina del cliente, aperta dal suo link personale
   (/stile/<token>, consegnato con il QR in salone).

   Pubblica ma privata: chi non ha il token vede un 404 neutro, che non dice
   se un link "era" valido. Mai nei motori di ricerca, mai il link nel
   Referer delle pagine aperte da qui. Le foto arrivano da una rotta a parte
   (./foto/[id]) e qui passano solo i loro indirizzi: niente immagini dentro
   l'HTML. */

export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/stile/[token]">): Promise<Metadata> {
  const { token } = await props.params;
  return {
    title: "Il mio stile — History Barber da Francesco",
    description: "I tuoi tagli da History Barber da Francesco.",
    robots: { index: false, follow: false, nocache: true },
    referrer: "no-referrer",
    manifest: `/stile/${token}/manifesto`,
    appleWebApp: { capable: true, title: "Il mio stile", statusBarStyle: "black" },
    icons: { apple: "/agenda/apple-touch-icon.png" },
  };
}

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

export default async function PaginaStile(props: PageProps<"/stile/[token]">) {
  const { token } = await props.params;
  let stile;
  try {
    stile = await stileDelToken(token);
  } catch (e) {
    if (e instanceof LookbookNonPronto) notFound();
    throw e;
  }
  if (!stile) notFound();

  const base = `/stile/${token}`;
  return (
    <StileCliente
      token={token}
      nome={battesimo(stile.nome)}
      looks={stile.looks.map((l) => ({
        ...l,
        foto: l.foto.map((f) => ({
          ...f,
          mini: `${base}/foto/${f.id}?v=mini`,
          intera: `${base}/foto/${f.id}?v=full`,
        })),
      }))}
    />
  );
}

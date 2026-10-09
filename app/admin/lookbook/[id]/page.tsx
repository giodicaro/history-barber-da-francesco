import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { auth } from "@/auth";
import { NavAdmin } from "@/components/lookbook/NavAdmin";
import { SchedaCliente } from "@/components/lookbook/SchedaCliente";
import { LookbookNonPronto, looksDelCliente, scheda } from "@/lib/lookbook/archivio";

/* Scheda di un cliente nel lookbook (lato barbiere).

   Qui si prepara anche il QR del suo link personale: SVG generato sul
   server con `qrcode`, così nel browser non arriva nessuna libreria. Il link
   usa l'indirizzo da cui Francesco sta guardando l'agenda: online il dominio
   del sito, in prova l'indirizzo del computer. */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Scheda cliente — Lookbook",
  robots: { index: false, follow: false, nocache: true },
};

async function origine() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3200";
  const protocollo = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocollo.split(",")[0]}://${host}`;
}

export default async function PaginaScheda(props: PageProps<"/admin/lookbook/[id]">) {
  const sessione = await auth();
  if (!sessione?.user) redirect("/admin/login");

  const { id } = await props.params;
  let cliente;
  try {
    cliente = await scheda(id);
  } catch (e) {
    if (e instanceof LookbookNonPronto) redirect("/admin/lookbook");
    throw e;
  }
  if (!cliente) notFound();

  const looks = await looksDelCliente(cliente.id);
  const link = `${await origine()}/stile/${cliente.token}`;
  const qr = await QRCode.toString(link, {
    type: "svg",
    margin: 4,
    errorCorrectionLevel: "M",
    color: { dark: "#0a0a0a", light: "#ffffff" },
  });

  return (
    <main className="min-h-svh bg-paper pb-[env(safe-area-inset-bottom)] text-ink">
      <div className="shell max-w-3xl py-6 md:py-10">
        <NavAdmin attiva="lookbook" />
        <SchedaCliente
          cliente={{ id: cliente.id, nome: cliente.nome, telefono: cliente.telefono, consensoIl: cliente.consensoIl }}
          looks={looks}
          link={link}
          qr={qr}
        />
      </div>
    </main>
  );
}

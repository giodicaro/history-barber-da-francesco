import Link from "next/link";
import { cn } from "@/lib/utils";

/* In cima a ogni pagina dell'agenda: Giorno · Settimana · Chiusure. Tre
   link veri (funzionano anche prima di React), grandi abbastanza per il
   pollice. */

const VOCI = [
  { chiave: "giorno", href: "/admin", testo: "Giorno" },
  { chiave: "settimana", href: "/admin/settimana", testo: "Settimana" },
  { chiave: "chiusure", href: "/admin/chiusure", testo: "Chiusure" },
] as const;

export function NavAdmin({ attiva, data }: { attiva: (typeof VOCI)[number]["chiave"]; data?: string }) {
  return (
    <nav aria-label="Sezioni dell'agenda" className="mb-5 grid grid-cols-3 border border-ink">
      {VOCI.map((v, i) => (
        <Link
          key={v.chiave}
          // Giorno e settimana restano sulla data che si sta guardando.
          href={data && v.chiave !== "chiusure" ? `${v.href}?data=${data}` : v.href}
          prefetch={false}
          aria-current={attiva === v.chiave ? "page" : undefined}
          className={cn(
            "eyebrow flex min-h-11 items-center justify-center px-2 transition-colors duration-150",
            i > 0 && "border-l border-ink",
            attiva === v.chiave ? "bg-ink text-paper" : "hover:bg-fog",
          )}
        >
          {v.testo}
        </Link>
      ))}
    </nav>
  );
}

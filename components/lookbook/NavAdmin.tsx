import Link from "next/link";
import { cn } from "@/lib/utils";

/* Le due sezioni dell'area del salone, in cima ad agenda e lookbook.
   Link veri: funzionano anche prima che React sia carico. */

const VOCI = [
  { id: "agenda", href: "/admin", etichetta: "Agenda" },
  { id: "lookbook", href: "/admin/lookbook", etichetta: "Lookbook" },
] as const;

export function NavAdmin({ attiva }: { attiva: (typeof VOCI)[number]["id"] }) {
  return (
    <nav aria-label="Sezioni del salone" className="mb-6 flex border-b border-ink/15">
      {VOCI.map((v) => (
        <Link
          key={v.id}
          href={v.href}
          aria-current={attiva === v.id ? "page" : undefined}
          className={cn(
            "eyebrow -mb-px inline-flex min-h-11 items-center border-b-2 px-1 transition-colors duration-150 first:mr-6",
            attiva === v.id ? "border-ink text-ink" : "border-transparent text-steel hover:text-ink",
          )}
        >
          {v.etichetta}
        </Link>
      ))}
    </nav>
  );
}

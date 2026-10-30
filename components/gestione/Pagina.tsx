import Link from "next/link";
import type { ReactNode } from "react";
import { salone } from "@/lib/salone";

/* Cornice delle pagine "Gestisci il tuo appuntamento": bianca come
   l'informativa privacy, con il ritorno al sito. Server Component.

   I link verso la home hanno prefetch={false}: il prefetch scaricherebbe
   in anticipo GSAP, Lenis e framer-motion della home, che queste pagine
   leggere non devono caricare. Si scaricano solo se il cliente ci va. */
export function PaginaGestione({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-svh bg-paper text-ink">
      <div className="shell max-w-2xl py-8 md:py-16">
        <Link href="/" prefetch={false} className="eyebrow inline-flex min-h-11 items-center text-steel hover:text-ink">
          ← {salone.nomeCompleto}
        </Link>
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}

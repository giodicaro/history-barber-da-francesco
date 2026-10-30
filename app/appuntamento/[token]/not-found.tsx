import Link from "next/link";
import { PaginaGestione } from "@/components/gestione/Pagina";
import { salone } from "@/lib/salone";

/* Link sbagliato o appuntamento che non c'è più (già disdetto, o passato
   oltre il periodo di conservazione): stessa pagina per tutti. */
export default function AppuntamentoNonTrovato() {
  return (
    <PaginaGestione>
      <p className="eyebrow text-steel">Gestisci il tuo appuntamento</p>
      <h1 className="display mt-3 text-[clamp(min(2rem,calc(100cqi/9.8)),9.6cqi,4rem)]">Questo appuntamento non c&apos;è più</h1>
      <p className="mt-5 max-w-[46ch] text-base">
        Forse è già stato disdetto, o il link non è completo. Per qualsiasi dubbio chiama il salone al{" "}
        <a href={salone.telefonoHref} className="font-semibold underline underline-offset-4">
          {salone.telefono}
        </a>
        .
      </p>
      <Link
        href="/?prenota=gestione"
        prefetch={false}
        className="eyebrow mt-6 inline-flex min-h-14 w-full items-center justify-center border border-ink bg-ink px-6 text-paper transition-colors duration-200 hover:bg-paper hover:text-ink sm:w-auto"
      >
        Prenota un nuovo orario
      </Link>
    </PaginaGestione>
  );
}

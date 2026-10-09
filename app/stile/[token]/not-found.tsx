import Link from "next/link";
import { Logo } from "@/components/Logo";
import { salone } from "@/lib/salone";

/* Link sbagliato, scheda cancellata o link rigenerato: stessa pagina per
   tutti, così non si capisce se un link "era" valido. */

export default function StileNonTrovato() {
  return (
    <main className="flex min-h-svh flex-col bg-ink text-paper">
      <div className="shell flex max-w-3xl flex-1 flex-col justify-center py-16">
        <Logo className="h-10 self-start" />
        <h1 className="display mt-10 text-[clamp(2.5rem,12cqi,5rem)]">Link non valido</h1>
        <p className="mt-5 max-w-[42ch] text-base text-smoke">
          Questo link non porta a nessuna scheda. Se ti serve il tuo, chiedilo in salone: te lo diamo nuovo.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a
            href={salone.telefonoHref}
            className="eyebrow inline-flex min-h-12 items-center justify-center border border-paper bg-paper px-5 text-ink"
          >
            Chiama il salone
          </a>
          <Link href="/" className="eyebrow inline-flex min-h-12 items-center justify-center border border-paper/40 px-5 hover:border-paper">
            Vai al sito
          </Link>
        </div>
      </div>
    </main>
  );
}

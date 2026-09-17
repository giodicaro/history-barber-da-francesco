import { salone } from "@/lib/salone";
import { BookButton } from "./BookButton";
import { GridLines } from "./GridLines";
import { Logo } from "./Logo";
import { ArrowUpRight, InstagramGlyph } from "./icons";
import { OpenStatus, OrariTable } from "./OpenStatus";
import { SectionLink } from "./SectionLink";

export function Footer() {
  const anno = new Date().getFullYear();

  return (
    <footer
      id="contatti"
      tabIndex={-1}
      aria-labelledby="titolo-contatti"
      data-nav-scuro
      className="relative scroll-mt-(--nav-h) overflow-hidden bg-ink pt-24 text-paper outline-none md:pt-40"
    >
      <GridLines />
      <div className="shell relative">
        <p data-reveal className="eyebrow pl-3">
          (04) — Contatti
        </p>
        {/* "VIA CA' ROSSA" è la riga più larga (7,65 em in Syne Bold): su
            tutta la larghezza della shell, meno il rientro. */}
        <h2
          id="titolo-contatti"
          className="display mt-6 pl-3 text-[clamp(2rem,calc((100cqi-0.75rem)/7.85),12rem)]"
        >
          <span data-mask-line="scroll" className="-mt-[0.12em] block overflow-hidden pt-[0.12em]">
            <span>Via Ca&apos; Rossa</span>
          </span>
          <span data-mask-line="scroll" className="-mt-[0.12em] block overflow-hidden pt-[0.12em]">
            <span className="text-smoke">47/A-B</span>
          </span>
        </h2>

        {/* Blocchi informativi in monospazio, allineati alle colonne. */}
        <div className="mt-16 grid grid-cols-1 gap-y-12 border-t grid-line pt-8 md:mt-24 md:grid-cols-4">
          <div data-reveal className="pl-3 pr-6">
            <h3 className="eyebrow text-smoke">Dove</h3>
            <address className="info mt-5 not-italic">
              {salone.via}
              <br />
              {salone.cap} {salone.citta} ({salone.provincia})
              <br />
              <span className="text-smoke">Italia</span>
            </address>
            <a
              href={salone.mappeHref}
              target="_blank"
              rel="noopener noreferrer"
              className="info mt-5 inline-flex min-h-11 items-center gap-2 underline-offset-4 hover:underline"
            >
              Indicazioni stradali
              <ArrowUpRight className="size-3" />
            </a>
          </div>

          <div data-reveal className="pl-3 pr-3 md:col-span-2 md:pr-10">
            <div className="flex items-start justify-between gap-4">
              <h3 className="eyebrow text-smoke">Orari</h3>
              <OpenStatus className="text-right" />
            </div>
            <div className="mt-4">
              <OrariTable />
            </div>
          </div>

          <div data-reveal className="flex flex-col items-start pl-3 pr-3">
            <h3 className="eyebrow text-smoke">Appuntamenti</h3>
            {/* Come nella hero: numero e nota in monospazio, stessa misura. */}
            <p className="info mt-5">
              <a
                href={salone.telefonoHref}
                className="-my-3 inline-block py-3 underline-offset-4 hover:underline"
              >
                Tel. {salone.telefono}
              </a>
              <br />
              <span className="text-smoke">Si riceve solo su appuntamento</span>
            </p>
            <a
              href={salone.instagramHref}
              target="_blank"
              rel="noopener noreferrer"
              className="info mt-5 inline-flex min-h-11 items-center gap-2 underline-offset-4 hover:underline"
            >
              <InstagramGlyph className="size-5" />
              <span>@{salone.instagram}</span>
            </a>
            <BookButton origine="footer" size="lg" suScuro className="mt-8 w-full">
              Prenota ora
            </BookButton>
          </div>
        </div>

        <div className="info mt-20 flex flex-col gap-3 border-t grid-line py-6 pl-3 text-smoke md:mt-28 md:flex-row md:items-center md:justify-between md:pr-3">
          <Logo className="h-12 self-start text-paper md:self-center" />
          <p>
            © {anno} {salone.nomeCompleto}
            {salone.partitaIva && ` · P.IVA ${salone.partitaIva}`}
          </p>
          <p>Rivenditore autorizzato Depot</p>
          <SectionLink id="top" className="inline-flex min-h-11 items-center hover:text-paper">
            Torna su ↑
          </SectionLink>
        </div>
      </div>

      {/* Firma a tutta larghezza, tagliata di proposito dal bordo inferiore.
          "HISTORY BARBER" in Syne Bold è largo 9,58 em. La dimensione sta
          sullo span e non sul <p>: 100cqi si misura sul contenitore
          antenato, e qui il contenitore è il <p> stesso. */}
      <p aria-hidden className="shell relative -mb-[0.2em] select-none text-center text-paper/10">
        <span className="display block whitespace-nowrap text-[clamp(1.25rem,calc(100cqi/9.8),9.7rem)]">
          {salone.nome}
        </span>
      </p>
    </footer>
  );
}

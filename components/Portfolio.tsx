import { Fragment } from "react";
import { portfolio } from "@/lib/salone";
import { GridLines } from "./GridLines";
import { Photo } from "./Photo";
import { SectionHead } from "./SectionHead";

export function Portfolio() {
  return (
    <section
      aria-labelledby="titolo-portfolio"
      id="portfolio"
      tabIndex={-1}
      className="relative scroll-mt-(--nav-h) border-t grid-line bg-paper py-24 text-ink outline-none md:py-40"
    >
      <GridLines />
      <div className="shell relative">
        <SectionHead
          id="titolo-portfolio"
          numero="02"
          etichetta="Portfolio"
          righe={["Ciò che", "facciamo", "meglio"]}
        />

        {/* Quadrati a filo, senza margini: la griglia la disegnano le foto. */}
        <ul className="mt-16 grid grid-cols-2 md:mt-24 md:grid-cols-4">
          {portfolio.map((lavoro, i) => (
            <li key={lavoro.titolo} data-reveal>
              <figure className="group relative aspect-square overflow-hidden bg-fog text-ink">
                <Photo
                  src={lavoro.src}
                  alt={lavoro.alt}
                  etichetta="Foto da inserire"
                  sizes="(min-width: 100rem) 25rem, (min-width: 48rem) 25vw, 50vw"
                  className="transition-transform duration-700 ease-crisp group-hover:scale-105"
                />
                {/* Didascalia sulla foto. Con il mouse sale al passaggio; su
                    touch, dove l'hover non esiste, resta sempre visibile. */}
                <figcaption className="absolute inset-x-0 bottom-0 flex items-end gap-3 bg-linear-to-t from-ink/80 via-ink/40 to-transparent p-3 pt-10 text-paper transition-transform duration-500 ease-crisp md:p-4 md:pt-14 [@media(hover:hover)]:translate-y-full [@media(hover:hover)]:group-hover:translate-y-0">
                  <span className="info text-paper/60">{String(i + 1).padStart(2, "0")}</span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="text-sm font-bold leading-tight tracking-[-0.01em] md:text-lg">
                      {lavoro.titolo}
                    </span>
                    {/* Ogni parte della tecnica resta intera: se la riga non
                        basta si va a capo dopo il punto, non dentro
                        "linea singola" o "riga laterale". */}
                    <span className="info text-paper/70">
                      {lavoro.tecnica.split(" · ").map((parte, j, parti) => (
                        <Fragment key={parte}>
                          <span className="whitespace-nowrap">
                            {parte}
                            {j < parti.length - 1 && " ·"}
                          </span>
                          {j < parti.length - 1 && " "}
                        </Fragment>
                      ))}
                    </span>
                  </span>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

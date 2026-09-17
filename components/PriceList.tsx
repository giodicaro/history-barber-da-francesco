import { listino } from "@/lib/salone";
import { formatoPrezzo } from "@/lib/utils";
import { BookButton } from "./BookButton";
import { GridLines } from "./GridLines";
import { SectionHead } from "./SectionHead";

/* Il listino. Categorie e singole righe sono marcate [data-slide-item]: entrano
   a cascata mentre si scorre (RevealOnScroll). A muoversi sono i contenitori
   [data-slide] dentro le celle, non le <tr>: le trasformazioni sulle righe di
   tabella non sono affidabili in tutti i browser. */
export function PriceList() {
  return (
    <section
      aria-labelledby="titolo-listino"
      id="listino"
      tabIndex={-1}
      className="relative scroll-mt-(--nav-h) bg-fog py-24 text-ink outline-none md:py-40"
    >
      <GridLines />
      <div className="shell relative">
        <SectionHead id="titolo-listino" numero="03" etichetta="Listino" righe={["Listino"]} />

        <div className="mt-16 border-t border-ink md:mt-24">
          {listino.map((gruppo) => (
            <div key={gruppo.id} className="grid grid-cols-1 border-b border-ink md:grid-cols-4">
              <h3 data-slide-item className="overflow-hidden pb-2 pl-3 pt-6 md:pb-10">
                <span
                  data-slide
                  className="block text-[clamp(2.25rem,4.4vw,4.25rem)] font-extrabold uppercase leading-none tracking-[-0.04em]"
                >
                  {gruppo.titolo}
                </span>
              </h3>

              <table className="w-full md:col-span-3">
                <caption className="sr-only">{gruppo.titolo}: servizi e prezzi</caption>
                <thead className="sr-only">
                  <tr>
                    <th scope="col">Servizio</th>
                    <th scope="col">Prezzo</th>
                  </tr>
                </thead>
                <tbody>
                  {gruppo.servizi.map((s) => (
                    <tr
                      key={s.nome}
                      data-slide-item
                      className="border-t grid-line transition-colors duration-300 first:border-t-0 hover:bg-ink hover:text-paper [&:hover_.dettaglio]:text-smoke"
                    >
                      <th scope="row" className="py-4 pl-3 pr-4 text-left align-top font-normal md:py-6">
                        <div data-slide>
                          <span className="block text-lg font-semibold leading-tight tracking-[-0.015em] md:text-2xl">
                            {s.nome}
                          </span>
                          <span className="dettaglio mt-1 block text-sm leading-snug text-steel transition-colors duration-300 md:text-[0.9375rem]">
                            {s.dettaglio}
                          </span>
                        </div>
                      </th>
                      <td className="whitespace-nowrap py-4 pr-3 text-right align-top md:py-6">
                        <div data-slide className="text-lg font-semibold tabular-nums tracking-[-0.01em] md:text-2xl">
                          {s.prefisso === "+" && "+ "}
                          {s.prefisso === "da" && <span className="text-sm font-normal">da </span>}
                          {formatoPrezzo(s.prezzo)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        <div className="mt-10 grid grid-cols-1 items-start gap-6 md:mt-14 md:grid-cols-4 md:gap-0">
          <p data-reveal className="pl-3 pr-3 text-sm leading-relaxed text-steel md:col-span-2 md:col-start-2">
            Il prezzo può cambiare con la lunghezza e il tipo di capello: se hai un dubbio, chiedi al
            momento della prenotazione.
          </p>
          <div data-reveal className="pl-3 md:justify-self-end md:pl-0">
            <BookButton origine="listino" size="lg">
              Prenota
            </BookButton>
          </div>
        </div>
      </div>
    </section>
  );
}

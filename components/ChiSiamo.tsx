import { salone } from "@/lib/salone";
import { GridLines } from "./GridLines";
import { SectionHead } from "./SectionHead";

// Solo fatti verificabili (bio Instagram, foto pubblicate). Il testo lungo
// è da rileggere con Francesco prima della pubblicazione.
const puntiFermi = [
  {
    sigla: "A",
    titolo: "Solo su appuntamento",
    testo: "Chiami, fissi l'orario, arrivi. Il tempo in poltrona è tuo e di nessun altro.",
  },
  {
    sigla: "B",
    titolo: "Per tutte le età",
    testo: "Dal primo taglio dei più piccoli alla barba dei grandi, con la stessa cura.",
  },
  {
    sigla: "C",
    titolo: "Prodotti Depot",
    testo: "Rivenditore autorizzato Depot: quello che usiamo in poltrona lo trovi anche da portare a casa.",
  },
];

export function ChiSiamo() {
  return (
    <section
      aria-labelledby="titolo-chi-siamo"
      id="chi-siamo"
      tabIndex={-1}
      className="relative scroll-mt-(--nav-h) bg-paper py-24 text-ink outline-none md:py-40"
    >
      <GridLines />
      <div className="shell relative">
        <SectionHead id="titolo-chi-siamo" numero="01" etichetta="Chi siamo" righe={["Chi", "siamo"]} />

        <div className="mt-14 grid grid-cols-1 md:mt-24 md:grid-cols-4">
          <p
            data-reveal
            className="pl-3 pr-3 text-[clamp(1.5rem,3.2vw,3.25rem)] font-semibold leading-[1.1] tracking-[-0.03em] md:col-span-3 md:col-start-2"
          >
            Una barberia di quartiere a {salone.citta}, dove ogni taglio parte dalla testa che hai
            davanti: sfumature al millimetro, barba a rasoio e il tempo che serve per farle bene.
          </p>
        </div>

        <ul className="mt-16 grid grid-cols-1 md:mt-28 md:grid-cols-4">
          {puntiFermi.map((p, i) => (
            <li
              key={p.sigla}
              data-reveal
              className={
                i === 0
                  ? "border-t border-ink py-6 pl-3 pr-6 md:col-start-2"
                  : "border-t border-ink py-6 pl-3 pr-6"
              }
            >
              <p className="info text-steel">{p.sigla} /</p>
              <h3 className="mt-6 text-xl font-extrabold tracking-[-0.02em] md:mt-10 md:text-2xl">
                {p.titolo}
              </h3>
              <p className="mt-3 max-w-[34ch] text-base leading-relaxed text-steel">{p.testo}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

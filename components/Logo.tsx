import { useId } from "react";
import { cn } from "@/lib/utils";

/* Logo "HB da Francesco": monogramma in stile western (graziato a lastra,
   con ombra 3D staccata) e firma in un serif classico, sottolineata.

   Ridisegnato a mano dall'unico riferimento disponibile, uno screenshot di
   209×33px: le proporzioni sono fedeli, i tracciati no. Quando arriverà il
   file originale del logo va sostituito questo.

   Tutto è in currentColor: il logo prende il colore del testo intorno, così
   la barra lo passa da bianco a nero senza filtri né invert.

   Una sola illustrazione per le due versioni. La compatta è la stessa SVG
   vista attraverso un contenitore largo quanto il solo monogramma (la firma
   sta tutta a destra, fuori dalla finestra): niente doppioni nel DOM e niente
   maschere dentro un elemento nascosto, che alcuni browser non disegnano. */

// Coordinate: lettere alte 100 unità, H larga 84, B larga 86.
const H =
  "M0 0H40V12H38Q32 12 32 18V43H52V18Q52 12 46 12H44V0H84V12H78Q72 12 72 18V82Q72 88 78 88H84V100H44V88H46Q52 88 52 82V57H32V82Q32 88 38 88H40V100H0V88H6Q12 88 12 82V18Q12 12 6 12H0Z";
const B =
  "M0 0H46C70 0 80 10 80 25C80 35 74 43 64 46C78 49 86 59 86 72C86 89 74 100 50 100H0V88H6Q12 88 12 82V18Q12 12 6 12H0Z" +
  "M32 12V41H44C55 41 59 35 59 26.5C59 18 55 12 44 12Z" +
  "M32 54V88H48C59 88 64 81 64 71C64 61 59 54 48 54Z";

// La B si sovrappone alle grazie destre della H: il distacco le separa.
const B_X = 74;
// Ombra verso il basso a sinistra, come nell'originale.
const OMBRA_X = -7;
const OMBRA_Y = 7;
// Spazio vuoto fra lettera e ombra (e fra B e H), per lato.
const STACCO = 3;

// Riquadro intero: da x -8 (ombra) a 319 (fine della firma).
const VISTA = { x: -8, y: -2, w: 327, h: 112 };

type Props = {
  // "adattivo": monogramma sotto sm, logo completo da sm in su.
  variante?: "completo" | "adattivo";
  // Altezza, larghezza e colore arrivano dal contenitore.
  className?: string;
};

export function Logo({ variante = "completo", className }: Props) {
  // useId contiene trattini bassi e basta, ma gli id finiscono dentro url():
  // meglio non fidarsi del formato.
  const id = useId().replace(/[^\w-]/g, "");
  const ombra = `logo-ombra-${id}`;
  const sottoB = `logo-sotto-b-${id}`;
  const h = `logo-h-${id}`;
  const b = `logo-b-${id}`;
  const area = { x: VISTA.x, y: VISTA.y, width: VISTA.w, height: VISTA.h };

  return (
    <span
      aria-hidden
      className={cn(
        "block overflow-hidden",
        variante === "adattivo" ? "aspect-[170/112] sm:aspect-[327/112]" : "aspect-[327/112]",
        className,
      )}
    >
      <svg
        viewBox={`${VISTA.x} ${VISTA.y} ${VISTA.w} ${VISTA.h}`}
        focusable="false"
        // max-w-none: il preflight di Tailwind limita le svg alla larghezza
        // del contenitore, e la versione compatta verrebbe schiacciata.
        // Il testo della firma non deve ereditare lo stile del contenitore
        // (nel footer sta dentro una riga "info", maiuscola e spaziata).
        className="block aspect-[327/112] h-full max-w-none font-normal normal-case not-italic tracking-normal"
      >
        <defs>
          <path id={h} d={H} />
          <path id={b} d={B} fillRule="evenodd" transform={`translate(${B_X} 0)`} />
          {/* L'ombra sparisce sotto le lettere, allargate del distacco. */}
          <mask id={ombra} maskUnits="userSpaceOnUse" {...area}>
            <rect {...area} fill="#fff" />
            <g fill="#000" stroke="#000" strokeWidth={STACCO * 2} strokeLinejoin="round">
              <use href={`#${h}`} />
              <use href={`#${b}`} />
            </g>
          </mask>
          {/* La H si interrompe dove passa la B: le due lettere si incastrano. */}
          <mask id={sottoB} maskUnits="userSpaceOnUse" {...area}>
            <rect {...area} fill="#fff" />
            <use href={`#${b}`} fill="#000" stroke="#000" strokeWidth={STACCO * 2} strokeLinejoin="round" />
          </mask>
        </defs>

        <g fill="currentColor">
          <g mask={`url(#${ombra})`}>
            <g transform={`translate(${OMBRA_X} ${OMBRA_Y})`}>
              <use href={`#${h}`} />
              <use href={`#${b}`} />
            </g>
          </g>
          <use href={`#${h}`} mask={`url(#${sottoB})`} />
          <use href={`#${b}`} />

          {/* Firma e linea di registro, a destra del monogramma. textLength
              fissa la larghezza: Georgia la occupa naturalmente, gli altri
              serif si adeguano con la spaziatura. */}
          <text
            x={167}
            y={94}
            fontFamily="Georgia, 'Times New Roman', serif"
            fontSize={26}
            textLength={150}
            lengthAdjust="spacing"
          >
            da Francesco
          </text>
          <rect x={164} y={99.6} width={155} height={2.4} />
        </g>
      </svg>
    </span>
  );
}

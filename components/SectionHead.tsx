import { cn } from "@/lib/utils";

type Props = {
  numero: string;
  etichetta: string;
  // Il titolo va a capo dove decidiamo noi: ogni riga è una maschera a sé.
  righe: string[];
  id: string;
  className?: string;
};

/* Intestazione di sezione: eyebrow nella prima colonna, titolo gigante
   nelle altre tre. Su mobile uno sotto l'altro.

   La dimensione del titolo è calcolata sulla parola più larga fra tutte le
   sezioni ("FACCIAMO", 6,04 em in Syne Bold) perché tutti i titoli abbiano
   la stessa scala: larghezza utile / 6,2.
   - mobile: tutto il contenuto della shell (100cqi) meno il rientro;
   - da md: tre colonne su quattro, meno il rientro. */
export function SectionHead({ numero, etichetta, righe, id, className }: Props) {
  return (
    <div className={cn("grid grid-cols-1 gap-y-6 md:grid-cols-4", className)}>
      <p data-reveal className="eyebrow self-start pl-3 pt-[0.6em]">
        ({numero}) — {etichetta}
      </p>
      <h2
        id={id}
        className="display pl-3 text-[clamp(2.25rem,calc((100cqi-0.75rem)/6.2),12rem)] md:col-span-3 md:text-[clamp(2.25rem,calc((75cqi-0.75rem)/6.2),12rem)]"
      >
        {righe.map((riga) => (
          // Il padding in alto lascia spazio agli accenti (CIÒ) che con
          // un'interlinea sotto 1 finirebbero tagliati dalla maschera.
          <span key={riga} data-mask-line="scroll" className="-mt-[0.12em] block overflow-hidden pt-[0.12em]">
            <span>{riga}</span>
          </span>
        ))}
      </h2>
    </div>
  );
}

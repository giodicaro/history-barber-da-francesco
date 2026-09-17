import { cn } from "@/lib/utils";

/* Le linee verticali della griglia architettonica. Stanno dentro ogni
   sezione e non in un livello fisso sopra la pagina: un livello fisso a tutto
   schermo verrebbe ricomposto a ogni fotogramma di scroll, e su iOS è il tipo
   di superficie che fa crescere la memoria fino alla chiusura della scheda.

   Una colonna sullo smartphone (solo i due bordi), quattro da md in su. I
   contenuti usano la stessa shell, quindi si appoggiano alle linee. */
export function GridLines({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0", className)}>
      <div className="shell grid h-full grid-cols-1 md:grid-cols-4">
        <span data-grid-line className="grid-line block border-x md:border-r-0" />
        <span data-grid-line className="grid-line hidden border-l md:block" />
        <span data-grid-line className="grid-line hidden border-l md:block" />
        <span data-grid-line className="grid-line hidden border-x md:block" />
      </div>
    </div>
  );
}

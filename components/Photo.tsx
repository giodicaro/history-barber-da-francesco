import Image from "next/image";
import { cn } from "@/lib/utils";

type Props = {
  src?: string;
  alt: string;
  sizes: string;
  // Solo per la foto della prima schermata, che è l'elemento LCP.
  preload?: boolean;
  // Testo del segnaposto finché la foto non c'è. Senza, solo il tratteggio.
  etichetta?: string;
  // object-position: quale parte della foto resta visibile quando è ritagliata.
  posizione?: string;
  className?: string;
};

/* Foto a riempimento del contenitore (che deve essere relative e avere un
   rapporto d'aspetto). Senza src disegna un segnaposto dichiarato, a
   tratteggio: meglio un vuoto che si vede come vuoto che un'immagine rotta. */
export function Photo({ src, alt, sizes, preload, etichetta, posizione, className }: Props) {
  if (!src) {
    return (
      <div
        aria-hidden
        className={cn(
          // Etichetta in alto: in basso ci sono le didascalie del portfolio.
          "absolute inset-0 flex items-start justify-between gap-2 p-3",
          "bg-[repeating-linear-gradient(135deg,color-mix(in_srgb,currentColor_10%,transparent)_0_1px,transparent_1px_14px)]",
          className,
        )}
      >
        {etichetta && <span className="info opacity-70">{etichetta}</span>}
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      preload={preload}
      style={posizione ? { objectPosition: posizione } : undefined}
      className={cn("object-cover", className)}
    />
  );
}

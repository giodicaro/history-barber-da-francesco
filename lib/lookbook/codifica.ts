/* Codifica di una foto già ridimensionata in WebP o JPEG, entro un peso.

   Senza DOM: la usano sia il Web Worker (compressione.worker.ts, con un
   OffscreenCanvas) sia il thread principale quando il worker non c'è (con un
   OffscreenCanvas o un <canvas>). */

export type Tela = OffscreenCanvas | HTMLCanvasElement;

export const LATO_FOTO = 1080;
export const LATO_MINI = 360;

/** Obiettivo e tetto di peso per la foto intera; tetto per la miniatura. */
export const OBIETTIVO_FOTO = 250 * 1024;
export const TETTO_FOTO = 350 * 1024;
export const TETTO_MINI = 40 * 1024;

/** Larghezza e altezza entro `lato` sul lato lungo, proporzioni intatte,
    mai più grandi dell'originale. */
export function misura(larghezza: number, altezza: number, lato: number): [number, number] {
  const scala = Math.min(1, lato / Math.max(larghezza, altezza));
  return [Math.max(1, Math.round(larghezza * scala)), Math.max(1, Math.round(altezza * scala))];
}

function inBlob(tela: Tela, tipo: string, qualita: number): Promise<Blob | null> {
  if ("convertToBlob" in tela) return tela.convertToBlob({ type: tipo, quality: qualita }).catch(() => null);
  return new Promise((risolvi) => tela.toBlob(risolvi, tipo, qualita));
}

/* Prima WebP. Alcuni Safari non sanno codificare WebP dal canvas e, invece
   di dirlo, restituiscono un PNG: per questo si guarda `blob.type` e non si
   dà per scontato. Senza WebP si passa a JPEG; un PNG non si salva mai.
   Se il peso supera il tetto si riprova con qualità più basse e si tiene il
   primo risultato che ci sta (o il più leggero, se nessuno ci sta). */
export async function codifica(
  tela: Tela,
  tetto: number,
  qualita: { webp: number; jpeg: number; ripieghi: number[] },
  obiettivo = tetto,
): Promise<Blob> {
  const primo = await inBlob(tela, "image/webp", qualita.webp);
  const tipo = primo?.type === "image/webp" ? "image/webp" : "image/jpeg";
  let migliore = tipo === "image/webp" ? primo : await inBlob(tela, "image/jpeg", qualita.jpeg);
  if (!migliore || migliore.type !== tipo) throw new Error("Codifica non riuscita");
  if (migliore.size <= obiettivo) return migliore;

  for (const q of qualita.ripieghi) {
    const prova = await inBlob(tela, tipo, q);
    if (prova && prova.type === tipo && prova.size < migliore.size) migliore = prova;
    if (migliore.size <= tetto) break;
  }
  return migliore;
}

export const QUALITA_FOTO = { webp: 0.82, jpeg: 0.85, ripieghi: [0.7, 0.6] };
export const QUALITA_MINI = { webp: 0.75, jpeg: 0.75, ripieghi: [0.6, 0.5] };

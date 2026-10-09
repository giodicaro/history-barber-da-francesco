/* Web Worker della compressione: disegna la foto (già decodificata e
   ridotta da createImageBitmap nel thread principale) su un OffscreenCanvas
   e la codifica, foto intera e miniatura. Fuori dal thread principale,
   l'interfaccia non si ferma mentre il telefono lavora.

   Riceve { bitmap, mini: [larghezza, altezza] } con la bitmap trasferita;
   risponde { foto, miniatura } oppure { errore }. */

import { codifica, QUALITA_FOTO, QUALITA_MINI, TETTO_FOTO, TETTO_MINI, OBIETTIVO_FOTO } from "./codifica";

type Richiesta = { bitmap: ImageBitmap; mini: [number, number] };

const ambito = self as unknown as {
  onmessage: ((e: MessageEvent<Richiesta>) => void) | null;
  postMessage: (messaggio: unknown) => void;
};

function disegna(bitmap: ImageBitmap, larghezza: number, altezza: number) {
  const tela = new OffscreenCanvas(larghezza, altezza);
  const ctx = tela.getContext("2d");
  if (!ctx) throw new Error("OffscreenCanvas 2D non disponibile");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, larghezza, altezza);
  return tela;
}

ambito.onmessage = async ({ data: { bitmap, mini } }) => {
  try {
    const foto = await codifica(disegna(bitmap, bitmap.width, bitmap.height), TETTO_FOTO, QUALITA_FOTO, OBIETTIVO_FOTO);
    const miniatura = await codifica(disegna(bitmap, mini[0], mini[1]), TETTO_MINI, QUALITA_MINI);
    ambito.postMessage({ foto, miniatura });
  } catch (e) {
    ambito.postMessage({ errore: e instanceof Error ? e.message : "errore" });
  } finally {
    bitmap.close();
  }
};

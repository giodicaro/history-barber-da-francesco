import { codifica, LATO_FOTO, LATO_MINI, misura, OBIETTIVO_FOTO, QUALITA_FOTO, QUALITA_MINI, TETTO_FOTO, TETTO_MINI, type Tela } from "./codifica";
import type { TipoImmagine } from "./tipi";

/* Dalla foto del telefono (12 MP, 3-5 MB, con EXIF e magari il GPS) a due
   file leggeri: la foto intera (lato lungo ≤ 1080 px, ~250 KB) e la
   miniatura (~360 px, ≤ 40 KB), in WebP o JPEG. Solo nel browser.

   La strada, dalla più robusta alla più semplice:
   1. createImageBitmap con orientamento EXIF e riduzione già in decodifica
      (non tiene 12 MP in memoria), poi disegno e codifica in un Web Worker;
   2. se il worker non c'è o fallisce, stesso disegno nel thread principale
      con un OffscreenCanvas, o con un <canvas> e toBlob (asincrono);
   3. se createImageBitmap non accetta le opzioni (alcuni Safari) o restituisce
      la foto girata male, si decodifica con un <img>: i browser moderni
      applicano da soli l'orientamento EXIF.
   Ripassare dal canvas toglie tutti i metadati: EXIF e GPS non arrivano mai
   al server. */

export class FotoNonUsabile extends Error {
  constructor() {
    super("Questa foto non si può usare. Prova a scattarne un'altra.");
    this.name = "FotoNonUsabile";
  }
}

export interface FotoCompressa {
  foto: Blob;
  miniatura: Blob;
  tipo: TipoImmagine;
}

type Risposta = { foto: Blob; miniatura: Blob } | { errore: string };

let lavoratore: Worker | null | undefined;

function apriLavoratore(): Worker | null {
  if (lavoratore !== undefined) return lavoratore;
  try {
    lavoratore =
      typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined"
        ? new Worker(new URL("./compressione.worker.ts", import.meta.url), { type: "module" })
        : null;
  } catch {
    lavoratore = null;
  }
  return lavoratore;
}

function nelLavoratore(bitmap: ImageBitmap, mini: [number, number]): Promise<{ foto: Blob; miniatura: Blob }> {
  const w = apriLavoratore();
  if (!w) return Promise.reject(new Error("Worker assente"));
  return new Promise((risolvi, rifiuta) => {
    const pulisci = () => {
      clearTimeout(attesa);
      w.removeEventListener("message", alMessaggio);
      w.removeEventListener("error", alGuasto);
    };
    const alMessaggio = (e: MessageEvent<Risposta>) => {
      pulisci();
      if ("errore" in e.data) rifiuta(new Error(e.data.errore));
      else risolvi(e.data);
    };
    const alGuasto = () => {
      pulisci();
      // Un worker che non parte (modulo non caricato, browser vecchio) non si
      // riprova: le foto successive vanno dirette sul thread principale.
      lavoratore = null;
      w.terminate();
      rifiuta(new Error("Worker guasto"));
    };
    const attesa = setTimeout(alGuasto, 20_000);
    w.addEventListener("message", alMessaggio);
    w.addEventListener("error", alGuasto);
    w.postMessage({ bitmap, mini }, [bitmap]);
  });
}

function nuovaTela(larghezza: number, altezza: number): Tela {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(larghezza, altezza);
  const c = document.createElement("canvas");
  c.width = larghezza;
  c.height = altezza;
  return c;
}

function disegna(sorgente: CanvasImageSource, larghezza: number, altezza: number): Tela {
  const tela = nuovaTela(larghezza, altezza);
  const ctx = tela.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) throw new FotoNonUsabile();
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(sorgente, 0, 0, larghezza, altezza);
  return tela;
}

async function nelThreadPrincipale(sorgente: CanvasImageSource, foto: [number, number], mini: [number, number]) {
  return {
    foto: await codifica(disegna(sorgente, ...foto), TETTO_FOTO, QUALITA_FOTO, OBIETTIVO_FOTO),
    miniatura: await codifica(disegna(sorgente, ...mini), TETTO_MINI, QUALITA_MINI),
  };
}

/** Carica l'immagine per leggerne le misure (già orientate secondo l'EXIF). */
function caricata(url: string): Promise<HTMLImageElement> {
  return new Promise((risolvi, rifiuta) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => risolvi(img);
    img.onerror = () => rifiuta(new FotoNonUsabile());
    img.src = url;
  });
}

/** Bitmap ridotta e orientata, o null se il browser non la sa fare bene. */
async function bitmapRidotta(file: Blob, larghezza: number, altezza: number): Promise<ImageBitmap | null> {
  if (typeof createImageBitmap === "undefined") return null;
  try {
    const b = await createImageBitmap(file, {
      imageOrientation: "from-image",
      resizeWidth: larghezza,
      resizeHeight: altezza,
      resizeQuality: "high",
    });
    // Verifica sul risultato: un browser che riduce prima di ruotare
    // restituirebbe una foto verticale come orizzontale (e deformata).
    const attesa = larghezza === altezza || larghezza > altezza === b.width > b.height;
    if (attesa && b.width === larghezza && b.height === altezza) return b;
    b.close();
    return null;
  } catch {
    return null;
  }
}

// Una foto alla volta: il worker risponde in ordine a un messaggio per
// volta, e su un iPhone tre decodifiche insieme sono memoria sprecata.
let coda: Promise<unknown> = Promise.resolve();

export function comprimi(file: Blob): Promise<FotoCompressa> {
  const lavoro = coda.then(() => comprimiOra(file));
  coda = lavoro.catch(() => {});
  return lavoro;
}

async function comprimiOra(file: Blob): Promise<FotoCompressa> {
  const url = URL.createObjectURL(file);
  try {
    const img = await caricata(url);
    if (!img.naturalWidth || !img.naturalHeight) throw new FotoNonUsabile();
    const foto = misura(img.naturalWidth, img.naturalHeight, LATO_FOTO);
    const mini = misura(img.naturalWidth, img.naturalHeight, LATO_MINI);

    let risultato: { foto: Blob; miniatura: Blob } | null = null;
    const bitmap = await bitmapRidotta(file, ...foto);
    if (bitmap) {
      try {
        risultato = await nelLavoratore(bitmap, mini);
      } catch {
        // La bitmap è stata trasferita (e chiusa): se ne fa un'altra.
        const seconda = await bitmapRidotta(file, ...foto);
        if (seconda) {
          try {
            risultato = await nelThreadPrincipale(seconda, foto, mini);
          } finally {
            seconda.close();
          }
        }
      }
    }
    if (!risultato) {
      await img.decode().catch(() => {
        throw new FotoNonUsabile();
      });
      risultato = await nelThreadPrincipale(img, foto, mini);
    }
    const tipo = risultato.foto.type as TipoImmagine;
    if ((tipo !== "image/webp" && tipo !== "image/jpeg") || risultato.miniatura.type !== tipo) throw new FotoNonUsabile();
    return { ...risultato, tipo };
  } catch (e) {
    throw e instanceof FotoNonUsabile ? e : new FotoNonUsabile();
  } finally {
    URL.revokeObjectURL(url);
  }
}

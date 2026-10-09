import "server-only";
import type { Immagine } from "./archivio";

/* Risposte comuni delle rotte che servono le foto del lookbook. */

/** Le intestazioni di sicurezza delle foto: niente indicizzazione, niente
    "indovina il tipo" del browser, niente link di provenienza. */
const SICUREZZA = {
  "X-Content-Type-Options": "nosniff",
  "Content-Disposition": "inline",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
};

export function rispostaFoto(img: Immagine, cache: string): Response {
  return new Response(new Uint8Array(img.byte), {
    headers: {
      ...SICUREZZA,
      "Content-Type": img.tipo,
      "Content-Length": String(img.byte.byteLength),
      "Cache-Control": cache,
    },
  });
}

export const nonTrovata = () =>
  new Response("Non trovata", {
    status: 404,
    headers: { ...SICUREZZA, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });

/** ?v=mini per la miniatura, altrimenti la foto intera. */
export const versioneDa = (url: string) => (new URL(url).searchParams.get("v") === "mini" ? "mini" : "full");

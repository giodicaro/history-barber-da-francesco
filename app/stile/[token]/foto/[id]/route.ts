import { fotoPerCliente, LookbookNonPronto } from "@/lib/lookbook/archivio";
import { nonTrovata, rispostaFoto, versioneDa } from "@/lib/lookbook/risposte";

/* GET /stile/<token>/foto/<id>?v=mini|full — una foto, per il cliente.

   Autorizzata solo dal token, e solo se la foto è di un look di quel cliente:
   il controllo è nella join SQL (fotoPerCliente). Scambiare l'id con quello
   di una foto di un altro cliente dà 404, come un token sbagliato.

   Cache breve sul dispositivo: la copia offline vera la tiene il service
   worker (sw-stile.js), che la cancella quando la scheda non esiste più. */

export async function GET(richiesta: Request, ctx: RouteContext<"/stile/[token]/foto/[id]">) {
  const { token, id } = await ctx.params;
  try {
    const img = await fotoPerCliente(token, id, versioneDa(richiesta.url));
    return img ? rispostaFoto(img, "private, max-age=3600") : nonTrovata();
  } catch (e) {
    if (e instanceof LookbookNonPronto) return nonTrovata();
    throw e;
  }
}

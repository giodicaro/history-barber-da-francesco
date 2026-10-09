import { auth } from "@/auth";
import { fotoPerBarbiere, LookbookNonPronto } from "@/lib/lookbook/archivio";
import { nonTrovata, rispostaFoto, versioneDa } from "@/lib/lookbook/risposte";

/* GET /api/lookbook/foto/<id>?v=mini|full — una foto, per il barbiere.

   Fuori dal middleware (che copre solo /admin): la sessione si controlla qui.
   Una foto non cambia mai (si cancella, non si modifica), quindi il browser
   la può tenere: "private" la lascia sul dispositivo e fuori dalle cache
   condivise. */

export async function GET(richiesta: Request, ctx: RouteContext<"/api/lookbook/foto/[id]">) {
  const sessione = await auth();
  if (!sessione?.user) {
    return new Response("Sessione scaduta", { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const { id } = await ctx.params;
  try {
    const img = await fotoPerBarbiere(id, versioneDa(richiesta.url));
    return img ? rispostaFoto(img, "private, max-age=31536000, immutable") : nonTrovata();
  } catch (e) {
    if (e instanceof LookbookNonPronto) return nonTrovata();
    throw e;
  }
}

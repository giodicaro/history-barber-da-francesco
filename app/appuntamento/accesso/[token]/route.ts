import { randomUUID } from "node:crypto";
import { consumaAccessoMonouso } from "@/lib/prenotazioni/archivio";
import { sha256 } from "@/lib/prenotazioni/gestione";
import { cookieCliente, riconoscimentoAttivo } from "@/lib/prenotazioni/riconoscimento";

/* GET /appuntamento/accesso/<token> — l'accesso monouso che Francesco manda
   su WhatsApp dall'agenda (N4). Un tocco del cliente: il server consuma il
   token (valido 48 ore, una volta sola), scrive il cookie hb_cliente e porta
   alla home con "Il mio appuntamento" già aperto. Nessun dato da copiare. */

const intestazioni = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
};

const vai = (dove: string, richiesta: Request, cookie?: string | null) => {
  const r = new Response(null, { status: 303, headers: { ...intestazioni, Location: new URL(dove, richiesta.url).toString() } });
  if (cookie) r.headers.append("Set-Cookie", cookie);
  return r;
};

export async function GET(richiesta: Request, ctx: RouteContext<"/appuntamento/accesso/[token]">) {
  const { token } = await ctx.params;
  if (!riconoscimentoAttivo() || !/^[A-Za-z0-9_-]{43}$/.test(token)) return vai("/appuntamento?scaduto=1", richiesta);
  const clienteId = await consumaAccessoMonouso(sha256(`accesso:${token}`), randomUUID());
  if (!clienteId) return vai("/appuntamento?scaduto=1", richiesta);
  return vai("/?gestione=1", richiesta, cookieCliente(clienteId));
}

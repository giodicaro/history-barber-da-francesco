import { LookbookNonPronto, nomeDelToken } from "@/lib/lookbook/archivio";

/* Manifest di "Il mio stile", uno per cliente.

   Dev'essere dinamico perché l'indirizzo d'avvio contiene il token: aggiunto
   alla schermata Home, il telefono riapre proprio la scheda di quel cliente.
   Lo scope è la sua cartella /stile/<token>: non tocca /admin, dove vive
   l'agenda con le sue notifiche. */

export async function GET(_richiesta: Request, ctx: RouteContext<"/stile/[token]/manifesto">) {
  const { token } = await ctx.params;
  let nome: string | null = null;
  try {
    nome = await nomeDelToken(token);
  } catch (e) {
    if (!(e instanceof LookbookNonPronto)) throw e;
  }
  const intestazioni = {
    "Cache-Control": "private, no-cache",
    "X-Robots-Tag": "noindex, nofollow",
    "Referrer-Policy": "no-referrer",
  };
  if (!nome) return new Response("Non trovato", { status: 404, headers: intestazioni });

  const base = `/stile/${token}`;
  return Response.json(
    {
      name: "Il mio stile · History Barber",
      short_name: "Il mio stile",
      description: "I tuoi tagli da History Barber da Francesco, sempre con te.",
      id: base,
      start_url: base,
      scope: base,
      display: "standalone",
      orientation: "portrait",
      background_color: "#0a0a0a",
      theme_color: "#0a0a0a",
      lang: "it",
      icons: [
        { src: "/agenda/icona-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/agenda/icona-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      ],
    },
    { headers: { ...intestazioni, "Content-Type": "application/manifest+json; charset=utf-8" } },
  );
}

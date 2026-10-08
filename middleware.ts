import type { NextFetchEvent, NextRequest } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { configAccesso, rispostaNonDisponibile } from "@/lib/auth-config";

/* Guardia davanti all'agenda. Gira prima della pagina, sul runtime Edge:
   usa solo la configurazione condivisa (auth.config.ts), senza il provider
   che ha bisogno di node:crypto.

   Se ADMIN_PASSWORD o AUTH_SECRET mancano (o il segreto è troppo corto)
   l'agenda risponde 503 con un messaggio generico: fail-closed, e i dettagli
   solo nei log (lib/auth-config.ts).

   Il controllo è ripetuto anche dentro la pagina (app/admin/page.tsx): il
   middleware è una comodità, non l'unica difesa. */
const { auth } = NextAuth(authConfig);
const guardia = auth as unknown as (request: NextRequest, event: NextFetchEvent) => Promise<Response | undefined>;

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  if (!configAccesso().ok) return rispostaNonDisponibile();
  return guardia(request, event);
}

export const config = {
  matcher: ["/admin/:path*"],
};

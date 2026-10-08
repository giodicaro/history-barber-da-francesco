import type { NextFetchEvent, NextRequest } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { configAccesso, rispostaNonDisponibile } from "@/lib/auth-config";

/* Guardia davanti all'agenda (Proxy di Next 16, ex middleware).

   Gira sul runtime Node.js, il predefinito di proxy.ts: legge le variabili
   d'ambiente come il resto del server. Il vecchio middleware.ts girava sul
   runtime Edge, dove su Vercel le variabili lette con un nome dinamico
   possono non arrivare: la guardia le vedeva mancanti e rispondeva 503
   anche con la configurazione giusta.

   Se ADMIN_PASSWORD o AUTH_SECRET mancano (o il segreto è troppo corto)
   l'agenda risponde 503 con un messaggio generico: fail-closed, e il motivo
   solo nei log (lib/auth-config.ts).

   Il controllo è ripetuto anche dentro la pagina (app/admin/page.tsx): il
   proxy è una comodità, non l'unica difesa. */
const { auth } = NextAuth(authConfig);
const guardia = auth as unknown as (request: NextRequest, event: NextFetchEvent) => Promise<Response | undefined>;

export function proxy(request: NextRequest, event: NextFetchEvent) {
  if (!configAccesso().ok) return rispostaNonDisponibile();
  return guardia(request, event);
}

export const config = {
  matcher: ["/admin/:path*"],
};

import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

/* Guardia davanti all'agenda. Gira prima della pagina, sul runtime Edge:
   usa solo la configurazione condivisa (auth.config.ts), senza il provider
   che ha bisogno di node:crypto.

   Il controllo è ripetuto anche dentro la pagina (app/admin/page.tsx): il
   middleware è una comodità, non l'unica difesa.

   Export default e non destrutturato: Next legge il file staticamente e
   vuole vedere una funzione esportata. */
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: ["/admin/:path*"],
};

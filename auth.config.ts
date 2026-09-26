import type { NextAuthConfig } from "next-auth";

/* Configurazione condivisa fra il server e il middleware.

   Perché è divisa in due file: il middleware gira sul runtime Edge, dove non
   esistono le API di Node. Qui dentro c'è solo quello che vale ovunque
   (pagine, durata, callback); il provider Credentials, che usa `node:crypto`
   per confrontare la password, sta in auth.ts. */

export const authConfig = {
  // trustHost: il sito gira su Vercel e in locale su porte diverse; senza
  // questo Auth.js rifiuterebbe le richieste non riconosciute.
  trustHost: true,
  pages: { signIn: "/admin/login" },
  // Sessione via cookie firmato (JWT): non serve una tabella di sessioni,
  // e l'utente è uno solo.
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  callbacks: {
    // Usata dal middleware: decide chi può entrare in /admin.
    authorized: ({ auth, request }) => {
      const dentroAgenda = request.nextUrl.pathname.startsWith("/admin");
      const allaLogin = request.nextUrl.pathname === "/admin/login";
      if (!dentroAgenda || allaLogin) return true;
      return Boolean(auth?.user);
    },
  },
  providers: [],
} satisfies NextAuthConfig;

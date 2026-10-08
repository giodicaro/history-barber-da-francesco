import type { NextAuthConfig } from "next-auth";

/* Configurazione condivisa fra il server e il middleware.

   Perché è divisa in due file: il middleware gira sul runtime Edge, dove non
   esistono le API di Node. Qui dentro c'è solo quello che vale ovunque
   (pagine, durata, callback); il provider Credentials, che usa `node:crypto`
   per confrontare la password, sta in auth.ts. */

/* La sessione è legata alla password: dentro il cookie c'è un'impronta di
   ADMIN_PASSWORD (SHA-256 insieme ad AUTH_SECRET, mai la password). Se la
   password cambia su Vercel, l'impronta non torna più e ogni telefono già
   entrato deve rifare l'accesso: cambiare password chiude davvero la porta.
   Web Crypto e non node:crypto, perché questo file gira anche sul runtime
   Edge del middleware. */
async function impronta(): Promise<string> {
  const testo = `${process.env.AUTH_SECRET ?? ""}:${process.env.ADMIN_PASSWORD ?? ""}`;
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(testo));
  return Array.from(new Uint8Array(hash).slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
}

export const authConfig = {
  // trustHost: il sito gira su Vercel e in locale su porte diverse; senza
  // questo Auth.js rifiuterebbe le richieste non riconosciute.
  trustHost: true,
  pages: { signIn: "/admin/login" },
  // Sessione via cookie firmato (JWT): non serve una tabella di sessioni,
  // e l'utente è uno solo.
  // Sessione lunga e rinnovata a ogni uso: sul telefono di Francesco
  // l'agenda resta aperta senza chiedere la password tutti i giorni. È
  // sicuro perché cambiare password o premere "Esci" la chiude (vedi sopra).
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
  callbacks: {
    jwt: async ({ token, user }) => {
      const attuale = await impronta();
      if (user) return { ...token, pw: attuale };
      // Sessione aperta con una password che non vale più: fuori.
      return token.pw === attuale ? token : null;
    },
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

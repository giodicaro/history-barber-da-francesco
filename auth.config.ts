import type { NextAuthConfig } from "next-auth";
import { configAccesso } from "@/lib/auth-config";

/* Configurazione condivisa fra il server e il proxy (proxy.ts).

   Perché è divisa in due file: qui c'è solo quello che vale in qualsiasi
   runtime (pagine, durata, callback); il provider Credentials, che usa
   `node:crypto` per confrontare la password, sta in auth.ts. */

/* La sessione è legata alla password: dentro il cookie c'è un'impronta di
   ADMIN_PASSWORD (SHA-256 insieme ad AUTH_SECRET, mai la password). Se la
   password cambia su Vercel, l'impronta non torna più e ogni telefono già
   entrato deve rifare l'accesso: cambiare password chiude davvero la porta.
   Web Crypto e non node:crypto: resta compatibile con qualsiasi runtime. */
async function impronta(): Promise<string | null> {
  const config = configAccesso();
  if (!config.ok) return null;
  const testo = `${config.segreto}:${config.password}`;
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(testo));
  return Array.from(new Uint8Array(hash).slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
}

export const authConfig = {
  // trustHost: il sito gira su Vercel e in locale su porte diverse; senza
  // questo Auth.js rifiuterebbe le richieste non riconosciute.
  trustHost: true,
  // Il segreto validato (spazi tolti, lunghezza minima): Auth.js non legge
  // AUTH_SECRET per conto suo. Se manca, proxy e rotte rispondono 503
  // prima di arrivare qui.
  secret: (() => {
    const config = configAccesso();
    return config.ok ? config.segreto : undefined;
  })(),
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
      // Configurazione mancante: nessuna sessione vale (fail-closed).
      if (!attuale) return null;
      if (user) return { ...token, pw: attuale };
      // Sessione aperta con una password che non vale più: fuori.
      return token.pw === attuale ? token : null;
    },
    // Usata dal proxy: decide chi può entrare in /admin.
    authorized: ({ auth, request }) => {
      const dentroAgenda = request.nextUrl.pathname.startsWith("/admin");
      const allaLogin = request.nextUrl.pathname === "/admin/login";
      if (!dentroAgenda || allaLogin) return true;
      return Boolean(auth?.user);
    },
  },
  providers: [],
} satisfies NextAuthConfig;

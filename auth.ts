import { createHash, timingSafeEqual } from "node:crypto";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { configAccesso } from "@/lib/auth-config";

/* Accesso all'agenda: un solo utente, una sola password.

   Non c'è un elenco di utenti perché non serve: in salone c'è Francesco. La
   password sta in ADMIN_PASSWORD (variabile d'ambiente, vedi .env.example,
   letta e validata in lib/auth-config.ts) e non finisce mai nel codice né nel
   repository.

   Il confronto è a tempo costante e fra impronte SHA-256 della stessa
   lunghezza: nemmeno la lunghezza della password trapela dai tempi di
   risposta. Contro i tentativi a raffica: mezzo secondo di attesa a ogni
   errore e, dopo 5 errori in 15 minuti dallo stesso indirizzo, stop anche
   alla password giusta fino alla fine della finestra. */

class CredenzialiErrate extends CredentialsSignin {
  code = "credenziali";
}

class TroppiTentativi extends CredentialsSignin {
  code = "troppi";
}

const sha256 = (testo: string) => createHash("sha256").update(testo).digest();

function passwordGiusta(inserita: string): boolean {
  const config = configAccesso();
  if (!config.ok) return false; // fail-closed
  return timingSafeEqual(sha256(inserita), sha256(config.password));
}

const FINESTRA_MS = 15 * 60 * 1000;
const ERRORI_MAX = 5;
// Per istanza e in memoria, come il freno delle prenotazioni: basta a
// rendere impraticabile provare password a mano o con uno script.
const errori = ((globalThis as { __erroriAccesso?: Map<string, number[]> }).__erroriAccesso ??= new Map());

const ipDi = (request: Request | undefined) =>
  request?.headers.get("x-forwarded-for")?.split(",")[0].trim() || "sconosciuto";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { password: { label: "Password", type: "password" } },
      authorize: async (credenziali, request) => {
        const ip = ipDi(request);
        const adesso = Date.now();
        const recenti = (errori.get(ip) ?? []).filter((t: number) => adesso - t < FINESTRA_MS);
        if (recenti.length >= ERRORI_MAX) throw new TroppiTentativi();

        const password = typeof credenziali?.password === "string" ? credenziali.password : "";
        if (!passwordGiusta(password)) {
          errori.set(ip, [...recenti, adesso]);
          await new Promise((r) => setTimeout(r, 500));
          throw new CredenzialiErrate();
        }
        errori.delete(ip);
        return { id: "titolare", name: "Francesco" };
      },
    }),
  ],
});

/** True se l'accesso è configurato: senza password nessuno può entrare. */
export const accessoConfigurato = () => configAccesso().ok;

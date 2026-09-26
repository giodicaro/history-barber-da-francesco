import { timingSafeEqual } from "node:crypto";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";

/* Accesso all'agenda: un solo utente, una sola password.

   Non c'è un elenco di utenti perché non serve: in salone c'è Francesco. La
   password sta in ADMIN_PASSWORD (variabile d'ambiente, vedi .env.example) e
   non finisce mai nel codice né nel repository.

   Il confronto è a tempo costante: un confronto normale con === esce al primo
   carattere diverso e, misurando i tempi di risposta, permetterebbe di
   indovinare la password un carattere alla volta. */

class CredenzialiErrate extends CredentialsSignin {
  code = "credenziali";
}

function passwordGiusta(inserita: string): boolean {
  const attesa = process.env.ADMIN_PASSWORD;
  if (!attesa) return false;
  const a = Buffer.from(inserita);
  const b = Buffer.from(attesa);
  // timingSafeEqual pretende la stessa lunghezza: la differenza di lunghezza
  // si controlla a parte (è un'informazione che non aiuta chi indovina).
  return a.length === b.length && timingSafeEqual(a, b);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { password: { label: "Password", type: "password" } },
      authorize: (credenziali) => {
        const password = typeof credenziali?.password === "string" ? credenziali.password : "";
        if (!passwordGiusta(password)) throw new CredenzialiErrate();
        return { id: "titolare", name: "Francesco" };
      },
    }),
  ],
});

/** True se l'accesso è configurato: senza password nessuno può entrare. */
export const accessoConfigurato = () => Boolean(process.env.ADMIN_PASSWORD && process.env.AUTH_SECRET);

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { accessoConfigurato, auth, signIn } from "@/auth";
import { salone } from "@/lib/salone";

/* Accesso all'agenda. Una password sola, quella del salone.

   È un Server Component: il modulo con il form è l'unico pezzo di client, e
   l'invio passa da una Server Action, quindi la password non attraversa mai
   codice nostro nel browser. */

export const metadata: Metadata = {
  title: "Accesso agenda — History Barber",
  robots: { index: false, follow: false },
};

export default async function Login(props: PageProps<"/admin/login">) {
  const sessione = await auth();
  if (sessione?.user) redirect("/admin");

  const errore = (await props.searchParams).errore;
  const configurato = accessoConfigurato();

  async function entra(dati: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        password: String(dati.get("password") ?? ""),
        redirectTo: "/admin",
      });
    } catch (e) {
      // signIn segnala il successo lanciando un redirect: va rilanciato.
      if (e instanceof AuthError) redirect("/admin/login?errore=1");
      throw e;
    }
  }

  return (
    <main className="flex min-h-svh items-center bg-ink text-paper">
      <div className="shell">
        <p className="eyebrow text-smoke">{salone.nomeCompleto}</p>
        <h1 className="display mt-4 text-[clamp(2.5rem,9vw,6rem)]">Agenda</h1>

        {configurato ? (
          <form action={entra} className="mt-10 max-w-sm">
            <label htmlFor="password" className="eyebrow text-smoke">
              Password del salone
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              autoFocus
              required
              className="mt-3 w-full border border-paper/30 bg-transparent px-4 py-3 text-base outline-none focus:border-paper"
            />
            {errore && (
              <p role="alert" className="info mt-3 text-paper">
                Password sbagliata.
              </p>
            )}
            <button
              type="submit"
              className="eyebrow mt-6 min-h-12 w-full cursor-pointer border border-paper bg-paper px-6 text-ink transition-colors duration-200 hover:bg-transparent hover:text-paper"
            >
              Entra
            </button>
          </form>
        ) : (
          <p className="info mt-10 max-w-md text-smoke">
            Accesso non configurato: mancano le variabili d&apos;ambiente <b>ADMIN_PASSWORD</b> e{" "}
            <b>AUTH_SECRET</b>. Vedi <b>.env.example</b>.
          </p>
        )}
      </div>
    </main>
  );
}

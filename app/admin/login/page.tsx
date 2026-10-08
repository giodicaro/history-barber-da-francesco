import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { accessoConfigurato, auth, signIn } from "@/auth";
import { MESSAGGIO_NON_DISPONIBILE } from "@/lib/auth-config";
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


  const parametri = await props.searchParams;
  const errore = parametri.errore;
  const configurato = accessoConfigurato();
  // Dopo l'accesso si torna dove si voleva andare (es. il giorno aperto da
  // una notifica). Solo pagine dell'agenda: niente redirect verso fuori.
  const richiesta = Array.isArray(parametri.callbackUrl) ? parametri.callbackUrl[0] : parametri.callbackUrl;
  const percorso = richiesta ? (() => {
    try {
      const u = new URL(richiesta, "http://x");
      return u.pathname.startsWith("/admin") && !u.pathname.startsWith("/admin/login") ? u.pathname + u.search : null;
    } catch {
      return null;
    }
  })() : null;
  const destinazione = percorso ?? "/admin";

  async function entra(dati: FormData) {
    "use server";
    const verso = String(dati.get("verso") ?? "/admin");
    const sicuro = verso.startsWith("/admin") && !verso.startsWith("//") ? verso : "/admin";
    try {
      await signIn("credentials", {
        password: String(dati.get("password") ?? ""),
        redirectTo: sicuro,
      });
    } catch (e) {
      // signIn segnala il successo lanciando un redirect: va rilanciato.
      if (e instanceof AuthError) {
        const troppi = "code" in e && e.code === "troppi";
        redirect(`/admin/login?errore=${troppi ? "troppi" : "1"}&callbackUrl=${encodeURIComponent(sicuro)}`);
      }
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
            <input type="hidden" name="verso" value={destinazione} />
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
                {errore === "troppi"
                  ? "Troppi tentativi sbagliati. Riprova fra 15 minuti."
                  : "Password sbagliata. Se è stata cambiata da poco, usa quella nuova."}
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
          // Di solito ci pensa il middleware (503). Qui, se mai si arriva,
          // nessun dettaglio tecnico: quelli sono nei log del server.
          <p role="status" className="info mt-10 max-w-md text-smoke">
            {MESSAGGIO_NON_DISPONIBILE}
          </p>
        )}
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { auth } from "@/auth";
import { CreaScheda } from "@/components/lookbook/CreaScheda";
import { NavAdmin } from "@/components/lookbook/NavAdmin";
import { dataLook } from "@/lib/lookbook/formato";
import { eliminaLookbookScaduti, elencoSchede, LookbookNonPronto, schedaPerTelefono } from "@/lib/lookbook/archivio";
import type { RigaElenco } from "@/lib/lookbook/tipi";
import { oraDiRoma } from "@/lib/orari";
import { voce } from "@/lib/prenotazioni/archivio";
import { telefonoLeggibile } from "@/lib/prenotazioni/telefono";

/* Lookbook, lato barbiere: l'elenco delle schede con la ricerca.

   Si arriva anche dall'agenda, con ?da=<id appuntamento>: se il cliente ha
   già una scheda (stesso telefono) si apre quella, altrimenti qui si propone
   di crearla con nome e telefono dell'appuntamento. Nell'indirizzo c'è solo
   l'id: nome e numero si leggono dal database. */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lookbook — History Barber",
  robots: { index: false, follow: false, nocache: true },
};

const primo = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function PaginaLookbook(props: PageProps<"/admin/lookbook">) {
  const sessione = await auth();
  if (!sessione?.user) redirect("/admin/login");

  const parametri = await props.searchParams;
  const cerca = primo(parametri.q).slice(0, 80);
  const da = primo(parametri.da);

  let proposta: { nome: string; telefono?: string } | undefined;
  let schede: RigaElenco[] = [];
  let pronto = true;

  try {
    if (da) {
      const appuntamento = await voce(da);
      if (appuntamento?.tipo === "appuntamento") {
        const telefono = appuntamento.cliente.telefono;
        const esistente = telefono ? await schedaPerTelefono(telefono) : null;
        if (esistente) redirect(`/admin/lookbook/${esistente}`);
        proposta = { nome: appuntamento.cliente.nome, ...(telefono ? { telefono } : {}) };
      }
    }
    schede = await elencoSchede(cerca);
  } catch (e) {
    if (!(e instanceof LookbookNonPronto)) throw e;
    pronto = false;
  }

  // Schede oltre il periodo di conservazione: via, dopo aver risposto.
  after(() => eliminaLookbookScaduti(oraDiRoma().data));

  return (
    <main className="min-h-svh bg-paper pb-[env(safe-area-inset-bottom)] text-ink">
      <div className="shell max-w-3xl py-6 md:py-10">
        <NavAdmin attiva="lookbook" />

        <header className="border-b border-ink pb-6">
          <p className="eyebrow text-steel">History Barber da Francesco · lookbook</p>
          <h1 className="display mt-3 text-[clamp(2.75rem,15cqi,6rem)]">Lookbook</h1>
          <p className="mt-3 max-w-[48ch] text-base text-steel">
            Le foto e le note dei tagli, per rifarli uguali. Ogni cliente le rivede dal suo telefono con un link
            personale.
          </p>
        </header>

        {!pronto ? (
          <p className="info mt-8 border border-ink bg-ink px-4 py-3 text-paper">
            Il lookbook non è ancora attivo su questo database: va applicato lo schema nuovo con npm run db:init.
          </p>
        ) : (
          <>
            <div className="mt-6">
              <CreaScheda proposta={proposta} apertoSubito={Boolean(proposta)} />
            </div>

            <form role="search" action="/admin/lookbook" className="mt-6 flex">
              <label className="sr-only" htmlFor="cerca-scheda">
                Cerca per nome o telefono
              </label>
              <input
                id="cerca-scheda"
                name="q"
                type="search"
                defaultValue={cerca}
                placeholder="Cerca per nome o telefono"
                autoComplete="off"
                enterKeyHint="search"
                className="block min-h-12 w-full min-w-0 appearance-none rounded-none border border-r-0 border-ink/30 bg-paper px-3 text-base outline-none focus:border-ink"
              />
              <button
                type="submit"
                aria-label="Cerca"
                className="flex min-h-12 w-14 shrink-0 cursor-pointer items-center justify-center border border-ink bg-ink text-paper hover:bg-paper hover:text-ink"
              >
                <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="6.5" />
                  <path d="M16 16l4.5 4.5" />
                </svg>
              </button>
            </form>

            <section aria-labelledby="titolo-schede" className="mt-8">
              <h2 id="titolo-schede" className="eyebrow flex items-baseline justify-between text-steel">
                <span>{cerca ? `Risultati per “${cerca}”` : "Schede"}</span>
                <span className="info">{schede.length}</span>
              </h2>
              {cerca && (
                <Link href="/admin/lookbook" className="eyebrow mt-2 inline-flex min-h-11 items-center text-steel hover:text-ink">
                  × Togli la ricerca
                </Link>
              )}

              {schede.length === 0 ? (
                <p
                  className="mt-4 border border-ink/30 px-4 py-6 text-base text-steel"
                  style={{ backgroundImage: "repeating-linear-gradient(135deg, transparent 0 9px, rgb(10 10 10 / 0.06) 9px 11px)" }}
                >
                  {cerca ? (
                    "Nessuna scheda trovata."
                  ) : (
                    <>
                      Ancora nessuna scheda. Si crea dall&apos;agenda (apri un appuntamento → <b className="text-ink">Lookbook del cliente</b>) oppure qui sopra.
                    </>
                  )}
                </p>
              ) : (
                <ul className="mt-4 border-t border-ink/10">
                  {schede.map((s) => (
                    <li key={s.id} className="border-b border-ink/10">
                      <Link
                        href={`/admin/lookbook/${s.id}`}
                        className="grid min-h-18 grid-cols-[3.5rem_1fr_auto] items-center gap-4 py-2 transition-colors duration-150 hover:bg-fog"
                      >
                        <span className="relative block aspect-square bg-fog">
                          {s.copertina && (
                            // eslint-disable-next-line @next/next/no-img-element -- rotta protetta dalla sessione
                            <img
                              src={`/api/lookbook/foto/${s.copertina}?v=mini`}
                              alt=""
                              loading="lazy"
                              className="absolute inset-0 size-full object-cover"
                            />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-lg font-extrabold tracking-[-0.02em]">{s.nome}</span>
                          <span className="info mt-0.5 block truncate text-steel">
                            {s.telefono ? telefonoLeggibile(s.telefono) : "Senza telefono"}
                            {" · "}
                            {s.looks === 1 ? "1 taglio" : `${s.looks} tagli`}
                            {s.ultimo && ` · ${dataLook(s.ultimo)}`}
                          </span>
                        </span>
                        <svg viewBox="0 0 24 24" aria-hidden className="mr-1 size-5 text-steel" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import { formatoOra, oraDiRoma } from "@/lib/orari";
import { prenotazioniDelGiorno } from "@/lib/prenotazioni/archivio";
import { PASSO } from "@/lib/prenotazioni/slot";
import type { Prenotazione } from "@/lib/prenotazioni/tipi";
import { operatori, orari, salone } from "@/lib/salone";
import { cn, formatoPrezzo } from "@/lib/utils";

/* Agenda del giorno, pensata per un tablet appoggiato alla cassa: una riga
   ogni mezz'ora, gli appuntamenti pieni e i buchi vuoti, leggibili da lontano.

   È una pagina server: legge l'archivio e stampa. Nessun JavaScript da
   caricare, nessuno stato: si aggiorna ricaricando (o con ?data=YYYY-MM-DD
   per guardare un altro giorno).

   ⚠️ Pagina non protetta se manca ADMIN_TOKEN: vedi il riquadro rosso in cima.
   Con un database vero serve un'autenticazione seria (Auth.js, Supabase Auth),
   non un token nell'indirizzo. */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Agenda — History Barber",
  // Mai nei motori di ricerca: qui ci sono nomi e numeri di telefono.
  robots: { index: false, follow: false, nocache: true },
};

const MINUTI_RIGA = PASSO;

export default async function Agenda(props: PageProps<"/admin">) {
  const parametri = await props.searchParams;
  const valore = (chiave: string) => {
    const v = parametri[chiave];
    return Array.isArray(v) ? v[0] : v;
  };

  const chiaveAttesa = process.env.ADMIN_TOKEN;
  if (chiaveAttesa && valore("chiave") !== chiaveAttesa) {
    return (
      <main className="shell flex min-h-svh flex-col justify-center py-24">
        <h1 className="display text-[clamp(2rem,8vw,5rem)]">Agenda riservata</h1>
        <p className="info mt-6 text-steel">
          Aggiungi la chiave all&apos;indirizzo: /admin?chiave=…
        </p>
      </main>
    );
  }

  const adesso = oraDiRoma();
  const data = /^\d{4}-\d{2}-\d{2}$/.test(valore("data") ?? "") ? valore("data")! : adesso.data;
  const giorno = new Date(`${data}T12:00:00Z`).getUTCDay();
  const turni = orari[giorno].turni;
  const prenotazioni = await prenotazioniDelGiorno(data);
  const oggi = data === adesso.data;

  // Una riga ogni mezz'ora per ogni turno: la pausa pranzo resta un vuoto
  // dichiarato fra i due blocchi, non una lista infinita di orari chiusi.
  const righe = turni.flatMap((t) => {
    const elenco: { minuti: number; appuntamento?: Prenotazione; prosegue?: Prenotazione }[] = [];
    for (let m = t.apre; m < t.chiude; m += MINUTI_RIGA) {
      const appuntamento = prenotazioni.find((p) => p.inizio === m);
      const prosegue = prenotazioni.find((p) => p.inizio < m && p.fine > m);
      elenco.push({ minuti: m, appuntamento, prosegue });
    }
    return elenco;
  });

  const incasso = prenotazioni.reduce((somma, p) => somma + p.prezzo, 0);
  const minutiOccupati = prenotazioni.reduce((somma, p) => somma + (p.fine - p.inizio), 0);
  const minutiApertura = turni.reduce((somma, t) => somma + (t.chiude - t.apre), 0);

  return (
    <main className="min-h-svh bg-paper text-ink">
      <div className="shell py-8 md:py-12">
        {!chiaveAttesa && (
          <p className="info mb-8 border border-ink bg-ink px-4 py-3 text-paper">
            Pagina senza protezione: chiunque conosca l&apos;indirizzo vede nomi e telefoni. Imposta
            la variabile d&apos;ambiente ADMIN_TOKEN (e poi apri /admin?chiave=…).
          </p>
        )}

        <header className="flex flex-wrap items-end justify-between gap-6 border-b border-ink pb-6">
          <div>
            <p className="eyebrow text-steel">{salone.nomeCompleto} · agenda</p>
            <h1 className="display mt-3 text-[clamp(2.5rem,7vw,5rem)]">{orari[giorno].giorno}</h1>
            <p className="info mt-2 text-steel">
              {data}
              {oggi && ` · ora ${formatoOra(adesso.minuti)}`} · {operatori.map((o) => o.nome).join(", ")}
            </p>
          </div>
          <dl className="flex gap-8">
            <div>
              <dt className="eyebrow text-steel">Appuntamenti</dt>
              <dd className="mt-2 text-3xl font-extrabold tabular-nums">{prenotazioni.length}</dd>
            </div>
            <div>
              <dt className="eyebrow text-steel">Poltrona</dt>
              <dd className="mt-2 text-3xl font-extrabold tabular-nums">
                {minutiApertura ? Math.round((minutiOccupati / minutiApertura) * 100) : 0}%
              </dd>
            </div>
            <div>
              <dt className="eyebrow text-steel">Previsto</dt>
              <dd className="mt-2 text-3xl font-extrabold tabular-nums">{formatoPrezzo(incasso)}</dd>
            </div>
          </dl>
        </header>

        {turni.length === 0 ? (
          <p className="info py-16 text-steel">Salone chiuso.</p>
        ) : (
          <ol className="mt-8">
            {righe.map(({ minuti, appuntamento, prosegue }, i) => {
              const inCorso = oggi && adesso.minuti >= minuti && adesso.minuti < minuti + MINUTI_RIGA;
              const primaDelTurno = i > 0 && righe[i - 1].minuti + MINUTI_RIGA < minuti;
              return (
                <li key={minuti}>
                  {primaDelTurno && (
                    <p className="info border-t border-dashed grid-line py-3 pl-3 text-steel">Pausa</p>
                  )}
                  <div
                    className={cn(
                      "grid grid-cols-[4.5rem_1fr] items-stretch border-t grid-line md:grid-cols-[6rem_1fr]",
                      inCorso && "bg-fog",
                    )}
                  >
                    <p
                      className={cn(
                        "info py-4 tabular-nums",
                        appuntamento || prosegue ? "text-ink" : "text-steel",
                      )}
                    >
                      {formatoOra(minuti)}
                    </p>
                    {appuntamento ? (
                      <div className="border-l-4 border-ink bg-ink py-4 pl-4 pr-3 text-paper">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                          <p className="text-xl font-extrabold tracking-[-0.02em] md:text-2xl">
                            {appuntamento.cliente.nome}
                          </p>
                          <p className="info text-smoke">
                            {formatoOra(appuntamento.inizio)}–{formatoOra(appuntamento.fine)} ·{" "}
                            {formatoPrezzo(appuntamento.prezzo)}
                          </p>
                        </div>
                        <p className="mt-1 text-base">{appuntamento.servizioNome}</p>
                        <p className="info mt-2 text-smoke">
                          <a href={`tel:${appuntamento.cliente.telefono}`} className="underline-offset-4 hover:underline">
                            {appuntamento.cliente.telefono}
                          </a>
                          {appuntamento.origine && ` · da ${appuntamento.origine}`}
                        </p>
                        {appuntamento.cliente.note && (
                          <p className="mt-2 max-w-[60ch] text-sm text-smoke">“{appuntamento.cliente.note}”</p>
                        )}
                      </div>
                    ) : prosegue ? (
                      <div className="border-l-4 border-ink bg-ink/90 py-4 pl-4 text-smoke">
                        <p className="info">— in corso: {prosegue.cliente.nome}</p>
                      </div>
                    ) : (
                      <p className="info py-4 pl-4 text-steel/60">Libero</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <p className="info mt-10 border-t grid-line pt-6 text-steel">
          Le prenotazioni stanno in memoria del server: si azzerano a ogni riavvio e non sono
          condivise fra le istanze. Prima dell&apos;uso vero va collegato un database
          (lib/prenotazioni/archivio.ts).
        </p>
      </div>
    </main>
  );
}

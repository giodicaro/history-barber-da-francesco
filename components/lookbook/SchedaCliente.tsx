"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { cambiaPreferito, eliminaLookCliente, eliminaSchedaCliente } from "@/app/admin/lookbook/azioni";
import { FoglioInBasso, Rotella } from "@/components/agenda/FoglioInBasso";
import { bottonePieno, bottoneVuoto } from "@/components/agenda/stili";
import { cancellaBozza, leggiBozza, type Bozza } from "@/lib/lookbook/bozze";
import type { Look } from "@/lib/lookbook/tipi";
import { telefonoLeggibile } from "@/lib/prenotazioni/telefono";
import { cn } from "@/lib/utils";
import { CondividiStile } from "./CondividiStile";
import { FoglioNuovoLook } from "./FoglioNuovoLook";
import { CaroselloFoto, dataLook, NoteDelLook, Stella, type IndirizzoFoto } from "./Pezzi";

/* La scheda di un cliente, lato barbiere: nome gigante, "Nuovo look", la
   linea del tempo dei tagli, il link da dare al cliente, la cancellazione.

   I dati arrivano dalla pagina server (app/admin/lookbook/[id]/page.tsx);
   dopo ogni scrittura la pagina si ridisegna da sola (refresh() nelle
   Server Action, router.refresh() dopo il caricamento delle foto). */

const fotoBarbiere: IndirizzoFoto = (id, v) => `/api/lookbook/foto/${id}?v=${v}`;

const dataConsenso = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Rome" });

type Foglio = null | { tipo: "nuovo"; bozza?: Bozza | null } | { tipo: "look"; id: string };

export function SchedaCliente({
  cliente,
  looks,
  link,
  qr,
}: {
  cliente: { id: string; nome: string; telefono?: string; consensoIl: string };
  looks: Look[];
  link: string;
  qr: string;
}) {
  const router = useRouter();
  const [foglio, setFoglio] = useState<Foglio>(null);
  const [bozza, setBozza] = useState<Bozza | null>(null);
  const [salvato, setSalvato] = useState(false);
  const [, avviaAggiornamento] = useTransition();

  // Un look rimasto sul telefono (rete assente, foglio chiuso a metà).
  useEffect(() => {
    let vivo = true;
    void leggiBozza(cliente.id).then((b) => {
      if (vivo && b) setBozza(b);
    });
    return () => {
      vivo = false;
    };
  }, [cliente.id]);

  const lookAperto = foglio?.tipo === "look" ? looks.find((l) => l.id === foglio.id) : undefined;

  return (
    <>
      <header className="border-b border-ink pb-6">
        <Link href="/admin/lookbook" className="eyebrow inline-flex min-h-11 items-center text-steel hover:text-ink">
          ← Tutte le schede
        </Link>
        <p className="info mt-3 text-steel">Scheda cliente · consenso del {dataConsenso.format(new Date(cliente.consensoIl))}</p>
        <h1 className="display mt-3 break-words text-[clamp(2.5rem,13cqi,5.5rem)]">{cliente.nome}</h1>
        <p className="info mt-3">
          {cliente.telefono ? (
            <a href={`tel:${cliente.telefono}`} className="inline-flex min-h-11 items-center underline underline-offset-4">
              {telefonoLeggibile(cliente.telefono)}
            </a>
          ) : (
            <span className="text-steel">Telefono non lasciato</span>
          )}
        </p>
        <button
          type="button"
          onClick={() => {
            setSalvato(false);
            setFoglio({ tipo: "nuovo", bozza });
          }}
          className={cn(bottonePieno, "mt-5 min-h-14 w-full")}
        >
          <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          {bozza ? "Riprendi il look non salvato" : "Nuovo look"}
        </button>
      </header>

      <div aria-live="polite">
        {bozza && !foglio && (
          <div className="mt-6 border-2 border-dashed border-ink px-4 py-4">
            <p className="text-base">
              Sul telefono c&apos;è un look del {dataLook(bozza.data)} con {bozza.foto.length} foto, non ancora
              salvato.
            </p>
            <div className="mt-3 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  void cancellaBozza(cliente.id);
                  setBozza(null);
                }}
                className={bottoneVuoto}
              >
                Scarta
              </button>
              <button type="button" onClick={() => setFoglio({ tipo: "nuovo", bozza })} className={bottonePieno}>
                Riprendi
              </button>
            </div>
          </div>
        )}
        {salvato && (
          <p className="info mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 border border-ink bg-ink px-4 py-3 text-paper">
            Look salvato.
            <a href="#link-cliente" className="underline underline-offset-4">
              Adesso mostra il QR al cliente ↓
            </a>
          </p>
        )}
      </div>

      <section aria-labelledby="titolo-looks" className="mt-10">
        <h2 id="titolo-looks" className="eyebrow text-steel">
          (01) Tagli · {looks.length}
        </h2>
        {looks.length === 0 ? (
          <p
            className="mt-4 border border-ink/30 px-4 py-6 text-base text-steel"
            style={{ backgroundImage: "repeating-linear-gradient(135deg, transparent 0 9px, rgb(10 10 10 / 0.06) 9px 11px)" }}
          >
            Ancora nessun taglio. Dopo il servizio tocca <b className="text-ink">Nuovo look</b>: tre foto e due note.
          </p>
        ) : (
          <ol className="mt-4 border-t border-ink/10">
            {looks.map((l) => (
              <li key={l.id} className="border-b border-ink/10">
                <button
                  type="button"
                  onClick={() => setFoglio({ tipo: "look", id: l.id })}
                  className="grid w-full cursor-pointer grid-cols-[4.5rem_1fr] items-center gap-4 py-3 text-left transition-colors duration-150 hover:bg-fog"
                >
                  <span className="relative block aspect-square bg-fog">
                    {l.foto[0] && (
                      // eslint-disable-next-line @next/next/no-img-element -- rotta protetta dalla sessione
                      <img src={fotoBarbiere(l.foto[0].id, "mini")} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="info flex items-center gap-2">
                      {dataLook(l.data)}
                      {l.preferito && (
                        <span className="inline-flex items-center gap-1">
                          <Stella piena className="size-3.5" />
                          <span className="sr-only">preferito</span>
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block truncate text-base font-bold">{l.sfumatura ?? l.sopra ?? "Senza note"}</span>
                    <span className="info mt-1 block text-steel">
                      {l.foto.length} foto{l.prodotto ? ` · ${l.prodotto}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section id="link-cliente" aria-labelledby="titolo-link" className="mt-12 scroll-mt-6 border-t border-ink pt-6">
        <h2 id="titolo-link" className="eyebrow text-steel">
          (02) Dai al cliente il suo link
        </h2>
        <div className="mt-4">
          <CondividiStile clienteId={cliente.id} nome={cliente.nome} telefono={cliente.telefono} link={link} qr={qr} />
        </div>
      </section>

      <section aria-labelledby="titolo-elimina" className="mt-12 border-t border-ink pt-6">
        <h2 id="titolo-elimina" className="eyebrow text-steel">
          (03) Scheda
        </h2>
        <EliminaScheda id={cliente.id} nome={cliente.nome} />
      </section>

      {foglio?.tipo === "nuovo" && (
        <FoglioNuovoLook
          clienteId={cliente.id}
          nome={cliente.nome}
          ultimo={looks[0]}
          bozza={foglio.bozza}
          onChiudi={(b) => {
            setBozza(b);
            setFoglio(null);
          }}
          onSalvato={() => {
            setBozza(null);
            setFoglio(null);
            setSalvato(true);
            avviaAggiornamento(() => router.refresh());
          }}
        />
      )}

      {lookAperto && <DettaglioLook key={lookAperto.id} look={lookAperto} onChiudi={() => setFoglio(null)} />}
    </>
  );
}

function DettaglioLook({ look, onChiudi }: { look: Look; onChiudi: () => void }) {
  const [inVolo, avvia] = useTransition();
  const [conferma, setConferma] = useState(false);
  const [errore, setErrore] = useState("");

  const esegui = (azione: () => Promise<{ ok: boolean; errore?: string }>, chiudiDopo = false) =>
    avvia(async () => {
      setErrore("");
      try {
        const r = await azione();
        if (!r.ok) setErrore(r.errore ?? "Non è andata a buon fine.");
        else if (chiudiDopo) onChiudi();
      } catch {
        setErrore("Connessione assente: non è cambiato niente. Riprova.");
      }
    });

  const piede = conferma ? (
    <div>
      <p className="mb-3 text-base">Cancellare questo look con le sue foto? Sparisce anche dal telefono del cliente.</p>
      <div className="flex gap-3">
        <button type="button" onClick={() => setConferma(false)} disabled={inVolo} className={bottoneVuoto}>
          No
        </button>
        <button
          type="button"
          onClick={() => esegui(() => eliminaLookCliente(look.id), true)}
          disabled={inVolo}
          aria-busy={inVolo}
          className={bottonePieno}
        >
          {inVolo && <Rotella />}
          {inVolo ? "Un attimo…" : "Sì, cancella"}
        </button>
      </div>
    </div>
  ) : (
    <div className="flex gap-3">
      <button type="button" onClick={() => setConferma(true)} className={bottoneVuoto}>
        Cancella
      </button>
      <button
        type="button"
        onClick={() => esegui(() => cambiaPreferito(look.id, !look.preferito))}
        disabled={inVolo}
        aria-pressed={look.preferito}
        className={look.preferito ? bottonePieno : bottoneVuoto}
      >
        {inVolo ? <Rotella /> : <Stella piena={look.preferito} />}
        Preferito
      </button>
    </div>
  );

  return (
    <FoglioInBasso aperto onChiudi={onChiudi} bloccato={inVolo} sopratitolo={dataLook(look.data)} titolo={look.sfumatura ?? "Look"} piede={piede}>
      {errore && (
        <p role="alert" className="info mb-5 border border-ink bg-ink px-4 py-3 text-paper">
          {errore}
        </p>
      )}
      <CaroselloFoto foto={look.foto} indirizzo={fotoBarbiere} tema="chiaro" />
      <div className="mt-5">
        <NoteDelLook look={look} tema="chiaro" />
      </div>
    </FoglioInBasso>
  );
}

function EliminaScheda({ id, nome }: { id: string; nome: string }) {
  const router = useRouter();
  const [conferma, setConferma] = useState(false);
  const [errore, setErrore] = useState("");
  const [inVolo, avvia] = useTransition();

  const elimina = () =>
    avvia(async () => {
      setErrore("");
      try {
        const r = await eliminaSchedaCliente(id);
        if (r.ok) router.replace("/admin/lookbook");
        else setErrore(r.errore);
      } catch {
        setErrore("Connessione assente: non è stato cancellato niente. Riprova.");
      }
    });

  return (
    <div className="mt-4">
      <p className="max-w-[48ch] text-base text-steel">
        Se il cliente chiede di cancellare tutto: foto, note e scheda spariscono, e il suo link smette di funzionare.
      </p>
      {errore && (
        <p role="alert" className="info mt-3 border border-ink bg-ink px-4 py-3 text-paper">
          {errore}
        </p>
      )}
      {conferma ? (
        <div className="mt-4">
          <p className="mb-3 text-base">
            Cancellare per sempre la scheda di <b>{nome}</b>?
          </p>
          <div className="flex gap-3">
            <button type="button" onClick={() => setConferma(false)} disabled={inVolo} className={bottoneVuoto}>
              No
            </button>
            <button type="button" onClick={elimina} disabled={inVolo} aria-busy={inVolo} className={bottonePieno}>
              {inVolo && <Rotella />}
              {inVolo ? "Un attimo…" : "Sì, cancella tutto"}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setConferma(true)} className={cn(bottoneVuoto, "mt-4 w-full md:w-auto")}>
          Elimina scheda
        </button>
      )}
    </div>
  );
}

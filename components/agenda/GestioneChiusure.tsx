"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { flushSync } from "react-dom";
import {
  cambiaAttiva,
  eliminaChiusuraAzione,
  salvaChiusura,
  verificaChiusura,
  type Conflitto,
  type DatiChiusura,
  type EsitoChiusura,
} from "@/app/admin/azioni-chiusure";
import { dataBreve, type Chiusura, type ErroriChiusura } from "@/lib/chiusure";
import { cn } from "@/lib/utils";
import { FoglioInBasso, Rotella } from "./FoglioInBasso";
import { bottonePieno, bottoneVuoto, campo } from "./stili";
import { Tendina } from "./Tendina";

/* "Chiusure e ferie" dell'agenda (app/admin/chiusure).

   Il giro di un salvataggio: verifica (errori, chiusure con cui si
   sovrappone, appuntamenti in quei giorni) → se serve, una domanda a
   Francesco → salvataggio. Gli appuntamenti non si toccano mai da soli: si
   mostrano, con telefono e WhatsApp, e decide lui. Lo stesso vale quando si
   riaccende una chiusura spenta. */

const MOTIVI = ["Ferie estive", "Ferie", "Natale", "Ponte", "Chiusura straordinaria"];
// Valore tecnico dell'opzione "Altro…" nella tendina: non si salva mai.
const VALORE_ALTRO = "__altro__";

const giorni = (c: Pick<Chiusura, "dal" | "al">) =>
  Math.round((Date.parse(`${c.al}T12:00:00Z`) - Date.parse(`${c.dal}T12:00:00Z`)) / 86_400_000) + 1;

const periodo = (c: Pick<Chiusura, "dal" | "al">) =>
  c.dal === c.al ? dataBreve(c.dal) : `${dataBreve(c.dal)} – ${dataBreve(c.al)}`;

async function sicura<T>(azione: () => Promise<T>, errore: T): Promise<T> {
  try {
    return await azione();
  } catch {
    return errore;
  }
}

const SENZA_RETE = { ok: false as const, errore: "Connessione assente o lenta: non è stato salvato niente. Riprova." };

type Domanda =
  | { tipo: "conflitti"; dati: DatiChiusura; conflitti: Conflitto[]; poi: "salva" | { attiva: string } }
  | { tipo: "sovrapposte"; dati: DatiChiusura; sovrapposte: Chiusura[] };

export function GestioneChiusure({ chiusure, oggi }: { chiusure: Chiusura[]; oggi: string }) {
  const [foglio, setFoglio] = useState<null | { chiusura?: Chiusura }>(null);
  const [messaggio, setMessaggio] = useState("");
  const [inCorso, avvia] = useTransition();
  const [daEliminare, setDaEliminare] = useState<string | null>(null);
  const [domandaLista, setDomandaLista] = useState<Domanda | null>(null);

  const future = chiusure.filter((c) => c.al >= oggi);
  const passate = chiusure.filter((c) => c.al < oggi).reverse();

  const esito = (e: EsitoChiusura) => {
    if (e.ok) setMessaggio(e.messaggio);
    else setMessaggio(e.errore);
    return e.ok;
  };

  // Riaccendere: prima i conflitti, come per una chiusura nuova.
  const interruttore = (c: Chiusura) => {
    setMessaggio("");
    avvia(async () => {
      if (c.attiva) {
        esito(await sicura(() => cambiaAttiva(c.id, false), SENZA_RETE));
        return;
      }
      const v = await sicura(() => verificaChiusura({ id: c.id, dal: c.dal, al: c.al, motivo: c.motivo }), SENZA_RETE);
      if (!v.ok) return void setMessaggio(v.errore);
      if (v.conflitti.length) {
        setDomandaLista({ tipo: "conflitti", dati: c, conflitti: v.conflitti, poi: { attiva: c.id } });
        return;
      }
      esito(await sicura(() => cambiaAttiva(c.id, true), SENZA_RETE));
    });
  };

  const elimina = (id: string) => {
    setMessaggio("");
    avvia(async () => {
      if (esito(await sicura(() => eliminaChiusuraAzione(id), SENZA_RETE))) setDaEliminare(null);
    });
  };

  return (
    <div>
      <header className="border-b border-ink pb-5">
        <p className="eyebrow text-steel">Agenda</p>
        <h1 className="display mt-2 text-[clamp(1.75rem,calc(100cqi/9.6),3.25rem)] leading-none">Chiusure e ferie</h1>
        <p className="mt-3 max-w-[52ch] text-base text-steel">
          Nei giorni chiusi il sito non propone orari e i clienti vedono l&apos;avviso in home finché la chiusura non è
          finita.
        </p>
        <button type="button" onClick={() => (setMessaggio(""), setFoglio({}))} className={cn(bottonePieno, "mt-5 w-full flex-none sm:w-auto")}>
          + Aggiungi chiusura
        </button>
      </header>

      <div aria-live="polite">
        {messaggio && (
          <p role="status" className="mt-5 border border-ink px-4 py-3 text-base">
            {messaggio}
          </p>
        )}
      </div>

      {domandaLista?.tipo === "conflitti" && typeof domandaLista.poi !== "string" && (
        <RiquadroConflitti
          conflitti={domandaLista.conflitti}
          inCorso={inCorso}
          testoConferma="Riattiva comunque"
          onAnnulla={() => setDomandaLista(null)}
          onConferma={() =>
            avvia(async () => {
              const id = (domandaLista.poi as { attiva: string }).attiva;
              if (esito(await sicura(() => cambiaAttiva(id, true), SENZA_RETE))) setDomandaLista(null);
            })
          }
        />
      )}

      <section aria-labelledby="titolo-future" className="mt-8">
        <h2 id="titolo-future" className="eyebrow text-steel">
          In arrivo ({future.length})
        </h2>
        {future.length === 0 ? (
          <p className="mt-3 text-base text-steel">Nessuna chiusura in programma.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {future.map((c) => (
              <li key={c.id}>
                <SchedaChiusura
                  c={c}
                  oggi={oggi}
                  inCorso={inCorso}
                  confermaElimina={daEliminare === c.id}
                  onModifica={() => (setMessaggio(""), setFoglio({ chiusura: c }))}
                  onInterruttore={() => interruttore(c)}
                  onElimina={() => setDaEliminare(c.id)}
                  onEliminaSi={() => elimina(c.id)}
                  onEliminaNo={() => setDaEliminare(null)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {passate.length > 0 && (
        <details className="mt-8 border-t border-ink/15 pt-4">
          <summary className="eyebrow flex min-h-11 cursor-pointer items-center text-steel">Passate ({passate.length})</summary>
          <ul className="mt-3 space-y-3">
            {passate.map((c) => (
              <li key={c.id}>
                <SchedaChiusura
                  c={c}
                  oggi={oggi}
                  inCorso={inCorso}
                  passata
                  confermaElimina={daEliminare === c.id}
                  onModifica={() => {}}
                  onInterruttore={() => {}}
                  onElimina={() => setDaEliminare(c.id)}
                  onEliminaSi={() => elimina(c.id)}
                  onEliminaNo={() => setDaEliminare(null)}
                />
              </li>
            ))}
          </ul>
        </details>
      )}

      {foglio && (
        <FoglioChiusura
          key={foglio.chiusura?.id ?? "nuova"}
          chiusura={foglio.chiusura}
          oggi={oggi}
          onChiudi={() => setFoglio(null)}
          onSalvata={(m) => {
            setFoglio(null);
            setMessaggio(m);
          }}
        />
      )}
    </div>
  );
}

function SchedaChiusura({
  c,
  oggi,
  inCorso,
  passata = false,
  confermaElimina,
  onModifica,
  onInterruttore,
  onElimina,
  onEliminaSi,
  onEliminaNo,
}: {
  c: Chiusura;
  oggi: string;
  inCorso: boolean;
  passata?: boolean;
  confermaElimina: boolean;
  onModifica: () => void;
  onInterruttore: () => void;
  onElimina: () => void;
  onEliminaSi: () => void;
  onEliminaNo: () => void;
}) {
  const adesso = c.dal <= oggi && oggi <= c.al;
  return (
    <div className={cn("border p-4", c.attiva && !passata ? "border-ink" : "border-ink/30 text-steel")}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-xl font-extrabold tabular-nums tracking-[-0.02em]">{periodo(c)}</p>
          <p className="info mt-1 text-steel">
            {giorni(c) === 1 ? "1 giorno" : `${giorni(c)} giorni`}
            {adesso && c.attiva && " · in corso"}
            {passata && " · finita"}
          </p>
          {c.motivo && <p className="mt-2 text-base">{c.motivo}</p>}
        </div>
        {!passata && (
          // Interruttore: spenta resta in elenco ma i giorni tornano prenotabili.
          <button
            type="button"
            role="switch"
            aria-checked={c.attiva}
            onClick={onInterruttore}
            disabled={inCorso}
            className="flex min-h-11 cursor-pointer items-center gap-3 disabled:opacity-50"
          >
            <span className="info">{c.attiva ? "Attiva" : "Spenta"}</span>
            <span aria-hidden className={cn("relative h-6 w-11 border border-ink transition-colors", c.attiva ? "bg-ink" : "bg-paper")}>
              <span className={cn("absolute top-0.5 size-[1.125rem] transition-[left] duration-150", c.attiva ? "left-[1.375rem] bg-paper" : "left-0.5 bg-ink")} />
            </span>
          </button>
        )}
      </div>

      {confermaElimina ? (
        <div className="mt-4 border-t border-ink/15 pt-4">
          <p className="text-base">Eliminare la chiusura {periodo(c)}? Non si può annullare.</p>
          <div className="mt-3 flex gap-3">
            <button type="button" onClick={onEliminaNo} disabled={inCorso} className={bottoneVuoto}>
              No
            </button>
            <button type="button" onClick={onEliminaSi} disabled={inCorso} className={bottonePieno}>
              {inCorso && <Rotella />} Sì, elimina
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex gap-3">
          {!passata && (
            <button type="button" onClick={onModifica} className={bottoneVuoto}>
              Modifica
            </button>
          )}
          <button type="button" onClick={onElimina} className={cn(bottoneVuoto, "border-ink/30 text-steel hover:border-ink")}>
            Elimina
          </button>
        </div>
      )}
    </div>
  );
}

function FoglioChiusura({
  chiusura,
  oggi,
  onChiudi,
  onSalvata,
}: {
  chiusura?: Chiusura;
  oggi: string;
  onChiudi: () => void;
  onSalvata: (messaggio: string) => void;
}) {
  const [dal, setDal] = useState(chiusura?.dal ?? oggi);
  const [al, setAl] = useState(chiusura?.al ?? chiusura?.dal ?? oggi);
  const [unGiorno, setUnGiorno] = useState(chiusura ? chiusura.dal === chiusura.al : false);
  const [motivo, setMotivo] = useState(chiusura?.motivo ?? "");
  // Motivo scritto a mano: la tendina sta su "Altro…" e sotto c'è il campo.
  const [altro, setAltro] = useState(Boolean(chiusura?.motivo) && !MOTIVI.includes(chiusura?.motivo ?? ""));
  const campoAltro = useRef<HTMLInputElement>(null);
  const [campi, setCampi] = useState<ErroriChiusura>({});
  const [errore, setErrore] = useState("");
  const [domanda, setDomanda] = useState<Domanda | null>(null);
  const [inCorso, avvia] = useTransition();

  const dati: DatiChiusura = { ...(chiusura ? { id: chiusura.id } : {}), dal, al: unGiorno ? dal : al, motivo };
  // Subito, senza aspettare il server: la fine prima dell'inizio.
  const fineSbagliata = !unGiorno && al && dal && al < dal;

  const scegliMotivo = (valore: string) => {
    if (valore !== VALORE_ALTRO) {
      setAltro(false);
      setMotivo(valore);
      return;
    }
    // flushSync: il campo deve già esistere per ricevere il focus. Il focus
    // sta qui e non in autoFocus: aprendo una chiusura esistente, o tornando
    // da una domanda, la tastiera non deve aprirsi da sola.
    flushSync(() => {
      setAltro(true);
      setMotivo("");
    });
    campoAltro.current?.focus();
  };

  const salva = (opzioni: { unisci?: boolean; forza?: boolean } = {}) => {
    setErrore("");
    avvia(async () => {
      if (!opzioni.forza) {
        const v = await sicura(() => verificaChiusura(dati), SENZA_RETE);
        if (!v.ok) {
          setCampi(v.campi ?? {});
          setErrore(v.errore);
          return;
        }
        setCampi({});
        if (v.sovrapposte.length && !opzioni.unisci) return setDomanda({ tipo: "sovrapposte", dati, sovrapposte: v.sovrapposte });
        if (v.conflitti.length) return setDomanda({ tipo: "conflitti", dati, conflitti: v.conflitti, poi: "salva" });
      }
      const e = await sicura(() => salvaChiusura(dati, { unisci: opzioni.unisci }), SENZA_RETE);
      if (e.ok) return onSalvata(e.messaggio);
      setCampi(e.campi ?? {});
      setErrore(e.errore);
      if (e.sovrapposte?.length) setDomanda({ tipo: "sovrapposte", dati, sovrapposte: e.sovrapposte });
    });
  };

  return (
    <FoglioInBasso
      aperto
      onChiudi={onChiudi}
      sopratitolo="Chiusure e ferie"
      titolo={chiusura ? "Modifica chiusura" : "Nuova chiusura"}
      piede={
        domanda ? null : (
          <div className="flex gap-3">
            <button type="button" onClick={onChiudi} disabled={inCorso} className={bottoneVuoto}>
              Annulla
            </button>
            <button type="button" onClick={() => salva()} disabled={inCorso || Boolean(fineSbagliata)} aria-busy={inCorso} className={bottonePieno}>
              {inCorso && <Rotella />}
              {inCorso ? "Controllo…" : "Salva"}
            </button>
          </div>
        )
      }
    >
      {domanda?.tipo === "sovrapposte" ? (
        <div>
          <p className="text-base">Si sovrappone (o si tocca) con:</p>
          <ul className="mt-2 space-y-1">
            {domanda.sovrapposte.map((s) => (
              <li key={s.id} className="info">
                {periodo(s)}
                {s.motivo && ` · ${s.motivo}`}
                {!s.attiva && " · spenta"}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-base">Le unisco in una sola chiusura, dal primo all&apos;ultimo giorno?</p>
          <div className="mt-4 flex gap-3">
            <button type="button" onClick={() => setDomanda(null)} disabled={inCorso} className={bottoneVuoto}>
              Annulla
            </button>
            <button type="button" onClick={() => (setDomanda(null), salva({ unisci: true }))} disabled={inCorso} className={bottonePieno}>
              {inCorso && <Rotella />} Unisci
            </button>
          </div>
        </div>
      ) : domanda?.tipo === "conflitti" ? (
        <RiquadroConflitti
          conflitti={domanda.conflitti}
          inCorso={inCorso}
          testoConferma="Salva comunque"
          onAnnulla={() => setDomanda(null)}
          onConferma={() => salva({ forza: true, unisci: true })}
        />
      ) : (
        <div className="space-y-5">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-base">
            <input type="checkbox" checked={unGiorno} onChange={(e) => setUnGiorno(e.target.checked)} className="size-5 shrink-0 cursor-pointer accent-ink" />
            Un giorno solo
          </label>
          <div className={cn("grid gap-4", !unGiorno && "sm:grid-cols-2")}>
            <label className="block">
              <span className="eyebrow text-steel">{unGiorno ? "Giorno" : "Dal"}</span>
              <input
                type="date"
                value={dal}
                min={oggi}
                onChange={(e) => {
                  setDal(e.target.value);
                  if (al < e.target.value) setAl(e.target.value);
                }}
                aria-invalid={Boolean(campi.dal) || undefined}
                className={campo}
                required
              />
              {campi.dal && <span className="info mt-1 block">{campi.dal}</span>}
            </label>
            {!unGiorno && (
              <label className="block">
                <span className="eyebrow text-steel">Al (incluso)</span>
                <input
                  type="date"
                  value={al}
                  min={dal || oggi}
                  onChange={(e) => setAl(e.target.value)}
                  aria-invalid={Boolean(campi.al || fineSbagliata) || undefined}
                  className={campo}
                  required
                />
                {(campi.al || fineSbagliata) && (
                  <span className="info mt-1 block">{campi.al ?? "La data di fine viene prima della data di inizio"}</span>
                )}
              </label>
            )}
          </div>
          <label className="block">
            <span className="eyebrow text-steel">Motivo (facoltativo, lo vedono i clienti)</span>
            <Tendina value={altro ? VALORE_ALTRO : motivo} onChange={(e) => scegliMotivo(e.target.value)}>
              <option value="">Nessun motivo</option>
              {MOTIVI.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
              <option value={VALORE_ALTRO}>Altro…</option>
            </Tendina>
          </label>
          {altro && (
            <label className="block">
              <span className="eyebrow text-steel">Motivo personalizzato</span>
              <input
                ref={campoAltro}
                type="text"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                maxLength={80}
                placeholder="Scrivi il motivo"
                className={campo}
              />
            </label>
          )}
          <div aria-live="polite">
            {errore && (
              <p role="alert" className="border border-ink bg-ink px-4 py-3 text-sm text-paper">
                {errore}
              </p>
            )}
          </div>
        </div>
      )}
    </FoglioInBasso>
  );
}

/** Appuntamenti che cadono nella chiusura: Francesco decide. */
function RiquadroConflitti({
  conflitti,
  inCorso,
  testoConferma,
  onAnnulla,
  onConferma,
}: {
  conflitti: Conflitto[];
  inCorso: boolean;
  testoConferma: string;
  onAnnulla: () => void;
  onConferma: () => void;
}) {
  return (
    <div role="alert" className="mt-5 border-2 border-ink p-4">
      <p className="text-base font-bold">
        {conflitti.length === 1 ? "C'è 1 appuntamento" : `Ci sono ${conflitti.length} appuntamenti`} in quei giorni.
      </p>
      <p className="mt-1 text-sm text-steel">Nessuno viene disdetto o spostato da solo: restano in agenda segnati &ldquo;da gestire&rdquo;.</p>
      <ul className="mt-3 divide-y divide-ink/15 border-y border-ink/15">
        {conflitti.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
            <span className="min-w-0">
              <span className="info block tabular-nums text-steel">
                {dataBreve(c.data)} · {c.ora}
              </span>
              <span className="block text-base font-bold">{c.cliente}</span>
              <span className="block text-sm text-steel">{c.servizio}</span>
            </span>
            <span className="flex gap-2">
              {c.telefono && (
                <a href={`tel:${c.telefono}`} className="info inline-flex min-h-11 items-center border border-ink px-3 hover:bg-ink hover:text-paper">
                  Chiama
                </a>
              )}
              {c.whatsapp && (
                <a href={c.whatsapp} target="_blank" rel="noopener noreferrer" className="info inline-flex min-h-11 items-center border border-ink px-3 hover:bg-ink hover:text-paper">
                  WhatsApp
                </a>
              )}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <button type="button" onClick={onConferma} disabled={inCorso} className={bottonePieno}>
          {inCorso && <Rotella />} {testoConferma}
        </button>
        <button type="button" onClick={onAnnulla} disabled={inCorso} className={bottoneVuoto}>
          Annulla
        </button>
        <Link href={`/admin?data=${conflitti[0].data}`} prefetch={false} className={bottoneVuoto}>
          Vai agli appuntamenti
        </Link>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState, useTransition, type ComponentProps, type FormEvent, type ReactNode } from "react";
import { elimina, salvaAppuntamento, salvaBlocco } from "@/app/admin/azioni";
import { formatoOra } from "@/lib/orari";
import {
  DURATE,
  durataLeggibile,
  etichettaVoce,
  orariDiInizio,
  primaSovrapposta,
  SERVIZIO_LIBERO,
  turnoDi,
} from "@/lib/prenotazioni/agenda";
import { telefonoLeggibile } from "@/lib/prenotazioni/telefono";
import type { EsitoAzione, VoceAgenda } from "@/lib/prenotazioni/tipi";
import { listino } from "@/lib/salone";
import { cn, formatoPrezzo } from "@/lib/utils";
import { FoglioInBasso, Rotella } from "./FoglioInBasso";
import { bottonePieno, bottoneVuoto, campo } from "./stili";

/* Il foglio di una riga dell'agenda. Tre facce:
   - "modulo" per una riga libera: nuovo appuntamento o blocco;
   - "dettaglio" per una riga occupata: chi, cosa, quanto, con Modifica e
     Annulla;
   - "modulo" di nuovo, precompilato, quando si tocca Modifica.

   Ogni scrittura passa da una Server Action dentro una transizione: finché
   è in volo il bottone gira e resta spento, e il foglio non si chiude, così
   su una rete lenta un doppio tocco non crea due appuntamenti. */

export type Bersaglio = { tipo: "nuovo"; inizio: number } | { tipo: "voce"; voce: VoceAgenda };

const servizi = listino.flatMap((g) =>
  g.servizi.filter((s) => s.prenotabile !== false).map((s) => ({ ...s, categoria: g.titolo })),
);

const dataLunga = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
export const etichettaGiorno = (data: string) => dataLunga.format(new Date(`${data}T12:00:00Z`));

// Una Server Action può fallire per rete assente: senza questo l'errore
// risalirebbe fino alla pagina d'errore invece di restare nel foglio.
async function sicura(azione: () => Promise<EsitoAzione>): Promise<EsitoAzione> {
  try {
    return await azione();
  } catch {
    return { ok: false, errore: "Connessione assente o lenta: non è stato salvato niente. Riprova." };
  }
}

export function FoglioVoce({
  data,
  voci,
  bersaglio,
  onChiudi,
}: {
  data: string;
  voci: VoceAgenda[];
  bersaglio: Bersaglio;
  onChiudi: () => void;
}) {
  const [faccia, setFaccia] = useState<"modulo" | "dettaglio">(bersaglio.tipo === "nuovo" ? "modulo" : "dettaglio");
  const [inVolo, avvia] = useTransition();
  const voce = bersaglio.tipo === "voce" ? bersaglio.voce : undefined;
  const idModulo = "modulo-voce";

  if (faccia === "dettaglio" && voce) {
    return (
      <Dettaglio
        voce={voce}
        data={data}
        inVolo={inVolo}
        avvia={avvia}
        onModifica={() => setFaccia("modulo")}
        onChiudi={onChiudi}
      />
    );
  }

  return (
    <Modulo
      idModulo={idModulo}
      data={data}
      voci={voci}
      voce={voce}
      inizioProposto={bersaglio.tipo === "nuovo" ? bersaglio.inizio : bersaglio.voce.inizio}
      inVolo={inVolo}
      avvia={avvia}
      onIndietro={voce ? () => setFaccia("dettaglio") : undefined}
      onChiudi={onChiudi}
    />
  );
}

/* ── Dettaglio ──────────────────────────────────────────────────────────── */

function Dettaglio({
  voce,
  data,
  inVolo,
  avvia,
  onModifica,
  onChiudi,
}: {
  voce: VoceAgenda;
  data: string;
  inVolo: boolean;
  avvia: (azione: () => Promise<void>) => void;
  onModifica: () => void;
  onChiudi: () => void;
}) {
  const [conferma, setConferma] = useState(false);
  const [errore, setErrore] = useState("");
  const appuntamento = voce.tipo === "appuntamento" ? voce : null;
  const quando = `${formatoOra(voce.inizio)}–${formatoOra(voce.fine)} · ${durataLeggibile(voce.fine - voce.inizio)}`;

  const cancella = () =>
    avvia(async () => {
      setErrore("");
      const esito = await sicura(() => elimina(voce.id));
      if (esito.ok) onChiudi();
      else setErrore(esito.errore);
    });

  const piede = conferma ? (
    <div>
      <p className="mb-3 text-base">
        {appuntamento ? (
          <>
            Disdire l&apos;appuntamento di <b>{appuntamento.cliente.nome}</b> alle {formatoOra(voce.inizio)}?
            L&apos;orario torna prenotabile dal sito.
          </>
        ) : (
          <>Togliere il blocco? L&apos;orario torna prenotabile dal sito.</>
        )}
      </p>
      <div className="flex gap-3">
        <button type="button" onClick={() => setConferma(false)} disabled={inVolo} className={bottoneVuoto}>
          No
        </button>
        <button type="button" onClick={cancella} disabled={inVolo} className={bottonePieno} aria-busy={inVolo}>
          {inVolo && <Rotella />}
          {inVolo ? "Un attimo…" : appuntamento ? "Sì, disdici" : "Sì, sblocca"}
        </button>
      </div>
    </div>
  ) : (
    <div className="flex gap-3">
      <button type="button" onClick={() => setConferma(true)} className={bottoneVuoto}>
        {appuntamento ? "Disdici" : "Sblocca"}
      </button>
      <button type="button" onClick={onModifica} className={bottonePieno}>
        Modifica
      </button>
    </div>
  );

  return (
    <FoglioInBasso
      aperto
      onChiudi={onChiudi}
      bloccato={inVolo}
      sopratitolo={`${etichettaGiorno(data)} · ${quando}`}
      titolo={voce.tipo === "blocco" ? (voce.motivo ?? "Orario bloccato") : voce.cliente.nome}
      piede={piede}
    >
      {errore && <Avviso>{errore}</Avviso>}
      {appuntamento ? (
        <dl className="divide-y divide-ink/10">
          <RigaDettaglio etichetta="Servizio">{appuntamento.servizioNome}</RigaDettaglio>
          <RigaDettaglio etichetta="Prezzo">{formatoPrezzo(appuntamento.prezzo)}</RigaDettaglio>
          <RigaDettaglio etichetta="Telefono">
            {appuntamento.cliente.telefono ? (
              <a
                href={`tel:${appuntamento.cliente.telefono}`}
                className="inline-flex min-h-11 items-center underline underline-offset-4"
              >
                {telefonoLeggibile(appuntamento.cliente.telefono)}
              </a>
            ) : (
              <span className="text-steel">Non lasciato</span>
            )}
          </RigaDettaglio>
          {appuntamento.cliente.note && <RigaDettaglio etichetta="Nota">“{appuntamento.cliente.note}”</RigaDettaglio>}
          <RigaDettaglio etichetta="Arrivato da">
            {!appuntamento.origine || appuntamento.origine === "agenda"
              ? "Inserito in agenda"
              : `Sito · bottone “${appuntamento.origine}”`}
          </RigaDettaglio>
        </dl>
      ) : (
        <p className="max-w-[46ch] text-base text-steel">
          In questa fascia il sito non propone orari ai clienti. Il blocco non conta nella percentuale
          della poltrona.
        </p>
      )}
      {appuntamento && (
        // Al lookbook del cliente: la pagina cerca la scheda per telefono e,
        // se non c'è, propone di crearla con nome e telefono di questo
        // appuntamento. Nell'indirizzo c'è solo l'id, mai nome o numero.
        <Link href={`/admin/lookbook?da=${voce.id}`} className={`${bottoneVuoto} mt-5 w-full`}>
          <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 7h4l2-3h6l2 3h4v13H3z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          Lookbook del cliente
        </Link>
      )}
    </FoglioInBasso>
  );
}

function RigaDettaglio({ etichetta, children }: { etichetta: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] items-baseline gap-3 py-3">
      <dt className="info text-steel">{etichetta}</dt>
      <dd className="text-base">{children}</dd>
    </div>
  );
}

// Menu a tendina con la sua freccia: appearance-none la toglie a tutti i
// browser (e su iOS il menu nativo resta quello di sistema, comodo col pollice).
function Tendina({ children, ...props }: ComponentProps<"select">) {
  return (
    <span className="relative block">
      <select {...props} className={cn(campo, "pr-10")}>
        {children}
      </select>
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className="pointer-events-none absolute right-3 top-[calc(50%+0.25rem)] size-4 -translate-y-1/2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </span>
  );
}

function Avviso({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="info mb-5 border border-ink bg-ink px-4 py-3 text-paper">
      {children}
    </p>
  );
}

/* ── Modulo ─────────────────────────────────────────────────────────────── */

function Modulo({
  idModulo,
  data,
  voci,
  voce,
  inizioProposto,
  inVolo,
  avvia,
  onIndietro,
  onChiudi,
}: {
  idModulo: string;
  data: string;
  voci: VoceAgenda[];
  voce?: VoceAgenda;
  inizioProposto: number;
  inVolo: boolean;
  avvia: (azione: () => Promise<void>) => void;
  onIndietro?: () => void;
  onChiudi: () => void;
}) {
  const appuntamento = voce?.tipo === "appuntamento" ? voce : undefined;
  const nelListino = appuntamento ? servizi.some((s) => s.id === appuntamento.servizioId) : true;

  const [tipo, setTipo] = useState<"appuntamento" | "blocco">(voce?.tipo ?? "appuntamento");
  const [inizio, setInizio] = useState(inizioProposto);
  const [servizioId, setServizioId] = useState(
    appuntamento ? (nelListino ? appuntamento.servizioId : SERVIZIO_LIBERO) : servizi[0].id,
  );
  const [servizioNome, setServizioNome] = useState(appuntamento && !nelListino ? appuntamento.servizioNome : "");
  const [durata, setDurata] = useState(voce ? voce.fine - voce.inizio : servizi[0].durata);
  const [prezzo, setPrezzo] = useState(String(appuntamento ? appuntamento.prezzo : servizi[0].prezzo));
  const [nome, setNome] = useState(appuntamento?.cliente.nome ?? "");
  const [telefono, setTelefono] = useState(
    appuntamento?.cliente.telefono ? telefonoLeggibile(appuntamento.cliente.telefono) : "",
  );
  const [motivo, setMotivo] = useState(voce?.tipo === "blocco" ? (voce.motivo ?? "") : "");
  const [errore, setErrore] = useState("");
  const [errori, setErrori] = useState<Record<string, string>>({});

  const turno = turnoDi(data, inizio);
  const fine = inizio + durata;
  const scontro = primaSovrapposta(voci, { inizio, fine }, voce?.id);

  const orariProposti = [...new Set([...orariDiInizio(data), inizio])].sort((a, b) => a - b);
  // Le durate del menu, più quella attuale se è fuori elenco, più "fino alla
  // chiusura del turno": per bloccare un pomeriggio basta un tocco.
  const finoAChiusura = turno ? turno.chiude - inizio : 0;
  const durateProposte = [...new Set([...DURATE, durata, ...(finoAChiusura > 0 ? [finoAChiusura] : [])])].sort(
    (a, b) => a - b,
  );

  const scegliServizio = (id: string) => {
    setServizioId(id);
    const s = servizi.find((x) => x.id === id);
    // Il listino propone durata e prezzo; Francesco li può ancora cambiare.
    if (s) {
      setDurata(s.durata);
      setPrezzo(String(s.prezzo));
    }
  };

  const invia = (e: FormEvent) => {
    e.preventDefault();
    if (inVolo || scontro) return;
    avvia(async () => {
      setErrore("");
      setErrori({});
      const ora = formatoOra(inizio);
      const esito = await sicura(() =>
        tipo === "appuntamento"
          ? salvaAppuntamento(
              {
                data,
                ora,
                durata,
                servizioId,
                servizioNome: servizioId === SERVIZIO_LIBERO ? servizioNome : undefined,
                prezzo: prezzo.trim() === "" ? Number.NaN : Number(prezzo),
                nome,
                telefono,
              },
              voce?.id,
            )
          : salvaBlocco({ data, ora, durata, motivo }, voce?.id),
      );
      if (esito.ok) onChiudi();
      else {
        setErrore(esito.errore);
        setErrori(esito.campi ?? {});
      }
    });
  };

  const errato = (chiave: string) => (errori[chiave] ? { "aria-invalid": true as const } : {});
  const messaggio = (chiave: string) =>
    errori[chiave] ? <span className="info mt-2 block text-ink">{errori[chiave]}</span> : null;

  const titolo = voce
    ? voce.tipo === "appuntamento"
      ? "Modifica appuntamento"
      : "Modifica blocco"
    : tipo === "appuntamento"
      ? "Nuovo appuntamento"
      : "Blocca orario";

  const piede = (
    <div className="flex gap-3">
      {onIndietro && (
        <button type="button" onClick={onIndietro} disabled={inVolo} className={bottoneVuoto}>
          Indietro
        </button>
      )}
      <button
        type="submit"
        form={idModulo}
        disabled={inVolo || Boolean(scontro)}
        aria-busy={inVolo}
        className={bottonePieno}
      >
        {inVolo && <Rotella />}
        {inVolo ? "Salvataggio…" : voce ? "Salva" : tipo === "appuntamento" ? "Salva appuntamento" : "Blocca orario"}
      </button>
    </div>
  );

  return (
    <FoglioInBasso
      aperto
      onChiudi={onChiudi}
      bloccato={inVolo}
      sopratitolo={etichettaGiorno(data)}
      titolo={titolo}
      piede={piede}
    >
      <form id={idModulo} onSubmit={invia} noValidate>
        {/* disabled sul fieldset: durante il salvataggio non si tocca niente. */}
        <fieldset disabled={inVolo} className="space-y-5">
          {errore && <Avviso>{errore}</Avviso>}

          {!voce && (
            <div role="radiogroup" aria-label="Cosa inserire" className="grid grid-cols-2 border border-ink">
              {(["appuntamento", "blocco"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={tipo === t}
                  onClick={() => setTipo(t)}
                  className={cn(
                    "eyebrow min-h-12 cursor-pointer transition-colors duration-150",
                    tipo === t ? "bg-ink text-paper" : "hover:bg-fog",
                  )}
                >
                  {t === "appuntamento" ? "Appuntamento" : "Pausa / blocco"}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-[2fr_3fr] gap-3">
            <label className="block">
              <span className="info text-steel">Inizio</span>
              <Tendina
                value={inizio}
                onChange={(e) => setInizio(Number(e.target.value))}
                                {...errato("ora")}
              >
                {orariProposti.map((m) => (
                  <option key={m} value={m}>
                    {formatoOra(m)}
                  </option>
                ))}
              </Tendina>
              {messaggio("ora")}
            </label>
            <label className="block">
              <span className="info text-steel">Durata</span>
              <Tendina
                value={durata}
                onChange={(e) => setDurata(Number(e.target.value))}
                                {...errato("durata")}
              >
                {durateProposte.map((d) => (
                  <option key={d} value={d}>
                    {durataLeggibile(d)} → {formatoOra(inizio + d)}
                  </option>
                ))}
              </Tendina>
              {messaggio("durata")}
            </label>
          </div>

          {/* Riepilogo vivo: l'orario, gli slot che copre, i conflitti. */}
          <p
            aria-live="polite"
            className={cn("info border px-4 py-3", scontro ? "border-ink bg-ink text-paper" : "border-ink/20 text-steel")}
          >
            {formatoOra(inizio)} → {formatoOra(fine)} · {durataLeggibile(durata)}
            {durata > 30 && !scontro && ` · occupa ${Math.ceil(durata / 30)} mezz'ore`}
            {scontro && <> · si sovrappone a {etichettaVoce(scontro)}</>}
            {!scontro && turno && fine > turno.chiude && <> · sfora la chiusura delle {formatoOra(turno.chiude)}</>}
          </p>

          {tipo === "appuntamento" ? (
            <>
              <label className="block">
                <span className="info text-steel">Cliente</span>
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  autoComplete="off"
                  autoCapitalize="words"
                  enterKeyHint="next"
                  placeholder="Nome e cognome"
                  className={campo}
                  {...errato("nome")}
                />
                {messaggio("nome")}
              </label>

              <label className="block">
                <span className="info text-steel">Servizio</span>
                <Tendina
                  value={servizioId}
                  onChange={(e) => scegliServizio(e.target.value)}
                                    {...errato("servizioId")}
                >
                  {listino.map((g) => (
                    <optgroup key={g.id} label={g.titolo}>
                      {servizi
                        .filter((s) => s.categoria === g.titolo)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.nome} · {s.prezzo} € · {durataLeggibile(s.durata)}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                  <option value={SERVIZIO_LIBERO}>Altro, fuori listino…</option>
                </Tendina>
                {messaggio("servizioId")}
              </label>

              {servizioId === SERVIZIO_LIBERO && (
                <label className="block">
                  <span className="info text-steel">Che servizio</span>
                  <input
                    value={servizioNome}
                    onChange={(e) => setServizioNome(e.target.value)}
                    placeholder="Es. Colore barba"
                    className={campo}
                    {...errato("servizioNome")}
                  />
                  {messaggio("servizioNome")}
                </label>
              )}

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="info text-steel">Prezzo €</span>
                  <input
                    value={prezzo}
                    onChange={(e) => setPrezzo(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className={cn(campo, "tabular-nums")}
                    {...errato("prezzo")}
                  />
                  {messaggio("prezzo")}
                </label>
                <label className="block">
                  <span className="info text-steel">Telefono · facolt.</span>
                  <input
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    type="tel"
                    inputMode="tel"
                    autoComplete="off"
                    placeholder="347 123 4567"
                    className={campo}
                    {...errato("telefono")}
                  />
                  {messaggio("telefono")}
                </label>
              </div>
            </>
          ) : (
            <div>
              <label className="block">
                <span className="info text-steel">Motivo · facoltativo</span>
                <input
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Pausa"
                  className={campo}
                  {...errato("motivo")}
                />
                {messaggio("motivo")}
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                {["Pausa", "Commissione", "Assente"].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMotivo(m)}
                    aria-pressed={motivo === m}
                    className={cn(
                      "info min-h-11 cursor-pointer border px-4 transition-colors duration-150",
                      motivo === m ? "border-ink bg-ink text-paper" : "border-ink/30 hover:border-ink",
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}
        </fieldset>
      </form>
    </FoglioInBasso>
  );
}

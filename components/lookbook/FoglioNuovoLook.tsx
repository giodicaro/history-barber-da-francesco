"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { FoglioInBasso, Rotella } from "@/components/agenda/FoglioInBasso";
import { bottonePieno, campo } from "@/components/agenda/stili";
import { oraDiRoma } from "@/lib/orari";
import { cancellaBozza, salvaBozza, type Bozza } from "@/lib/lookbook/bozze";
import { nuovoId } from "@/lib/lookbook/browser";
import { comprimi, FotoNonUsabile, type FotoCompressa } from "@/lib/lookbook/immagine";
import { alternaPreset, PRESET, presetAttivo } from "@/lib/lookbook/preset";
import { CAMPI_NOTE, NOMI_CAMPO, POSIZIONI, type CampoNota, type Look, type Posizione } from "@/lib/lookbook/tipi";
import { maxCampo } from "@/lib/lookbook/validazione";
import { cn } from "@/lib/utils";
import { Fotocamera, type Scatto } from "./Fotocamera";
import { dataLook, Stella } from "./Pezzi";

/* Il foglio "Nuovo look": tre foto, le note con le scorciatoie, la stella.

   Salvataggio: prima tutto finisce in una bozza sul telefono (IndexedDB),
   poi parte POST /api/lookbook. Se la rete manca la bozza resta, e il foglio
   lo dice con un "Riprova"; a invio riuscito la bozza si cancella. Chiudere
   il foglio a metà non butta via le foto: restano in bozza, e la scheda
   propone di riprenderle. */

type Note = Record<CampoNota, string>;
const NOTE_VUOTE: Note = { sfumatura: "", sopra: "", barba: "", prodotto: "", note: "" };

type Fase = { tipo: "modifica" } | { tipo: "senza-rete" } | { tipo: "errore"; messaggio: string; campi?: Record<string, string> };

const daBozza = (b?: Bozza | null) => {
  const foto: Partial<Record<Posizione, FotoCompressa>> = {};
  for (const f of b?.foto ?? []) foto[f.posizione] = { foto: f.foto, miniatura: f.miniatura, tipo: f.tipo };
  return foto;
};

export function FoglioNuovoLook({
  clienteId,
  nome,
  ultimo,
  bozza,
  onChiudi,
  onSalvato,
}: {
  clienteId: string;
  nome: string;
  /** L'ultimo look, per "Copia dall'ultimo look". */
  ultimo?: Look;
  /** Bozza da riprendere, se c'è. */
  bozza?: Bozza | null;
  /** Chiuso senza salvare; con la bozza, se dentro c'era qualcosa. */
  onChiudi: (bozza: Bozza | null) => void;
  onSalvato: () => void;
}) {
  const [id] = useState(() => bozza?.id ?? nuovoId());
  const [data] = useState(() => bozza?.data ?? oraDiRoma().data);
  const [foto, setFoto] = useState(() => daBozza(bozza));
  const [anteprime, setAnteprime] = useState<Partial<Record<Posizione, string>>>(() =>
    Object.fromEntries(Object.entries(daBozza(bozza)).map(([p, f]) => [p, URL.createObjectURL(f.miniatura)])),
  );
  const [inLavoro, setInLavoro] = useState<Partial<Record<Posizione, boolean>>>({});
  const [erroriFoto, setErroriFoto] = useState<Partial<Record<Posizione, string>>>({});
  const [note, setNote] = useState<Note>(() => ({ ...NOTE_VUOTE, ...bozza?.note }));
  const [preferito, setPreferito] = useState(bozza?.preferito ?? false);
  const [fase, setFase] = useState<Fase>(bozza ? { tipo: "senza-rete" } : { tipo: "modifica" });
  const [inVolo, avvia] = useTransition();

  // Le anteprime sono URL blob: si liberano quando il foglio si chiude.
  const daLiberare = useRef(anteprime);
  useEffect(() => {
    daLiberare.current = anteprime;
  }, [anteprime]);
  useEffect(() => () => Object.values(daLiberare.current).forEach((u) => u && URL.revokeObjectURL(u)), []);

  const scatti = Object.fromEntries(
    POSIZIONI.map((p): [Posizione, Scatto] => [
      p,
      inLavoro[p]
        ? { stato: "lavoro" }
        : anteprime[p]
          ? { stato: "pronta", anteprima: anteprime[p] }
          : erroriFoto[p]
            ? { stato: "errore", messaggio: erroriFoto[p] }
            : { stato: "vuoto" },
    ]),
  ) as Record<Posizione, Scatto>;

  const pronte = POSIZIONI.filter((p) => foto[p]);
  const comprimendo = POSIZIONI.some((p) => inLavoro[p]);

  const togliAnteprima = (p: Posizione) => {
    const u = anteprime[p];
    if (u) URL.revokeObjectURL(u);
    setAnteprime((a) => ({ ...a, [p]: undefined }));
  };

  const aggiungi = (p: Posizione, file: Blob) => {
    togliAnteprima(p);
    setFoto((f) => ({ ...f, [p]: undefined }));
    setErroriFoto((e) => ({ ...e, [p]: undefined }));
    setInLavoro((l) => ({ ...l, [p]: true }));
    comprimi(file)
      .then((c) => {
        setFoto((f) => ({ ...f, [p]: c }));
        setAnteprime((a) => ({ ...a, [p]: URL.createObjectURL(c.miniatura) }));
      })
      .catch((e) => {
        setErroriFoto((x) => ({ ...x, [p]: e instanceof FotoNonUsabile ? e.message : new FotoNonUsabile().message }));
      })
      .finally(() => setInLavoro((l) => ({ ...l, [p]: false })));
  };

  const togli = (p: Posizione) => {
    togliAnteprima(p);
    setFoto((f) => ({ ...f, [p]: undefined }));
  };

  const bozzaAttuale = (): Bozza => ({
    id,
    clienteId,
    data,
    note: Object.fromEntries(CAMPI_NOTE.filter((c) => note[c].trim()).map((c) => [c, note[c].trim()])),
    preferito,
    foto: pronte.map((p) => ({ posizione: p, tipo: foto[p]!.tipo, foto: foto[p]!.foto, miniatura: foto[p]!.miniatura })),
    salvataIl: Date.now(),
  });

  const chiudi = () => {
    if (inVolo) return;
    // Foto o note già fatte non si perdono per un tocco sullo sfondo.
    const b = bozzaAttuale();
    if (b.foto.length > 0 || Object.keys(b.note).length > 0) {
      void salvaBozza(b).then(() => onChiudi(b));
    } else {
      onChiudi(null);
    }
  };

  const invia = (e: FormEvent) => {
    e.preventDefault();
    if (inVolo || comprimendo || pronte.length === 0) return;
    avvia(async () => {
      const b = bozzaAttuale();
      await salvaBozza(b);
      if (!navigator.onLine) {
        setFase({ tipo: "senza-rete" });
        return;
      }

      const modulo = new FormData();
      modulo.set("id", b.id);
      modulo.set("clienteId", clienteId);
      modulo.set("data", b.data);
      modulo.set("preferito", b.preferito ? "1" : "0");
      for (const [campoNota, valore] of Object.entries(b.note)) modulo.set(campoNota, valore);
      for (const f of b.foto) {
        const estensione = f.tipo === "image/webp" ? "webp" : "jpg";
        modulo.set(`foto-${f.posizione}`, f.foto, `${f.posizione}.${estensione}`);
        modulo.set(`mini-${f.posizione}`, f.miniatura, `${f.posizione}-mini.${estensione}`);
      }

      let risposta: Response;
      try {
        risposta = await fetch("/api/lookbook", { method: "POST", body: modulo });
      } catch {
        setFase({ tipo: "senza-rete" });
        return;
      }
      const corpo = (await risposta.json().catch(() => null)) as { ok?: boolean; errore?: string; campi?: Record<string, string> } | null;
      if (risposta.ok && corpo?.ok) {
        await cancellaBozza(clienteId);
        onSalvato();
        return;
      }
      setFase({
        tipo: "errore",
        messaggio: corpo?.errore ?? "Salvataggio non riuscito. Il look resta sul telefono: riprova.",
        ...(corpo?.campi ? { campi: corpo.campi } : {}),
      });
    });
  };

  const copiaUltimo = () => {
    if (!ultimo) return;
    setNote((n) => ({
      ...n,
      ...Object.fromEntries(CAMPI_NOTE.filter((c) => c !== "note" && ultimo[c]).map((c) => [c, ultimo[c]!])),
    }));
  };

  const erroriCampi = fase.tipo === "errore" ? (fase.campi ?? {}) : {};
  const idModulo = "modulo-nuovo-look";

  const piede = (
    <div>
      {pronte.length === 0 && !comprimendo && <p className="info mb-3 text-steel">Serve almeno una foto per salvare.</p>}
      <button
        type="submit"
        form={idModulo}
        disabled={inVolo || comprimendo || pronte.length === 0}
        aria-busy={inVolo}
        className={cn(bottonePieno, "min-h-14 w-full")}
      >
        {(inVolo || comprimendo) && <Rotella />}
        {inVolo ? "Salvataggio…" : comprimendo ? "Preparo le foto…" : fase.tipo === "modifica" ? "Salva look" : "Riprova"}
      </button>
    </div>
  );

  return (
    <FoglioInBasso
      aperto
      onChiudi={chiudi}
      bloccato={inVolo}
      sopratitolo={`${nome} · ${dataLook(data)}`}
      titolo="Nuovo look"
      piede={piede}
    >
      <form id={idModulo} onSubmit={invia} noValidate>
        {/* min-w-0: un fieldset è largo almeno quanto il suo contenuto, e le
            righe di scorciatoie che scorrono di lato lo allargherebbero. */}
        <fieldset disabled={inVolo} className="min-w-0 space-y-6">
          <div aria-live="polite">
            {fase.tipo === "senza-rete" && (
              <p role="alert" className="info border-2 border-dashed border-ink px-4 py-3">
                {bozza && !inVolo
                  ? `Look del ${dataLook(data)} rimasto sul telefono, non ancora salvato. Controlla e tocca Riprova.`
                  : "Non c'è rete. Il look è salvato sul telefono: riprova quando torna."}
              </p>
            )}
            {fase.tipo === "errore" && (
              <p role="alert" className="info border border-ink bg-ink px-4 py-3 text-paper">
                {fase.messaggio}
              </p>
            )}
          </div>

          <section aria-label="Foto">
            <Fotocamera scatti={scatti} onFile={aggiungi} onTogli={togli} disabilitata={inVolo} />
          </section>

          <section aria-label="Note del taglio" className="space-y-5">
            {ultimo && CAMPI_NOTE.some((c) => c !== "note" && ultimo[c]) && (
              <button
                type="button"
                onClick={copiaUltimo}
                className="eyebrow flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 border border-dashed border-ink px-4 transition-colors duration-150 hover:bg-fog"
              >
                Copia dall&apos;ultimo look · {dataLook(ultimo.data)}
              </button>
            )}

            {CAMPI_NOTE.filter((c) => c !== "note").map((c) => (
              <CampoConScorciatoie
                key={c}
                campoNota={c}
                valore={note[c]}
                errore={erroriCampi[c]}
                onCambia={(v) => setNote((n) => ({ ...n, [c]: v }))}
              />
            ))}

            <label className="block">
              <span className="info text-steel">Note libere</span>
              <textarea
                value={note.note}
                onChange={(e) => setNote((n) => ({ ...n, note: e.target.value }))}
                maxLength={maxCampo("note")}
                rows={3}
                placeholder="Es. vortice sulla nuca, lasciare più lungo davanti"
                className={cn(campo, "py-3 leading-relaxed")}
                {...(erroriCampi.note ? { "aria-invalid": true as const } : {})}
              />
            </label>

            <button
              type="button"
              onClick={() => setPreferito((v) => !v)}
              aria-pressed={preferito}
              className={cn(
                "eyebrow flex min-h-12 w-full cursor-pointer items-center justify-center gap-3 border px-5 transition-colors duration-150",
                preferito ? "border-ink bg-ink text-paper" : "border-ink/30 hover:border-ink",
              )}
            >
              <Stella piena={preferito} />
              {preferito ? "Preferito del cliente" : "Segna come preferito"}
            </button>
          </section>
        </fieldset>
      </form>
    </FoglioInBasso>
  );
}

function CampoConScorciatoie({
  campoNota,
  valore,
  errore,
  onCambia,
}: {
  campoNota: CampoNota;
  valore: string;
  errore?: string;
  onCambia: (v: string) => void;
}) {
  const scorciatoie = PRESET[campoNota] ?? [];
  const id = `nota-${campoNota}`;
  return (
    <div>
      <label htmlFor={id} className="info text-steel">
        {NOMI_CAMPO[campoNota]}
      </label>
      <input
        id={id}
        value={valore}
        onChange={(e) => onCambia(e.target.value)}
        maxLength={maxCampo(campoNota)}
        autoComplete="off"
        enterKeyHint="next"
        className={campo}
        {...(errore ? { "aria-invalid": true as const } : {})}
      />
      {errore && <span className="info mt-2 block">{errore}</span>}
      {scorciatoie.length > 0 && (
        // Una riga che scorre di lato: tutte le scorciatoie a portata di
        // pollice senza allungare il foglio.
        <div
          role="group"
          aria-label={`Scorciatoie per ${NOMI_CAMPO[campoNota].toLowerCase()}`}
          className="-mx-5 mt-2 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] md:-mx-6 md:px-6 [&::-webkit-scrollbar]:hidden"
        >
          {scorciatoie.map((s) => {
            const attiva = presetAttivo(valore, s);
            return (
              <button
                key={s}
                type="button"
                aria-pressed={attiva}
                onClick={() => onCambia(alternaPreset(valore, s).slice(0, maxCampo(campoNota)))}
                className={cn(
                  "info min-h-11 min-w-11 shrink-0 cursor-pointer whitespace-nowrap border px-3 transition-colors duration-150",
                  attiva ? "border-ink bg-ink text-paper" : "border-ink/30 hover:border-ink",
                )}
              >
                {s}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

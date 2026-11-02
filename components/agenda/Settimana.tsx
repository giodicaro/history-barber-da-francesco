import Link from "next/link";
import { chiusoIl, dataBreve, type Chiusura } from "@/lib/chiusure";
import { formatoOra, sommaGiorni, turniDellaGiornata } from "@/lib/orari";
import type { Disdetta, VoceAgenda } from "@/lib/prenotazioni/tipi";
import { orari } from "@/lib/salone";
import { cn } from "@/lib/utils";

/* La settimana dell'agenda (app/admin/settimana), da lunedì a domenica.
   - Telefono: un elenco giorno per giorno, in ordine di orario. Una griglia
     a sette colonne su 360 px non si legge.
   - Da md: griglia oraria, una colonna per giorno, le schede alte quanto
     durano. Ogni scheda porta al giorno, dove si modifica.
   Stato sempre a parole (Spostato, Da gestire, Disdetto), non solo col colore.
   Componente server: niente JavaScript in più per l'agenda. */

const GIORNI = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
// Altezza di un quarto d'ora nella griglia, in rem: con 1,4 una scheda da
// 30 minuti è alta 44,8 px, un bersaglio comodo per il dito.
const REM_QUARTO = 1.4;

type Props = { lunedi: string; oggi: string; voci: VoceAgenda[]; disdette: Disdetta[]; chiusure: Chiusura[] };

// Ore della griglia: dalla prima apertura all'ultima chiusura della settimana.
const turniTutti = orari.flatMap((g) => g.turni);
const APRE = Math.min(...turniTutti.map((t) => t.apre));
const CHIUDE = Math.max(...turniTutti.map((t) => t.chiude));

export function Settimana({ lunedi, oggi, voci, disdette, chiusure }: Props) {
  const giorni = Array.from({ length: 7 }, (_, i) => {
    const data = sommaGiorni(lunedi, i);
    return {
      data,
      nome: GIORNI[i],
      oggi: data === oggi,
      chiusura: chiusoIl(data, chiusure),
      aperto: turniDellaGiornata(data).length > 0,
      voci: voci.filter((v) => v.data === data).sort((a, b) => a.inizio - b.inizio),
      disdette: disdette.filter((d) => d.data === data),
    };
  });
  const appuntamenti = voci.filter((v) => v.tipo === "appuntamento").length;

  return (
    <div>
      <header className="border-b border-ink pb-5">
        <p className="eyebrow text-steel">Settimana</p>
        <h1 className="display mt-2 text-[clamp(1.5rem,calc(100cqi/11),3rem)] leading-none tabular-nums">
          {dataBreve(lunedi).slice(0, 5)} – {dataBreve(sommaGiorni(lunedi, 6))}
        </h1>
        <p className="info mt-2 text-steel">
          {appuntamenti === 1 ? "1 appuntamento" : `${appuntamenti} appuntamenti`}
          {chiusure.length > 0 && " · con giorni chiusi"}
        </p>
        <div className="mt-4 grid grid-cols-[auto_1fr_auto] gap-2">
          <Link
            href={`/admin/settimana?data=${sommaGiorni(lunedi, -7)}`}
            prefetch={false}
            aria-label="Settimana precedente"
            className="flex min-h-11 w-12 items-center justify-center border border-ink hover:bg-ink hover:text-paper"
          >
            <svg viewBox="0 0 24 24" aria-hidden className="size-6" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </Link>
          <Link
            href="/admin/settimana"
            prefetch={false}
            className="eyebrow flex min-h-11 items-center justify-center border border-ink px-3 hover:bg-ink hover:text-paper"
          >
            Questa settimana
          </Link>
          <Link
            href={`/admin/settimana?data=${sommaGiorni(lunedi, 7)}`}
            prefetch={false}
            aria-label="Settimana successiva"
            className="flex min-h-11 w-12 items-center justify-center border border-ink hover:bg-ink hover:text-paper"
          >
            <svg viewBox="0 0 24 24" aria-hidden className="size-6" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </header>

      {/* ── Telefono: elenco per giorno ─────────────────────────────────── */}
      <ol className="mt-4 md:hidden">
        {giorni.map((g) => (
          <li key={g.data} className="border-b border-ink/15 py-4">
            <Link
              href={`/admin?data=${g.data}`}
              prefetch={false}
              className="flex min-h-11 items-baseline justify-between gap-3"
              aria-current={g.oggi ? "date" : undefined}
            >
              <span className="text-xl font-extrabold tracking-[-0.02em]">
                {g.nome} {dataBreve(g.data).slice(0, 5)}
                {g.oggi && <span className="info ml-2 bg-ink px-2 py-0.5 align-middle text-paper">Oggi</span>}
              </span>
              <span className="info text-steel">Apri →</span>
            </Link>
            <Giorno g={g} />
          </li>
        ))}
      </ol>

      {/* ── Da md: griglia oraria ───────────────────────────────────────── */}
      {/* Nomi lunghi troncati apposta: la scheda porta al giorno, dove si legge tutto. */}
      <div className="mt-6 hidden md:block" data-taglio-voluto>
        <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-ink">
          <span />
          {giorni.map((g) => (
            <Link
              key={g.data}
              href={`/admin?data=${g.data}`}
              prefetch={false}
              aria-current={g.oggi ? "date" : undefined}
              className={cn("flex min-h-11 flex-col items-center justify-center border-l border-ink/15 py-2 hover:bg-fog", g.oggi && "bg-ink text-paper hover:bg-ink")}
            >
              <span className="eyebrow">{g.nome}</span>
              <span className="info tabular-nums">{dataBreve(g.data).slice(0, 5)}</span>
            </Link>
          ))}
        </div>
        <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]">
          {/* Asse delle ore */}
          <div className="relative" style={{ height: `${((CHIUDE - APRE) / 15) * REM_QUARTO}rem` }}>
            {Array.from({ length: Math.floor((CHIUDE - APRE) / 60) + 1 }, (_, i) => APRE + i * 60 - (APRE % 60)).filter((m) => m >= APRE).map((m) => (
              <span key={m} className="info absolute right-2 -translate-y-1/2 tabular-nums text-steel" style={{ top: `${((m - APRE) / 15) * REM_QUARTO}rem` }}>
                {formatoOra(m)}
              </span>
            ))}
          </div>
          {giorni.map((g) => (
            <div
              key={g.data}
              className="relative border-l border-ink/15"
              style={{
                height: `${((CHIUDE - APRE) / 15) * REM_QUARTO}rem`,
                // Righe delle ore, leggere.
                backgroundImage: `repeating-linear-gradient(to bottom, rgb(10 10 10 / 0.08) 0 1px, transparent 1px ${4 * REM_QUARTO}rem)`,
              }}
            >
              {(g.chiusura || !g.aperto) && (
                <div
                  className="absolute inset-0 flex items-start justify-center p-2 text-center"
                  style={{ backgroundImage: "repeating-linear-gradient(135deg, transparent 0 9px, rgb(10 10 10 / 0.07) 9px 11px)" }}
                >
                  <span className="info bg-paper px-1.5 py-0.5 font-bold">
                    {g.chiusura ? `Chiuso${g.chiusura.motivo ? ` · ${g.chiusura.motivo}` : ""}` : "Chiuso"}
                  </span>
                </div>
              )}
              {g.voci.map((v) => (
                <Link
                  key={v.id}
                  href={`/admin?data=${g.data}`}
                  prefetch={false}
                  className={cn(
                    "absolute inset-x-0.5 overflow-hidden px-1.5 py-1 text-left",
                    v.tipo === "appuntamento" ? "bg-ink text-paper hover:opacity-90" : "border border-ink bg-paper text-ink",
                  )}
                  style={{
                    top: `${((Math.max(v.inizio, APRE) - APRE) / 15) * REM_QUARTO}rem`,
                    height: `${Math.max(2.75, (Math.max(15, v.fine - v.inizio) / 15) * REM_QUARTO - 0.125)}rem`,
                  }}
                >
                  <span className="info block tabular-nums">{formatoOra(v.inizio)}</span>
                  <span className="block truncate text-sm font-bold">{v.tipo === "appuntamento" ? v.cliente.nome : (v.motivo ?? "Bloccato")}</span>
                  {v.tipo === "appuntamento" && (g.chiusura || v.spostatoDa) && (
                    <span className="info block truncate">{g.chiusura ? "Da gestire" : "Spostato"}</span>
                  )}
                </Link>
              ))}
            </div>
          ))}
        </div>
        {/* Disdetti sotto la griglia: non occupano la poltrona. */}
        {disdette.length > 0 && (
          <div className="mt-4 grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]">
            <span className="info pt-1 text-steel">Disdetti</span>
            {giorni.map((g) => (
              <ul key={g.data} className="space-y-1 border-l border-ink/15 px-1">
                {g.disdette.map((d) => (
                  <li key={d.id} className="info truncate text-steel line-through opacity-70">
                    {formatoOra(d.inizio)} {d.cliente.nome}
                  </li>
                ))}
              </ul>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* Un giorno nell'elenco del telefono. */
function Giorno({
  g,
}: {
  g: { data: string; chiusura: Chiusura | null; aperto: boolean; voci: VoceAgenda[]; disdette: Disdetta[] };
}) {
  return (
    <div className="mt-2 space-y-2">
      {g.chiusura && (
        <p className="border-2 border-ink bg-ink px-3 py-2 text-base font-bold text-paper">
          Chiuso{g.chiusura.motivo ? ` · ${g.chiusura.motivo}` : " per ferie"}
        </p>
      )}
      {!g.chiusura && !g.aperto && g.voci.length === 0 && <p className="info text-steel">Salone chiuso</p>}
      {g.aperto && !g.chiusura && g.voci.length === 0 && <p className="info text-steel">Nessun appuntamento</p>}
      {g.voci.map((v) => (
        <div key={v.id} className={cn("flex items-stretch gap-2", v.tipo === "blocco" && "text-steel")}>
          <span className="info w-24 shrink-0 py-2 tabular-nums">
            {formatoOra(v.inizio)}–{formatoOra(v.fine)}
          </span>
          {v.tipo === "appuntamento" ? (
            <span className="min-w-0 flex-auto border-l-4 border-ink py-1 pl-3">
              <span className="block break-words text-base font-bold">{v.cliente.nome}</span>
              <span className="block text-sm text-steel">{v.servizioNome}</span>
              <span className="mt-1 flex flex-wrap gap-1.5">
                <span className="info border border-ink px-1.5">{g.chiusura ? "Da gestire" : v.spostatoDa ? "Spostato" : "Confermato"}</span>
              </span>
            </span>
          ) : (
            <span className="min-w-0 flex-auto border-l-4 border-dashed border-ink/40 py-2 pl-3 text-sm">Bloccato{v.motivo ? ` · ${v.motivo}` : ""}</span>
          )}
          {v.tipo === "appuntamento" && v.cliente.telefono && (
            <a
              href={`tel:${v.cliente.telefono.replace(/\s/g, "")}`}
              aria-label={`Chiama ${v.cliente.nome} al ${v.cliente.telefono}`}
              className="flex w-11 shrink-0 items-center justify-center border border-ink hover:bg-ink hover:text-paper"
            >
              <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
              </svg>
            </a>
          )}
        </div>
      ))}
      {g.disdette.map((d) => (
        <div key={d.id} className="flex items-stretch gap-2 text-steel opacity-70">
          <span className="info w-24 shrink-0 py-2 tabular-nums line-through">
            {formatoOra(d.inizio)}–{formatoOra(d.fine)}
          </span>
          <span className="min-w-0 flex-auto border-l-4 border-dashed border-ink/30 py-1 pl-3">
            <span className="block text-base font-bold line-through">{d.cliente.nome}</span>
            <span className="info">Disdetto</span>
          </span>
        </div>
      ))}
    </div>
  );
}

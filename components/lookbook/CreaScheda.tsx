"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { creaSchedaCliente } from "@/app/admin/lookbook/azioni";
import { FoglioInBasso, Rotella } from "@/components/agenda/FoglioInBasso";
import { bottonePieno, campo } from "@/components/agenda/stili";
import { MAX_NOME } from "@/lib/lookbook/validazione";
import { normalizzaTelefono, telefonoLeggibile } from "@/lib/prenotazioni/telefono";
import { cn } from "@/lib/utils";

/* "Crea scheda": nome, telefono facoltativo e il consenso del cliente.

   Senza la spunta il bottone resta spento (e il server ricontrolla). La
   frase sotto la casella è scritta per essere letta ad alta voce al cliente,
   così sa cosa sta accettando. */

export const FRASE_CONSENSO =
  "Salviamo le foto del tuo taglio per ricordare come lo vuoi. Le vedi solo tu, dal tuo telefono, e le cancelliamo quando vuoi.";

export function CreaScheda({
  proposta,
  apertoSubito = false,
}: {
  /** Nome e telefono dell'appuntamento da cui si arriva. */
  proposta?: { nome: string; telefono?: string };
  apertoSubito?: boolean;
}) {
  const [aperto, setAperto] = useState(apertoSubito);

  return (
    <>
      <button
        type="button"
        onClick={() => setAperto(true)}
        className={cn(bottonePieno, "min-h-14 w-full")}
      >
        <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Nuova scheda
      </button>
      {aperto && <FoglioScheda proposta={proposta} onChiudi={() => setAperto(false)} />}
    </>
  );
}

function FoglioScheda({ proposta, onChiudi }: { proposta?: { nome: string; telefono?: string }; onChiudi: () => void }) {
  const router = useRouter();
  const [nome, setNome] = useState(proposta?.nome ?? "");
  const [telefono, setTelefono] = useState(proposta?.telefono ? telefonoLeggibile(proposta.telefono) : "");
  const [consenso, setConsenso] = useState(false);
  const [errore, setErrore] = useState("");
  const [errori, setErrori] = useState<Record<string, string>>({});
  const [inVolo, avvia] = useTransition();
  const telefonoNonValido = telefono.trim() !== "" && !normalizzaTelefono(telefono);

  const invia = (e: FormEvent) => {
    e.preventDefault();
    if (!consenso || inVolo) return;
    avvia(async () => {
      setErrore("");
      setErrori({});
      try {
        const r = await creaSchedaCliente({ nome, telefono, consenso });
        if (r.ok) {
          router.push(`/admin/lookbook/${r.id}`);
          return;
        }
        setErrore(r.errore);
        setErrori(r.campi ?? {});
      } catch {
        setErrore("Connessione assente o lenta: la scheda non è stata creata. Riprova.");
      }
    });
  };

  const errato = (chiave: string) => (errori[chiave] ? { "aria-invalid": true as const } : {});
  const idModulo = "modulo-scheda";

  return (
    <FoglioInBasso
      aperto
      onChiudi={onChiudi}
      bloccato={inVolo}
      sopratitolo="Lookbook"
      titolo="Crea scheda"
      piede={
        <button
          type="submit"
          form={idModulo}
          disabled={!consenso || inVolo}
          aria-busy={inVolo}
          className={cn(bottonePieno, "min-h-14 w-full")}
        >
          {inVolo && <Rotella />}
          {inVolo ? "Creo la scheda…" : consenso ? "Crea scheda" : "Serve il consenso"}
        </button>
      }
    >
      <form id={idModulo} onSubmit={invia} noValidate>
        <fieldset disabled={inVolo} className="space-y-5">
          {errore && (
            <p role="alert" className="info border border-ink bg-ink px-4 py-3 text-paper">
              {errore}
            </p>
          )}
          <label className="block">
            <span className="info text-steel">Cliente</span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={MAX_NOME}
              autoComplete="off"
              autoCapitalize="words"
              placeholder="Nome e cognome"
              className={campo}
              {...errato("nome")}
            />
            {errori.nome && <span className="info mt-2 block">{errori.nome}</span>}
          </label>
          <label className="block">
            <span className="info text-steel">Telefono · facoltativo</span>
            <input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="347 123 4567"
              className={campo}
              {...(errori.telefono || telefonoNonValido ? { "aria-invalid": true as const } : {})}
            />
            <span className="info mt-2 block text-steel">
              {errori.telefono ?? (telefonoNonValido ? "Numero non valido" : "Serve per WhatsApp e per ritrovare la scheda dall'agenda.")}
            </span>
          </label>

          {/* Il consenso: tutta la riga si tocca, la casella è grande. */}
          <label
            className={cn(
              "flex cursor-pointer gap-4 border px-4 py-4 transition-colors duration-150",
              consenso ? "border-ink bg-fog" : "border-ink/30 hover:border-ink",
            )}
          >
            {/* Casella quadrata disegnata qui: quella di sistema è arrotondata. */}
            <span className="relative mt-0.5 size-6 shrink-0">
              <input
                type="checkbox"
                checked={consenso}
                onChange={(e) => setConsenso(e.target.checked)}
                className="peer size-6 cursor-pointer appearance-none rounded-none border-2 border-ink bg-paper checked:bg-ink"
              />
              <svg
                viewBox="0 0 24 24"
                aria-hidden
                className="pointer-events-none absolute inset-0 m-auto hidden size-4 text-paper peer-checked:block"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              >
                <path d="M5 12l5 5 9-10" />
              </svg>
            </span>
            <span>
              <span className="block text-base font-bold">
                Il cliente ha accettato che conserviamo foto e note del suo taglio
              </span>
              <span className="mt-2 block text-base text-steel">&ldquo;{FRASE_CONSENSO}&rdquo;</span>
            </span>
          </label>
        </fieldset>
      </form>
    </FoglioInBasso>
  );
}

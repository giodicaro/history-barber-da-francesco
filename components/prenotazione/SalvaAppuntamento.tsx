"use client";

import { useState } from "react";
import { fileCalendario } from "@/lib/prenotazioni/calendario";
import { MARGINE_GESTIONE_MINUTI, salone } from "@/lib/salone";
import { cn } from "@/lib/utils";

/* "Salvalo adesso": il link personale da copiare o mandarsi su WhatsApp, e
   l'appuntamento nel calendario del telefono (.ics generato qui, nel
   browser). Il sito non manda email né SMS: è così che il cliente conserva
   l'accesso a "Gestisci il tuo appuntamento". */

const bottone =
  "eyebrow inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 border border-ink px-4 text-center transition-colors duration-200 hover:bg-ink hover:text-paper";

const dataLunga = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
export const giornoLungo = (data: string) => dataLunga.format(new Date(`${data}T12:00:00Z`));

export function SalvaAppuntamento({
  link,
  codice,
  appuntamento,
  soloCalendario = false,
}: {
  /** Link personale completo; assente nella pagina aperta con telefono + codice. */
  link?: string;
  codice?: string;
  appuntamento: { id: string; data: string; inizio: number; fine: number; ora: string; servizio: string };
  soloCalendario?: boolean;
}) {
  const [esito, setEsito] = useState("");

  const copia = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setEsito("Link copiato.");
    } catch {
      setEsito("Tieni premuto sul link e scegli Copia.");
    }
  };

  const quando = `${giornoLungo(appuntamento.data)} alle ${appuntamento.ora}`;
  const messaggio = [
    `Il mio appuntamento da ${salone.nomeCompleto}: ${appuntamento.servizio}, ${quando}.`,
    link && `Per spostarlo o disdirlo: ${link}`,
    codice && `Codice: ${codice}`,
  ]
    .filter(Boolean)
    .join("\n");

  const calendario = () => {
    const ics = fileCalendario({
      uid: `${appuntamento.id}@history-barber-da-francesco`,
      data: appuntamento.data,
      inizio: appuntamento.inizio,
      fine: appuntamento.fine,
      titolo: `${appuntamento.servizio} · ${salone.nomeCompleto}`,
      luogo: `${salone.nomeCompleto}, ${salone.via}, ${salone.cap} ${salone.citta} (${salone.provincia})`,
      descrizione: [
        link ? `Per spostare o disdire (fino a ${MARGINE_GESTIONE_MINUTI / 60} ore prima): ${link}` : "Per spostare o disdire: /appuntamento sul sito",
        codice ? `Codice: ${codice}` : "",
        `Telefono del salone: ${salone.telefono}`,
      ]
        .filter(Boolean)
        .join("\n"),
    });
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "appuntamento-history-barber.ics";
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    setEsito("Apri il file scaricato per aggiungerlo al calendario.");
  };

  return (
    <div>
      <div className={cn("grid gap-2", !soloCalendario && "sm:grid-cols-3")}>
        {!soloCalendario && link && (
          <>
            <button type="button" onClick={copia} className={cn(bottone, "bg-ink text-paper hover:bg-paper hover:text-ink")}>
              Copia link
            </button>
            <a href={`https://wa.me/?text=${encodeURIComponent(messaggio)}`} target="_blank" rel="noopener noreferrer" className={bottone}>
              Invia su WhatsApp
            </a>
          </>
        )}
        <button type="button" onClick={calendario} className={bottone}>
          Aggiungi al calendario
        </button>
      </div>
      <p role="status" aria-live="polite" className="info mt-2 min-h-5 text-steel">
        {esito}
      </p>
    </div>
  );
}

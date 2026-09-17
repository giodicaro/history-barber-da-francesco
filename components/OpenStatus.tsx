"use client";

import { useSyncExternalStore } from "react";
import { calcolaStato, oraDiRoma, turniLeggibili } from "@/lib/orari";
import { orari, ordineSettimana } from "@/lib/salone";
import { cn } from "@/lib/utils";

/* Stato e giorno corrente dipendono dall'ora di chi guarda: sul server non
   esistono. getServerSnapshot restituisce null, così l'HTML statico e il primo
   render del browser coincidono e l'informazione compare subito dopo. */

function ogniMezzoMinuto(avvisa: () => void) {
  const id = window.setInterval(avvisa, 30_000);
  return () => window.clearInterval(id);
}

// Stringa e non oggetto: useSyncExternalStore confronta per identità, e un
// oggetto nuovo a ogni lettura farebbe ridisegnare all'infinito.
const statoSerializzato = () => JSON.stringify(calcolaStato());
const nessunValore = () => null;

export function OpenStatus({ className }: { className?: string }) {
  const grezzo = useSyncExternalStore(ogniMezzoMinuto, statoSerializzato, nessunValore);
  const stato = grezzo ? (JSON.parse(grezzo) as ReturnType<typeof calcolaStato>) : null;

  return (
    <p className={cn("info", className)} aria-live="polite">
      {stato ? (
        <>
          <span className="inline-flex items-center gap-2">
            <span
              aria-hidden
              className={cn("size-2 rounded-full", stato.aperto ? "bg-current" : "border border-current")}
            />
            {stato.aperto ? "Aperto ora" : "Chiuso ora"}
          </span>
          <br />
          <span className="opacity-70">
            {stato.aperto ? `Fino alle\u00a0${stato.chiudeAlle}` : `Riapre ${stato.riapre}`}
          </span>
        </>
      ) : (
        // Stesso ingombro del contenuto finale: niente salti quando arriva.
        <span className="opacity-0">
          Aperto ora
          <br />
          Fino alle 00:00
        </span>
      )}
    </p>
  );
}

const giornoDiRoma = () => oraDiRoma().giorno;
const nessunGiorno = () => -1;

export function OrariTable() {
  const oggi = useSyncExternalStore(ogniMezzoMinuto, giornoDiRoma, nessunGiorno);

  return (
    <table className="w-full">
      <caption className="sr-only">Orari di apertura</caption>
      <tbody>
        {ordineSettimana.map((g) => {
          const corrente = g === oggi;
          return (
            <tr
              key={g}
              aria-current={corrente ? "date" : undefined}
              className={cn("border-b grid-line last:border-b-0", corrente ? "text-paper" : "text-smoke")}
            >
              <th scope="row" className="info py-2 pr-4 text-left">
                <span className="inline-flex items-center gap-2">
                  <span
                    aria-hidden
                    className={cn("size-1.5 rounded-full bg-current", !corrente && "invisible")}
                  />
                  {orari[g].giorno}
                </span>
              </th>
              <td className="info py-2 text-right tabular-nums">
                {turniLeggibili(orari[g].turni)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

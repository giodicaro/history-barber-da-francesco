"use client";

import { useId, useState, type FormEvent } from "react";
import { Rotella } from "@/components/agenda/FoglioInBasso";
import { codiceCompleto, formatoCodice } from "@/lib/prenotazioni/codice";
import { normalizzaTelefono } from "@/lib/prenotazioni/telefono";
import { salone } from "@/lib/salone";
import { cn } from "@/lib/utils";
import { GestioneAppuntamento, type Riepilogo } from "./GestioneAppuntamento";

/* /appuntamento: telefono + codice ricevuto alla prenotazione. Il telefono
   da solo non basta mai (D1). Il server risponde allo stesso modo a codice
   sbagliato, numero sbagliato e appuntamento inesistente. */

const campo =
  "mt-2 block min-h-12 w-full rounded-none border bg-paper px-4 text-base outline-none transition-colors duration-200";

export function CercaAppuntamento() {
  const [telefono, setTelefono] = useState("");
  const [codice, setCodice] = useState("");
  const [inVolo, setInVolo] = useState(false);
  const [errore, setErrore] = useState("");
  const [trovato, setTrovato] = useState<{ riepilogo: Riepilogo; credenziale: { telefono: string; codice: string } } | null>(null);
  const idTel = useId();
  const idCod = useId();

  const telefonoPulito = normalizzaTelefono(telefono);
  const erroreTelefono = telefono.replace(/[^0-9]/g, "").length >= 6 && !telefonoPulito ? "Numero non valido: cellulare o fisso italiano" : "";
  const pronto = Boolean(telefonoPulito) && codiceCompleto(codice);

  const cerca = async (e: FormEvent) => {
    e.preventDefault();
    if (!pronto || inVolo) return;
    setInVolo(true);
    setErrore("");
    const credenziale = { telefono, codice };
    try {
      const r = await fetch("/api/appuntamento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ azione: "leggi", credenziale }),
        cache: "no-store",
      });
      const corpo = await r.json().catch(() => ({}));
      if (r.ok && corpo.appuntamento) setTrovato({ riepilogo: corpo.appuntamento, credenziale });
      else setErrore(corpo.errore ?? "Non è andata a buon fine. Riprova.");
    } catch {
      setErrore("Connessione assente. Riprova fra poco.");
    }
    setInVolo(false);
  };

  if (trovato) return <GestioneAppuntamento credenziale={trovato.credenziale} iniziale={trovato.riepilogo} conLink={false} />;

  return (
    <div>
      <p className="eyebrow text-steel">{salone.nomeCompleto}</p>
      <h1 className="display mt-3 text-[clamp(2rem,9.6cqi,4rem)]">Il tuo appuntamento</h1>
      <p className="mt-4 max-w-[46ch] text-base text-steel">
        Per spostarlo o disdirlo scrivi il telefono che hai lasciato e il codice di 6 caratteri che hai ricevuto
        prenotando. Se hai il link personale, ti basta aprirlo.
      </p>

      <form onSubmit={cerca} noValidate className="mt-8 max-w-md space-y-5">
        <div>
          <label htmlFor={idTel} className="eyebrow text-steel">
            Telefono
          </label>
          <input
            id={idTel}
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={20}
            placeholder="347 123 4567"
            aria-invalid={erroreTelefono ? true : undefined}
            aria-describedby={erroreTelefono ? `${idTel}-errore` : undefined}
            className={cn(campo, erroreTelefono ? "border-2 border-ink" : "border-ink/30 focus:border-ink")}
          />
          {erroreTelefono && (
            <p id={`${idTel}-errore`} className="info mt-2">
              {erroreTelefono}
            </p>
          )}
        </div>
        <div>
          <label htmlFor={idCod} className="eyebrow text-steel">
            Codice
          </label>
          <input
            id={idCod}
            value={codice}
            // Maiuscolo e trattino da soli, mentre si scrive.
            onChange={(e) => setCodice(formatoCodice(e.target.value))}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="one-time-code"
            spellCheck={false}
            maxLength={7}
            placeholder="K7M-4QX"
            aria-describedby={`${idCod}-aiuto`}
            className={cn(campo, "font-mono tracking-[0.15em] border-ink/30 focus:border-ink")}
          />
          <p id={`${idCod}-aiuto`} className="info mt-2 text-steel">
            6 caratteri, senza 0, O, 1, I o L
          </p>
        </div>

        <div aria-live="polite">
          {errore && (
            <p role="alert" className="border border-ink bg-ink px-4 py-3 text-sm text-paper">
              {errore}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={!pronto || inVolo}
          aria-busy={inVolo}
          className="eyebrow inline-flex min-h-14 w-full cursor-pointer items-center justify-center gap-3 border border-ink bg-ink px-6 text-paper transition-colors duration-200 hover:bg-paper hover:text-ink disabled:cursor-not-allowed disabled:border-ink/20 disabled:bg-ink/20 disabled:text-paper"
        >
          {inVolo && <Rotella />}
          {inVolo ? "Cerco…" : "Apri l'appuntamento"}
        </button>
      </form>

      <p className="mt-10 max-w-[46ch] text-sm text-steel">
        Hai perso il codice? Chiama il salone al{" "}
        <a href={salone.telefonoHref} className="font-semibold text-ink underline underline-offset-4">
          {salone.telefono}
        </a>
        .
      </p>
    </div>
  );
}

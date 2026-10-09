"use client";

import { useState, useTransition } from "react";
import { rigeneraLink } from "@/app/admin/lookbook/azioni";
import { Rotella } from "@/components/agenda/FoglioInBasso";
import { bottonePieno, bottoneVuoto } from "@/components/agenda/stili";
import { useCondivisione } from "@/lib/lookbook/browser";
import { battesimo } from "@/lib/lookbook/formato";
import { salone } from "@/lib/salone";
import { cn } from "@/lib/utils";

/* "Dai al cliente il suo link": il QR da far scansionare in salone, il link
   da copiare, WhatsApp e la condivisione del telefono.

   Il QR arriva già disegnato dal server (SVG di `qrcode`, nero su bianco,
   con il margine di quattro moduli che i lettori vogliono): niente libreria
   nel browser. */

export function CondividiStile({
  clienteId,
  nome,
  telefono,
  link,
  qr,
}: {
  clienteId: string;
  nome: string;
  telefono?: string;
  link: string;
  /** SVG del QR, generato sul server. */
  qr: string;
}) {
  const condivisione = useCondivisione();
  const [esito, setEsito] = useState("");
  const [conferma, setConferma] = useState(false);
  const [inVolo, avvia] = useTransition();
  const nomeProprio = battesimo(nome);
  const messaggio = `Ciao ${nomeProprio}, ecco il tuo stile da ${salone.nome}: ${link}`;

  const copia = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setEsito("Link copiato.");
    } catch {
      // Senza permesso agli appunti (o su http://): si seleziona il testo e
      // lo si copia a mano.
      const campoLink = document.getElementById("link-stile") as HTMLInputElement | null;
      campoLink?.select();
      setEsito("Tieni premuto sul link e scegli Copia.");
    }
  };

  const condividi = async () => {
    try {
      await navigator.share({ title: "Il tuo stile", text: `Ciao ${nomeProprio}, ecco il tuo stile da ${salone.nome}`, url: link });
    } catch {
      // Annullata dall'utente: niente da dire.
    }
  };

  const rigenera = () =>
    avvia(async () => {
      try {
        const r = await rigeneraLink(clienteId);
        setEsito(r.ok ? "Link nuovo pronto: quello vecchio non funziona più." : r.errore);
      } catch {
        setEsito("Connessione assente: il link non è cambiato. Riprova.");
      }
      setConferma(false);
    });

  return (
    <div>
      <p className="max-w-[48ch] text-base">
        Fai inquadrare il codice al cliente con la fotocamera del telefono: si apre &ldquo;Il mio stile&rdquo;, con le
        foto e le note dei suoi tagli. Nessuna app, nessuna password.
      </p>

      <div className="mt-5 grid gap-5 md:grid-cols-[16rem_1fr] md:items-start">
        <div
          role="img"
          aria-label={`Codice QR del link personale di ${nome}`}
          className="mx-auto w-full max-w-64 border border-ink bg-paper [&_svg]:block [&_svg]:size-full"
          dangerouslySetInnerHTML={{ __html: qr }}
        />

        <div className="min-w-0 space-y-3">
          <label className="block">
            <span className="info text-steel">Link personale</span>
            <input
              id="link-stile"
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              className="info mt-2 block min-h-12 w-full truncate border border-ink/30 bg-fog px-3 normal-case outline-none focus:border-ink"
            />
          </label>
          <div className="flex flex-col gap-2">
            <button type="button" onClick={copia} className={cn(bottonePieno, "w-full")}>
              Copia link
            </button>
            {telefono && (
              <a
                href={`https://wa.me/${telefono.replace(/^\+/, "")}?text=${encodeURIComponent(messaggio)}`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(bottoneVuoto, "w-full")}
              >
                Invia su WhatsApp
              </a>
            )}
            {condivisione && (
              <button type="button" onClick={condividi} className={cn(bottoneVuoto, "w-full")}>
                Condividi…
              </button>
            )}
          </div>
          <p role="status" aria-live="polite" className="info min-h-5 text-steel">
            {esito}
          </p>
        </div>
      </div>

      <div className="mt-6 border-t border-ink/15 pt-5">
        {conferma ? (
          <div>
            <p className="max-w-[48ch] text-base">
              Il link di adesso <b>smette di funzionare</b>, anche sul telefono di {nomeProprio}: dovrai dargli quello nuovo.
              Serve se il link è finito in mani sbagliate.
            </p>
            <div className="mt-3 flex gap-3">
              <button type="button" onClick={() => setConferma(false)} disabled={inVolo} className={bottoneVuoto}>
                No
              </button>
              <button type="button" onClick={rigenera} disabled={inVolo} aria-busy={inVolo} className={bottonePieno}>
                {inVolo && <Rotella />}
                {inVolo ? "Un attimo…" : "Sì, link nuovo"}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setEsito("");
              setConferma(true);
            }}
            className="eyebrow min-h-11 cursor-pointer text-steel underline-offset-4 hover:text-ink hover:underline"
          >
            Rigenera link
          </button>
        )}
      </div>
    </div>
  );
}

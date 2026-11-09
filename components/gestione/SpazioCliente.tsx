"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Rotella } from "@/components/agenda/FoglioInBasso";
import { giornoLungo } from "@/components/prenotazione/SalvaAppuntamento";
import { aggiornaMiei } from "@/lib/gestione";
import { salone } from "@/lib/salone";
import { cn, formatoPrezzo } from "@/lib/utils";
import { GestioneAppuntamento, type Riepilogo } from "./GestioneAppuntamento";

/* Lo spazio "Il mio appuntamento" (N6), lo stesso nel foglio della home
   (GestioneWidget) e a tutta pagina (/appuntamento).

   Stati: caricamento; riconosciuto con appuntamenti (elenco, poi Disdici
   con le regole della v1); riconosciuto senza appuntamenti;
   non riconosciuto (telefono e WhatsApp);
   riconoscimento spento (solo telefono e WhatsApp).

   Il cliente non scrive niente e non salva niente: lo riconosce il cookie
   del suo browser. Niente framer-motion, GSAP né Lenis. */

type Elenco =
  | { stato: "caricamento" }
  | { stato: "errore" }
  | { stato: "spento" }
  | { stato: "sconosciuto" }
  | { stato: "riconosciuto"; appuntamenti: Riepilogo[] };

const bottonePieno =
  "eyebrow inline-flex min-h-14 w-full cursor-pointer items-center justify-center gap-3 border border-ink bg-ink px-6 text-paper transition-colors duration-200 hover:bg-paper hover:text-ink disabled:cursor-not-allowed disabled:opacity-50";
const bottoneVuoto =
  "eyebrow inline-flex min-h-14 w-full cursor-pointer items-center justify-center gap-3 border border-ink px-6 transition-colors duration-200 hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:opacity-50";

const WHATSAPP_SALONE = salone.telefonoHref.replace(/\D/g, "");

async function posta(url: string, corpo: unknown) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
    cache: "no-store",
    credentials: "same-origin",
  });
  return { stato: r.status, corpo: await r.json().catch(() => ({})) };
}

export function SpazioCliente({ onPrenota }: { onPrenota?: () => void }) {
  const [elenco, setElenco] = useState<Elenco>({ stato: "caricamento" });
  const [aperto, setAperto] = useState<string | null>(null);
  const [esito, setEsito] = useState("");
  const [inVolo, setInVolo] = useState(false);
  const [dimentica, setDimentica] = useState(false);

  const carica = async () => {
    try {
      const { stato, corpo } = await posta("/api/appuntamento", { azione: "elenco" });
      if (stato !== 200) return setElenco({ stato: "errore" });
      if (corpo.attivo === false) return setElenco({ stato: "spento" });
      if (!corpo.riconosciuto) return setElenco({ stato: "sconosciuto" });
      setElenco({ stato: "riconosciuto", appuntamenti: corpo.appuntamenti ?? [] });
    } catch {
      setElenco({ stato: "errore" });
    }
  };

  // Una lettura all'apertura.
  useEffect(() => {
    const t = setTimeout(() => void carica(), 0);
    return () => clearTimeout(t);
  }, []);

  const dimenticaDispositivo = async () => {
    setInVolo(true);
    await posta("/api/appuntamento", { azione: "dimentica" }).catch(() => null);
    setInVolo(false);
    setDimentica(false);
    setAperto(null);
    setEsito("Questo dispositivo non ti ricorda più.");
    await Promise.all([carica(), aggiornaMiei()]);
  };

  // Anche mentre carica la pagina ha il suo titolo (è già nell'HTML servito).
  if (elenco.stato === "caricamento") {
    return (
      <div>
        <Intestazione />
        <p className="info flex items-center gap-3 py-10 text-steel" role="status">
          <Rotella /> Un attimo…
        </p>
      </div>
    );
  }

  // Un appuntamento aperto (o l'unico): riepilogo, Disdici.
  if (elenco.stato === "riconosciuto") {
    const unico = elenco.appuntamenti.length === 1 ? elenco.appuntamenti[0] : null;
    const scelto = elenco.appuntamenti.find((a) => a.id === aperto) ?? unico;
    if (scelto && (aperto || unico) && !dimentica) {
      return (
        <div>
          <GestioneAppuntamento
            key={scelto.id}
            credenziale={{ prenotazioneId: scelto.id }}
            iniziale={scelto}
            modo="cliente"
            onPrenota={onPrenota}
            onIndietro={unico ? undefined : () => setAperto(null)}
            onCambiato={() => void aggiornaMiei()}
          />
          {/* Per ultimo, dopo il calendario (C3). */}
          <div className="mt-8 border-t border-ink/15 pt-4">
            <BottoneDimentica onDimentica={() => setDimentica(true)} />
          </div>
        </div>
      );
    }
  }

  return (
    <div>
      <Intestazione />

      {elenco.stato === "riconosciuto" && dimentica && (
        <div className="mt-6 border border-ink p-5">
          <p className="text-base">
            Dimenticare questo dispositivo? Gli appuntamenti restano: per rivederli qui servirà un messaggio dal salone.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => setDimentica(false)} disabled={inVolo} className={bottoneVuoto}>
              No
            </button>
            <button type="button" onClick={dimenticaDispositivo} disabled={inVolo} className={bottonePieno}>
              {inVolo && <Rotella />} Sì, dimentica
            </button>
          </div>
        </div>
      )}

      {elenco.stato === "riconosciuto" && !dimentica && (
        <>
          {elenco.appuntamenti.length === 0 ? (
            <>
              <p className="mt-5 text-lg">Non hai appuntamenti in arrivo.</p>
              {onPrenota ? (
                <button type="button" onClick={onPrenota} className={cn(bottonePieno, "mt-6")}>
                  Prenota ora
                </button>
              ) : (
                <Link href="/?prenota=gestione" prefetch={false} className={cn(bottonePieno, "mt-6")}>
                  Prenota ora
                </Link>
              )}
            </>
          ) : (
            <ul className="mt-6 space-y-3">
              {elenco.appuntamenti.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => setAperto(a.id)}
                    className="group flex w-full cursor-pointer items-center justify-between gap-4 border border-ink p-5 text-left transition-colors duration-200 hover:bg-ink hover:text-paper"
                  >
                    <span className="min-w-0">
                      <span className="info block text-steel group-hover:text-smoke">
                        {giornoLungo(a.data)} · {a.ora}–{a.finisceAlle}
                      </span>
                      <span className="mt-1 block text-xl font-extrabold tracking-[-0.02em]">{a.servizio}</span>
                      <span className="info mt-1 block">{formatoPrezzo(a.prezzo)}</span>
                    </span>
                    <span className="eyebrow shrink-0">Apri →</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-8 border-t border-ink/15 pt-4">
            <BottoneDimentica onDimentica={() => setDimentica(true)} />
          </div>
        </>
      )}

      {elenco.stato === "sconosciuto" && (
        <>
          <Esito testo={esito} />
          <Contatti titolo="Hai prenotato per telefono o da un altro dispositivo?" />
        </>
      )}

      {(elenco.stato === "spento" || elenco.stato === "errore") && (
        <>
          {elenco.stato === "errore" && <Esito testo="Non riusciamo a leggere i tuoi appuntamenti adesso. Riprova fra poco." />}
          <Contatti titolo="Per disdire o cambiare orario" />
        </>
      )}
    </div>
  );
}

function Intestazione() {
  return (
    <>
      <p className="eyebrow text-steel">{salone.nomeCompleto}</p>
      <h1 className="display mt-3 text-[clamp(min(2rem,calc(100cqi/9.8)),9.6cqi,4rem)]">Il mio appuntamento</h1>
    </>
  );
}

function BottoneDimentica({ onDimentica }: { onDimentica: () => void }) {
  return (
    <button type="button" onClick={onDimentica} className="eyebrow inline-flex min-h-11 cursor-pointer items-center text-steel underline-offset-4 hover:text-ink hover:underline">
      Dimentica questo dispositivo
    </button>
  );
}

function Esito({ testo }: { testo: string }) {
  return (
    <div aria-live="polite">
      {testo && (
        <p role="status" className="mt-5 border border-ink bg-ink px-4 py-3 text-sm text-paper">
          {testo}
        </p>
      )}
    </div>
  );
}

function Contatti({ titolo }: { titolo: string }) {
  const messaggio = "Ciao Francesco, vorrei spostare il mio appuntamento di ";
  return (
    <div className="mt-8 border-t border-ink/15 pt-6">
      <p className="text-base font-semibold">{titolo}</p>
      <p className="mt-1 text-base text-steel">Ti aiuta Francesco: una telefonata o un messaggio.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <a href={salone.telefonoHref} className={bottonePieno}>
          Chiama · {salone.telefono}
        </a>
        <a
          href={`https://wa.me/${WHATSAPP_SALONE}?text=${encodeURIComponent(messaggio)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={bottoneVuoto}
        >
          Scrivi su WhatsApp
        </a>
      </div>
    </div>
  );
}

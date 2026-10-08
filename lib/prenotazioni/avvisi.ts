import "server-only";
import { formatoOra } from "@/lib/orari";
import { salone } from "@/lib/salone";
import type { Prenotazione } from "./tipi";

/* Avviso al titolare quando arriva una prenotazione.

   Canale scelto: Telegram. Per un barbiere è il più diretto — arriva sul
   telefono in un secondo, non chiede un dominio verificato come l'email e non
   finisce nello spam. Serve solo creare un bot con @BotFather e leggere il
   proprio chat id: le istruzioni sono in .env.example.

   Regola di fondo: **un avviso che non parte non deve far fallire la
   prenotazione**. Per il cliente l'appuntamento è preso; al massimo Francesco
   lo vede in agenda invece che sul telefono. Per questo qui non si lancia mai
   un errore verso chi chiama, e l'invio parte dopo aver risposto al cliente
   (`after()` in app/api/bookings/route.ts).

   Se un domani si preferisce l'email, l'alternativa con Resend è in fondo. */

// Sovrascrivibile per le prove in locale: di serie è l'API vera di Telegram.
const BASE_TELEGRAM = process.env.TELEGRAM_API_BASE ?? "https://api.telegram.org";

// Oltre questo tempo si rinuncia: meglio nessun avviso che una funzione
// serverless tenuta in piedi ad aspettare.
const ATTESA_MASSIMA_MS = 5000;

export const telegramConfigurato = () =>
  Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);

export function testoAvviso(p: Prenotazione) {
  const quando = `${p.data} alle ${formatoOra(p.inizio)}–${formatoOra(p.fine)}`;
  return [
    `Nuova prenotazione — ${salone.nomeCompleto}`,
    `Cliente: ${p.cliente.nome}`,
    `Telefono: ${p.cliente.telefono ?? "—"}`,
    `Servizio: ${p.servizioNome} (${p.prezzo} €)`,
    `Quando: ${quando}`,
    p.cliente.note ? `Note: ${p.cliente.note}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Esito dell'invio, utile nei log e nei test. Non lancia mai. */
export type EsitoAvviso =
  | { inviato: true }
  | { inviato: false; motivo: "non-configurato" | "errore-telegram" | "rete"; dettaglio?: string };

async function inviaSuTelegram(messaggio: string): Promise<EsitoAvviso> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { inviato: false, motivo: "non-configurato" };

  try {
    const risposta = await fetch(`${BASE_TELEGRAM}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: messaggio,
        disable_notification: false,
        // Niente Markdown/HTML: i nomi dei clienti possono contenere
        // caratteri che Telegram interpreterebbe come formattazione rotta.
        parse_mode: undefined,
      }),
      signal: AbortSignal.timeout(ATTESA_MASSIMA_MS),
      cache: "no-store",
    });

    if (!risposta.ok) {
      const corpo = await risposta.text().catch(() => "");
      return { inviato: false, motivo: "errore-telegram", dettaglio: `${risposta.status} ${corpo.slice(0, 200)}` };
    }
    return { inviato: true };
  } catch (e) {
    // Timeout, DNS, rete assente: tutto qui dentro, tutto silenzioso.
    return { inviato: false, motivo: "rete", dettaglio: e instanceof Error ? e.message : String(e) };
  }
}

/** Avviso libero (es. disdetta o spostamento dall'app). Non lancia mai. */
export async function avvisaTitolareConTesto(messaggio: string): Promise<EsitoAvviso> {
  const esito = await inviaSuTelegram(messaggio);
  if (!esito.inviato) console.info(`[avviso] (${esito.motivo})\n${messaggio}`);
  return esito;
}

export async function avvisaTitolare(p: Prenotazione): Promise<EsitoAvviso> {
  const messaggio = testoAvviso(p);
  const esito = await inviaSuTelegram(messaggio);

  if (esito.inviato) {
    console.info(`[prenotazione] avviso Telegram inviato · ${p.cliente.nome} · ${p.data} ${formatoOra(p.inizio)}`);
  } else if (esito.motivo === "non-configurato") {
    // Senza bot configurato resta comunque una traccia leggibile nei log.
    console.info(`[prenotazione] (Telegram non configurato)\n${messaggio}`);
  } else {
    console.error(`[prenotazione] avviso Telegram non riuscito (${esito.motivo}): ${esito.dettaglio}\n${messaggio}`);
  }
  return esito;
}

/* ── Alternativa: email con Resend ────────────────────────────────────────
   Serve `npm i resend`, una chiave API e un dominio verificato (senza dominio
   si può usare onboarding@resend.dev, ma solo verso il proprio indirizzo).

   const { Resend } = await import("resend");
   const resend = new Resend(process.env.RESEND_API_KEY);
   await resend.emails.send({
     from: "Prenotazioni <prenotazioni@historybarber.it>",
     to: process.env.EMAIL_TITOLARE!,
     subject: `Prenotazione ${p.data} ${formatoOra(p.inizio)} — ${p.cliente.nome}`,
     text: messaggio,
   });
*/

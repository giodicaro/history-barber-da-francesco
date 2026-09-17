import { formatoOra } from "@/lib/orari";
import { salone } from "@/lib/salone";
import type { Prenotazione } from "./tipi";

/* Avviso al titolare quando arriva una prenotazione.

   Oggi scrive nei log del server: il canale vero va scelto con Francesco.
   Sotto trovi le due strade pronte, da scommentare dopo aver messo le
   variabili d'ambiente (su Vercel: Settings → Environment Variables; in
   locale: .env.local, che è già ignorato da git).

   Regola: un avviso che fallisce NON deve far fallire la prenotazione. Per il
   cliente l'appuntamento è preso; al massimo il titolare lo vede in agenda. */

export function testoAvviso(p: Prenotazione) {
  const quando = `${p.data} alle ${formatoOra(p.inizio)}–${formatoOra(p.fine)}`;
  return [
    `Nuova prenotazione — ${salone.nomeCompleto}`,
    `Cliente: ${p.cliente.nome}`,
    `Telefono: ${p.cliente.telefono}`,
    `Servizio: ${p.servizioNome} (${p.prezzo} €)`,
    `Quando: ${quando}`,
    p.cliente.note ? `Note: ${p.cliente.note}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function avvisaTitolare(p: Prenotazione): Promise<void> {
  const messaggio = testoAvviso(p);

  /* ── Strada 1: bot Telegram ──────────────────────────────────────────────
     Gratis, arriva sul telefono in un secondo, non finisce nello spam.
     Preparazione: scrivi a @BotFather → /newbot → prendi il token; poi manda
     un messaggio al bot da parte di Francesco e leggi il chat id da
     https://api.telegram.org/bot<TOKEN>/getUpdates.

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (token && chatId) {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: messaggio, disable_notification: false }),
      // Senza timeout una chiamata lenta terrebbe occupata la risposta al cliente.
      signal: AbortSignal.timeout(4000),
    });
  }
  */

  /* ── Strada 2: email con Resend ──────────────────────────────────────────
     Serve `npm i resend`, una chiave API e un dominio verificato (senza
     dominio si può usare onboarding@resend.dev solo verso il proprio indirizzo).

  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: "Prenotazioni <prenotazioni@historybarber.it>",
    to: process.env.EMAIL_TITOLARE!,
    subject: `Prenotazione ${p.data} ${formatoOra(p.inizio)} — ${p.cliente.nome}`,
    text: messaggio,
    replyTo: p.cliente.telefono,
  });
  */

  // Finché non è collegato nessun canale, resta traccia nei log del server.
  console.info(`[prenotazione]\n${messaggio}`);
}

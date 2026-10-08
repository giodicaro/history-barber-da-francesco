import { inviaPromemoriaDovuti, rispondi } from "@/lib/prenotazioni/app";

/* Esecuzione programmata dei promemoria ai clienti, chiamata ogni 15 minuti
   da .github/workflows/promemoria-app.yml (il piano gratuito di Vercel
   permette cron solo giornalieri).

   Funziona senza configurare niente: chiamarla può solo far partire i
   promemoria già dovuti, e ognuno parte una volta sola (viene segnato nel
   database prima dell'invio), quindi non ha bisogno di una password. Un
   freno evita che venga usata per caricare il database: al massimo una
   esecuzione al minuto per istanza.
   Se si imposta CRON_SECRET (su Vercel e nei segreti di GitHub), la rotta
   risponde solo con "Authorization: Bearer <CRON_SECRET>". */

const stato = globalThis as { __ultimoCronPromemoria?: number };

export async function GET(request: Request) {
  const segreto = process.env.CRON_SECRET;
  if (segreto && request.headers.get("authorization") !== `Bearer ${segreto}`)
    return Response.json({ error: "unauthorized" }, { status: 401 });

  const adesso = Date.now();
  if (adesso - (stato.__ultimoCronPromemoria ?? 0) < 60_000)
    return Response.json({ ok: true, saltato: "eseguito meno di un minuto fa" }, { headers: { "Cache-Control": "no-store" } });
  stato.__ultimoCronPromemoria = adesso;
  return rispondi(() => inviaPromemoriaDovuti());
}

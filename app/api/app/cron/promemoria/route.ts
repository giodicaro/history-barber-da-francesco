import { inviaPromemoriaDovuti, rispondi } from "@/lib/prenotazioni/app";

/* Esecuzione programmata dei promemoria ai clienti.
   Chiamata ogni 15 minuti da .github/workflows/promemoria-app.yml (il piano
   gratuito di Vercel permette cron solo giornalieri), con l'intestazione
   "Authorization: Bearer <CRON_SECRET>". Senza CRON_SECRET la rotta è spenta. */
export async function GET(request: Request) {
  const segreto = process.env.CRON_SECRET;
  if (!segreto) return Response.json({ error: "cron_disabled" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${segreto}`) return Response.json({ error: "unauthorized" }, { status: 401 });
  return rispondi(() => inviaPromemoriaDovuti());
}

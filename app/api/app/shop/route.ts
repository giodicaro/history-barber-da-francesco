import { datiApp, rispondi } from "@/lib/prenotazioni/app";

/** Dati del salone (orari, listino, regole) presi da lib/salone.ts. */
export function GET() {
  return rispondi(async () => datiApp());
}

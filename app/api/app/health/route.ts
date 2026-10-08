import { notificheConfigurate } from "@/lib/prenotazioni/notifiche";

/* API dell'app clienti (PWA in /app). Le URL pubbliche sono /app/api/*:
   next.config.ts le riscrive qui. L'app chiama questa rotta all'avvio per
   capire se il server c'è (altrimenti passa alla modalità demo). */
export function GET() {
  return Response.json({ ok: true, push: notificheConfigurate() }, { headers: { "Cache-Control": "no-store" } });
}

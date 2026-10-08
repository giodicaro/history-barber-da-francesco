import { chiavePubblica } from "@/lib/prenotazioni/notifiche";

/** Chiave VAPID pubblica (le stesse chiavi delle notifiche dell'agenda). */
export function GET() {
  const publicKey = chiavePubblica();
  const intestazioni = { "Cache-Control": "no-store" };
  if (!publicKey) return Response.json({ error: "push_disabled", message: "Notifiche non configurate." }, { status: 503, headers: intestazioni });
  return Response.json({ publicKey }, { headers: intestazioni });
}

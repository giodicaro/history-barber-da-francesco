import { opzioniAccesso, verificaAccesso } from "@/lib/prenotazioni/passkey";
import {
  cookieCliente,
  cookieSfida,
  cookieSfidaUsata,
  freno,
  NO_STORE,
  partePasskey,
  sfidaDaRichiesta,
} from "@/lib/prenotazioni/riconoscimento";

/* POST /api/appuntamento/passkey/accedi — "Entra con Face ID o impronta" da
   un dispositivo non riconosciuto. Nessuna autenticazione: è la passkey a
   dire chi è il cliente.
   { fase: "opzioni" } → opzioni (+ sfida in un cookie firmato)
   { fase: "verifica", risposta } → Set-Cookie hb_cliente + 200 · 401.
   Freno: 10 tentativi ogni 10 minuti per IP, in memoria. */

const troppi = freno("passkey-accesso", 10, 10 * 60 * 1000);

const json = (dati: unknown, stato = 200, ...cookie: (string | null)[]) => {
  const r = Response.json(dati, { status: stato, headers: NO_STORE });
  for (const c of cookie) if (c) r.headers.append("Set-Cookie", c);
  return r;
};

export async function POST(richiesta: Request) {
  const dominio = partePasskey(richiesta);
  if (!dominio) return json({ errore: "Richiesta non valida." }, 403);
  if (troppi(richiesta)) return json({ errore: "Troppi tentativi. Riprova fra qualche minuto." }, 429);
  const corpo = (await richiesta.json().catch(() => null)) as { fase?: string; risposta?: unknown } | null;

  if (corpo?.fase === "opzioni") {
    const r = await opzioniAccesso(dominio.rpID);
    if (!r) return json({ errore: "Non disponibile." }, 503);
    return json(r.opzioni, 200, cookieSfida(r.sfida));
  }
  if (corpo?.fase === "verifica" && corpo.risposta && typeof corpo.risposta === "object") {
    const clienteId = await verificaAccesso(corpo.risposta as never, sfidaDaRichiesta(richiesta), dominio);
    if (!clienteId) return json({ errore: "Non ti abbiamo riconosciuto. Riprova." }, 401, cookieSfidaUsata());
    return json({ ok: true }, 200, cookieSfidaUsata(), cookieCliente(clienteId));
  }
  return json({ errore: "Richiesta non valida." }, 400);
}

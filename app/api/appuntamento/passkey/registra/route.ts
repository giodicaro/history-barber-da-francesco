import { opzioniRegistrazione, verificaRegistrazione } from "@/lib/prenotazioni/passkey";
import {
  clienteDaRichiesta,
  cookieSfida,
  cookieSfidaUsata,
  NO_STORE,
  partePasskey,
  sfidaDaRichiesta,
} from "@/lib/prenotazioni/riconoscimento";

/* POST /api/appuntamento/passkey/registra — attiva Face ID / impronta per il
   cliente riconosciuto dal cookie.
   { fase: "opzioni" } → opzioni per il browser (+ sfida in un cookie firmato)
   { fase: "verifica", risposta } → 201 se la passkey è valida e salvata. */

const json = (dati: unknown, stato = 200, cookie?: string) => {
  const r = Response.json(dati, { status: stato, headers: NO_STORE });
  if (cookie) r.headers.append("Set-Cookie", cookie);
  return r;
};

export async function POST(richiesta: Request) {
  const dominio = partePasskey(richiesta);
  if (!dominio) return json({ errore: "Richiesta non valida." }, 403);
  const clienteId = clienteDaRichiesta(richiesta);
  if (!clienteId) return json({ errore: "Questo dispositivo non è riconosciuto." }, 401);
  const corpo = (await richiesta.json().catch(() => null)) as { fase?: string; risposta?: unknown } | null;

  if (corpo?.fase === "opzioni") {
    const r = await opzioniRegistrazione(clienteId, dominio.rpID);
    if (!r) return json({ errore: "Non disponibile." }, 503);
    return json(r.opzioni, 200, cookieSfida(r.sfida));
  }
  if (corpo?.fase === "verifica" && corpo.risposta && typeof corpo.risposta === "object") {
    const ok = await verificaRegistrazione(corpo.risposta as never, sfidaDaRichiesta(richiesta), clienteId, dominio);
    return ok ? json({ ok: true }, 201, cookieSfidaUsata()) : json({ errore: "Non è stato possibile attivarlo. Riprova." }, 400, cookieSfidaUsata());
  }
  return json({ errore: "Richiesta non valida." }, 400);
}

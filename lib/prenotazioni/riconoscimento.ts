import "server-only";
import {
  chiaveCliente,
  clienteDalCookie,
  DURATA_COOKIE_S,
  firmato,
  intestazioneCookie,
  leggiCookie,
  NOME_COOKIE,
} from "./cliente";

/* "Il mio appuntamento", lato server: dal cookie al cliente, e i controlli
   comuni alle rotte (Origin).

   Nessuna variabile nuova: la chiave si deriva da AUTH_SECRET (vedi
   ./cliente.ts). Senza AUTH_SECRET il riconoscimento è spento: si prenota
   lo stesso, ma lo spazio "Il mio appuntamento" mostra solo i contatti. */

export const chiave = () => chiaveCliente(process.env.AUTH_SECRET);
export const riconoscimentoAttivo = () => chiave() !== null;

// Secure solo in produzione: in sviluppo dall'iPhone (http://172.20.10.x)
// un cookie Secure non verrebbe salvato.
const sicuro = () => process.env.NODE_ENV === "production";

/** Il cliente_id del cookie hb_cliente della richiesta, o null. */
export function clienteDaRichiesta(richiesta: Request): string | null {
  const k = chiave();
  if (!k) return null;
  return clienteDalCookie(leggiCookie(richiesta.headers.get("cookie"), NOME_COOKIE), k);
}

/** Set-Cookie per ricordare il cliente (400 giorni, rinnovato a ogni uso). */
export function cookieCliente(clienteId: string): string | null {
  const k = chiave();
  return k ? intestazioneCookie(NOME_COOKIE, firmato(clienteId, k), { maxAge: DURATA_COOKIE_S, sicuro: sicuro() }) : null;
}

export const cookieDimentica = () => intestazioneCookie(NOME_COOKIE, "", { maxAge: 0, sicuro: sicuro() });

function hostDaRichiesta(richiesta: Request) {
  return (richiesta.headers.get("x-forwarded-host") ?? richiesta.headers.get("host") ?? new URL(richiesta.url).host).split(",")[0].trim();
}

/** Contro le richieste partite da altri siti: l'intestazione Origin deve
    essere questo stesso sito. SameSite=Lax da solo non basta. */
export function origineValida(richiesta: Request): boolean {
  const origine = richiesta.headers.get("origin");
  if (!origine) return false;
  try {
    return new URL(origine).host === hostDaRichiesta(richiesta);
  } catch {
    return false;
  }
}

export const NO_STORE = { "Cache-Control": "no-store" };

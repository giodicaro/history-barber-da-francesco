import "server-only";
import {
  chiaveCliente,
  clienteDalCookie,
  DURATA_COOKIE_S,
  DURATA_SFIDA_S,
  firmato,
  intestazioneCookie,
  leggiCookie,
  NOME_COOKIE,
  NOME_SFIDA,
} from "./cliente";

/* "Il mio appuntamento", lato server: dal cookie al cliente, e i controlli
   comuni alle rotte (Origin, dominio delle passkey).

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
export const cookieSfida = (valore: string) => intestazioneCookie(NOME_SFIDA, valore, { maxAge: DURATA_SFIDA_S, sicuro: sicuro() });
export const cookieSfidaUsata = () => intestazioneCookie(NOME_SFIDA, "", { maxAge: 0, sicuro: sicuro() });
export const sfidaDaRichiesta = (richiesta: Request) => leggiCookie(richiesta.headers.get("cookie"), NOME_SFIDA);

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

/* Domini su cui le passkey valgono: una passkey è legata al dominio, e
   cambiandolo i clienti dovranno crearne una nuova (bible §11). */
const HOST_PRODUZIONE = "history-barber-da-francesco.vercel.app";

function domini(): string[] {
  const elenco = ["localhost", HOST_PRODUZIONE];
  try {
    if (process.env.AUTH_URL) elenco.push(new URL(process.env.AUTH_URL).hostname);
  } catch {
    // AUTH_URL malformata: resta l'elenco di base.
  }
  return elenco;
}

/** rpID e origin attesi per le passkey, solo per i domini dell'elenco e solo
    se l'Origin della richiesta è quel dominio. */
export function partePasskey(richiesta: Request): { rpID: string; origin: string } | null {
  const origine = richiesta.headers.get("origin");
  if (!origine || !origineValida(richiesta)) return null;
  const url = new URL(origine);
  if (!domini().includes(url.hostname)) return null;
  // Le passkey vogliono https, tranne su localhost.
  if (url.protocol !== "https:" && url.hostname !== "localhost") return null;
  return { rpID: url.hostname, origin: url.origin };
}

/** Freno in memoria, come quello delle prenotazioni: un argine per istanza. */
export function freno(nome: string, massimo: number, finestraMs: number) {
  const mappa = ((globalThis as Record<string, unknown>)[`__freno_${nome}`] ??= new Map<string, number[]>()) as Map<string, number[]>;
  return (richiesta: Request) => {
    const ip = richiesta.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "sconosciuto";
    const adesso = Date.now();
    const recenti = (mappa.get(ip) ?? []).filter((t) => adesso - t < finestraMs);
    mappa.set(ip, [...recenti, adesso]);
    return recenti.length >= massimo;
  };
}

export const NO_STORE = { "Cache-Control": "no-store" };

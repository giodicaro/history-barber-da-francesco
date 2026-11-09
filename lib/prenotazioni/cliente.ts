import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";

/* "Il mio appuntamento": il telefono si ricorda del cliente (N1).

   Funzioni pure, senza Next né database, testate in tests/cliente.test.mjs.

   Il cookie hb_cliente vale "<cliente_id>.<firma>", con la firma HMAC-SHA256
   fatta con una chiave DERIVATA da AUTH_SECRET (HKDF, info "hb-cliente-v1"):
   la chiave della sessione dell'agenda non firma mai niente per i clienti, e
   viceversa. Senza la chiave il cookie non si può falsificare; una firma
   sbagliata vale come cookie assente. */

export const NOME_COOKIE = "hb_cliente";
/** 400 giorni: il massimo che Chrome accetta per un cookie. */
export const DURATA_COOKIE_S = 400 * 24 * 60 * 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Chiave dei cookie dei clienti, da AUTH_SECRET. Null se il segreto manca
    o è troppo corto: il riconoscimento resta spento. */
export function chiaveCliente(segreto: string | undefined): Buffer | null {
  const s = segreto?.trim();
  if (!s || s.length < 32) return null;
  return Buffer.from(hkdfSync("sha256", s, Buffer.alloc(0), "hb-cliente-v1", 32));
}

const firma = (testo: string, chiave: Buffer) => createHmac("sha256", chiave).update(testo).digest("base64url");

function stessaFirma(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** "<valore>.<firma>". */
export const firmato = (valore: string, chiave: Buffer) => `${valore}.${firma(valore, chiave)}`;

/** Il valore se la firma è giusta, altrimenti null. A tempo costante. */
export function verificato(testo: string | undefined, chiave: Buffer): string | null {
  if (!testo || testo.length > 1000) return null;
  const punto = testo.lastIndexOf(".");
  if (punto <= 0) return null;
  const valore = testo.slice(0, punto);
  return stessaFirma(testo.slice(punto + 1), firma(valore, chiave)) ? valore : null;
}

/** Il cliente_id del cookie, o null (assente, malformato, firma sbagliata). */
export function clienteDalCookie(cookie: string | undefined, chiave: Buffer): string | null {
  const id = verificato(cookie, chiave);
  return id && UUID.test(id) ? id.toLowerCase() : null;
}

/** Un'intestazione Set-Cookie. HttpOnly sempre, SameSite=Lax, Path=/. */
export function intestazioneCookie(nome: string, valore: string, opzioni: { maxAge: number; sicuro: boolean }): string {
  return [
    `${nome}=${valore}`,
    "Path=/",
    `Max-Age=${opzioni.maxAge}`,
    "HttpOnly",
    "SameSite=Lax",
    ...(opzioni.sicuro ? ["Secure"] : []),
  ].join("; ");
}

/** Il valore di un cookie dall'intestazione Cookie della richiesta. */
export function leggiCookie(intestazione: string | null, nome: string): string | undefined {
  for (const parte of (intestazione ?? "").split(";")) {
    const uguale = parte.indexOf("=");
    if (uguale > 0 && parte.slice(0, uguale).trim() === nome) return parte.slice(uguale + 1).trim();
  }
  return undefined;
}

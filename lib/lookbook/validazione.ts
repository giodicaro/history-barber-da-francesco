import { normalizzaTelefono } from "@/lib/prenotazioni/telefono";
import { CAMPI_NOTE, POSIZIONI, type CampoNota, type NoteLook, type Posizione, type TipoImmagine } from "./tipi";

/* Controlli del Lookbook, nello stile di lib/prenotazioni/validazione-agenda.ts:
   ogni dato si valida come se arrivasse da uno sconosciuto, anche quando a
   mandarlo è l'interfaccia di Francesco. Nessun import dal server: il modulo
   del browser usa gli stessi limiti per i campi. */

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 32 byte in base64url sono 43 caratteri, senza "=". */
export const TOKEN = /^[A-Za-z0-9_-]{43}$/;

export const MAX_NOME = 80;
/** Note tecniche (sfumatura, sopra, barba, prodotto). */
export const MAX_NOTA = 120;
/** Note libere. */
export const MAX_NOTE_LIBERE = 500;

export const maxCampo = (c: CampoNota) => (c === "note" ? MAX_NOTE_LIBERE : MAX_NOTA);

/* Tetti per le foto. Il browser comprime a ~250 KB (massimo 350); il server
   tiene un margine ma rifiuta il resto: a 3 MB per richiesta si resta lontani
   dal taglio di Vercel (4,5 MB) anche con tre foto e tre miniature. */
export const MAX_FOTO = 400 * 1024;
export const MAX_MINIATURA = 80 * 1024;
export const MAX_RICHIESTA = 3 * 1024 * 1024;

const testo = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function analizzaScheda(grezzo: { nome?: unknown; telefono?: unknown; consenso?: unknown }):
  | { ok: true; nome: string; telefono: string | null }
  | { ok: false; errori: Record<string, string> } {
  const errori: Record<string, string> = {};
  const nome = testo(grezzo.nome).replace(/\s+/g, " ");
  if (nome.length < 2) errori.nome = "Serve il nome del cliente";
  else if (nome.length > MAX_NOME) errori.nome = "Nome troppo lungo";

  const telefonoGrezzo = testo(grezzo.telefono);
  const telefono = telefonoGrezzo ? normalizzaTelefono(telefonoGrezzo) : null;
  if (telefonoGrezzo && !telefono) errori.telefono = "Numero non valido";

  // Il consenso non è una casella da spuntare per forma: senza, la scheda
  // non esiste. Il server lo ricontrolla anche se il bottone era spento.
  if (grezzo.consenso !== true) errori.consenso = "Serve il consenso del cliente";

  if (Object.keys(errori).length > 0) return { ok: false, errori };
  return { ok: true, nome, telefono };
}

export function analizzaNote(grezzo: Record<string, unknown>):
  | { ok: true; note: NoteLook }
  | { ok: false; errori: Record<string, string> } {
  const errori: Record<string, string> = {};
  const note: NoteLook = {};
  for (const campo of CAMPI_NOTE) {
    const valore = testo(grezzo[campo]);
    if (valore.length > maxCampo(campo)) errori[campo] = `Massimo ${maxCampo(campo)} caratteri`;
    else if (valore) note[campo] = valore;
  }
  if (Object.keys(errori).length > 0) return { ok: false, errori };
  return { ok: true, note };
}

export const posizioneValida = (v: unknown): v is Posizione => POSIZIONI.includes(v as Posizione);

/** Il tipo vero di un'immagine, letto dai primi byte: il Content-Type
    dichiarato dal browser non conta. Tutto ciò che non è WebP o JPEG è null. */
export function tipoDaiByte(b: Uint8Array): TipoImmagine | null {
  if (b.length >= 12) {
    const ascii = (da: number, a: number) => String.fromCharCode(...b.subarray(da, a));
    if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  return null;
}

/** Una data di salone "YYYY-MM-DD" valida. */
export const dataValida = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`));

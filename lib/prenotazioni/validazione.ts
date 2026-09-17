import { giornoDellaData, minutiDaOra } from "@/lib/orari";
import { GIORNI_PRENOTABILI, listino, operatori, type Servizio } from "@/lib/salone";
import { generaSlot } from "./slot";
import { normalizzaTelefono } from "./telefono";
import type { Esito, RichiestaPrenotazione } from "./tipi";
import type { Intervallo } from "./slot";

/* Validazione della richiesta di prenotazione, scritta a mano nello stile di
   Zod (analizza → o i dati puliti, o gli errori campo per campo). Nessuna
   libreria: le regole sono cinque e restano leggibili.

   Regola di fondo: il server non si fida di niente di quello che arriva dal
   browser. Prezzo, durata e nome del servizio non vengono letti dal payload
   ma ripresi dal listino. */

export const servizioPerId = (id: string): Servizio | undefined =>
  listino.flatMap((g) => g.servizi).find((s) => s.id === id);

export const servizioPrenotabile = (s: Servizio) => s.prenotabile !== false;

const testo = (v: unknown) => (typeof v === "string" ? v.trim() : "");

// Stessa regola del widget: vedi ./telefono.ts.
export { normalizzaTelefono } from "./telefono";

export interface ContestoValidazione {
  /** "Adesso" secondo l'ora di Roma. */
  adesso: { data: string; minuti: number };
  /** Intervalli già occupati nel giorno richiesto, per l'operatore richiesto. */
  occupati: Intervallo[];
}

export function analizzaRichiesta(
  grezzo: unknown,
  contesto: ContestoValidazione,
): Esito<RichiestaPrenotazione> {
  const errori: Record<string, string> = {};
  const corpo = (typeof grezzo === "object" && grezzo !== null ? grezzo : {}) as Record<string, unknown>;
  const cliente = (typeof corpo.cliente === "object" && corpo.cliente !== null
    ? corpo.cliente
    : {}) as Record<string, unknown>;

  // Servizio
  const servizio = servizioPerId(testo(corpo.servizioId));
  if (!servizio) errori.servizioId = "Servizio non riconosciuto";
  else if (!servizioPrenotabile(servizio))
    errori.servizioId = "Questo servizio si aggiunge a un altro, non si prenota da solo";

  // Operatore: se manca, il primo (oggi c'è solo Francesco).
  const operatoreId = testo(corpo.operatoreId) || operatori[0].id;
  if (!operatori.some((o) => o.id === operatoreId)) errori.operatoreId = "Operatore non riconosciuto";

  // Data
  const data = testo(corpo.data);
  const ultimoGiorno = new Date(`${contesto.adesso.data}T12:00:00Z`);
  ultimoGiorno.setUTCDate(ultimoGiorno.getUTCDate() + GIORNI_PRENOTABILI);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(Date.parse(`${data}T12:00:00Z`)))
    errori.data = "Data non valida";
  else if (data < contesto.adesso.data) errori.data = "Data già passata";
  else if (data > ultimoGiorno.toISOString().slice(0, 10))
    errori.data = `Si prenota fino a ${GIORNI_PRENOTABILI} giorni in avanti`;

  // Ora: deve essere uno degli orari che il server stesso propone. Così un
  // payload costruito a mano non può infilarsi alle 03:00 o dentro la pausa.
  const ora = testo(corpo.ora);
  if (!/^\d{2}:\d{2}$/.test(ora)) errori.ora = "Orario non valido";
  else if (servizio && !errori.data) {
    const proposti = generaSlot({
      data,
      giorno: giornoDellaData(data),
      durata: servizio.durata,
      occupati: contesto.occupati,
      adesso: contesto.adesso,
    });
    const scelto = proposti.find((s) => s.ora === ora);
    if (!scelto) errori.ora = "Orario fuori dagli orari di apertura";
    else if (!scelto.disponibile)
      errori.ora = scelto.motivo === "occupato" ? "Orario appena occupato" : "Orario non più disponibile";
  }

  // Cliente
  const nome = testo(cliente.nome);
  if (nome.length < 2) errori.nome = "Serve il nome";
  else if (nome.length > 60) errori.nome = "Nome troppo lungo";

  const telefonoGrezzo = testo(cliente.telefono);
  const telefono = normalizzaTelefono(telefonoGrezzo);
  if (!telefonoGrezzo) errori.telefono = "Serve il numero di telefono";
  else if (!telefono) errori.telefono = "Numero non valido: cellulare o fisso italiano";

  const note = testo(cliente.note);
  if (note.length > 280) errori.note = "Nota troppo lunga (massimo 280 caratteri)";

  if (Object.keys(errori).length > 0 || !servizio || !telefono) return { ok: false, errori };

  const inizio = minutiDaOra(ora);
  return {
    ok: true,
    dati: {
      data,
      inizio,
      fine: inizio + servizio.durata,
      // Prezzo, durata e nome arrivano dal listino, non dal client.
      servizioId: servizio.id,
      servizioNome: servizio.nome,
      prezzo: servizio.prezzo,
      operatoreId,
      cliente: { nome, telefono, ...(note ? { note } : {}) },
      ...(testo(corpo.origine) ? { origine: testo(corpo.origine) } : {}),
    },
  };
}

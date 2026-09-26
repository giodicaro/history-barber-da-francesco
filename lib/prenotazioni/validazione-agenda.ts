import { minutiDaOra } from "@/lib/orari";
import { operatori } from "@/lib/salone";
import { SERVIZIO_LIBERO, turnoDi } from "./agenda";
import { normalizzaTelefono } from "./telefono";
import type { DatiAppuntamento, DatiBlocco, Esito, NuovaVoce } from "./tipi";
import { servizioPerId, servizioPrenotabile } from "./validazione";

/* Validazione dei moduli dell'agenda. Stesso stile di ./validazione.ts, ma
   regole diverse: qui scrive Francesco, non un cliente sconosciuto.
   - prezzo e durata sono suoi: li può cambiare rispetto al listino (un
     cliente abituale, un lavoro più lungo);
   - il telefono è facoltativo (cliente di passaggio);
   - si può scrivere nel passato (segnare chi è entrato senza prenotare).
   Resta fermo che l'inizio cada dentro l'orario di apertura: fuori orario
   l'agenda non ha righe su cui mostrarlo. La fine invece può sforare la
   chiusura di qualche minuto, succede. */

const testo = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const intero = (v: unknown) => (typeof v === "number" && Number.isInteger(v) ? v : Number.NaN);

const DURATA_MAX = 8 * 60;

function dataEOra(dati: { data?: unknown; ora?: unknown; durata?: unknown }, errori: Record<string, string>) {
  const data = testo(dati.data);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(Date.parse(`${data}T12:00:00Z`))) {
    errori.data = "Data non valida";
  }
  const ora = testo(dati.ora);
  const inizio = /^\d{2}:\d{2}$/.test(ora) ? minutiDaOra(ora) : Number.NaN;
  if (Number.isNaN(inizio) || inizio >= 1440) errori.ora = "Orario non valido";
  else if (!errori.data && !turnoDi(data, inizio)) errori.ora = "Il salone a quell'ora è chiuso";

  const durata = intero(dati.durata);
  if (!(durata >= 5 && durata <= DURATA_MAX)) errori.durata = "Durata non valida";
  else if (inizio + durata > 1440) errori.durata = "Finirebbe dopo mezzanotte";

  return { data, inizio, fine: inizio + durata };
}

export function analizzaAppuntamento(grezzo: unknown): Esito<NuovaVoce> {
  const dati = (typeof grezzo === "object" && grezzo !== null ? grezzo : {}) as Partial<
    Record<keyof DatiAppuntamento, unknown>
  >;
  const errori: Record<string, string> = {};
  const { data, inizio, fine } = dataEOra(dati, errori);

  const servizioId = testo(dati.servizioId);
  let servizioNome = "";
  if (servizioId === SERVIZIO_LIBERO) {
    servizioNome = testo(dati.servizioNome);
    if (servizioNome.length < 2) errori.servizioNome = "Scrivi che servizio è";
    else if (servizioNome.length > 60) errori.servizioNome = "Nome del servizio troppo lungo";
  } else {
    const servizio = servizioPerId(servizioId);
    if (!servizio || !servizioPrenotabile(servizio)) errori.servizioId = "Scegli un servizio";
    else servizioNome = servizio.nome;
  }

  const prezzo = intero(dati.prezzo);
  if (!(prezzo >= 0 && prezzo <= 9999)) errori.prezzo = "Prezzo non valido (euro interi)";

  const nome = testo(dati.nome);
  if (nome.length < 2) errori.nome = "Serve il nome del cliente";
  else if (nome.length > 60) errori.nome = "Nome troppo lungo";

  const telefonoGrezzo = testo(dati.telefono);
  const telefono = telefonoGrezzo ? normalizzaTelefono(telefonoGrezzo) : undefined;
  if (telefono === null) errori.telefono = "Numero non valido";

  if (Object.keys(errori).length > 0) return { ok: false, errori };
  return {
    ok: true,
    dati: {
      tipo: "appuntamento",
      data,
      inizio,
      fine,
      servizioId,
      servizioNome,
      prezzo,
      operatoreId: operatori[0].id,
      cliente: { nome, ...(telefono ? { telefono } : {}) },
      origine: "agenda",
    },
  };
}

export function analizzaBlocco(grezzo: unknown): Esito<NuovaVoce> {
  const dati = (typeof grezzo === "object" && grezzo !== null ? grezzo : {}) as Partial<
    Record<keyof DatiBlocco, unknown>
  >;
  const errori: Record<string, string> = {};
  const { data, inizio, fine } = dataEOra(dati, errori);
  const motivo = testo(dati.motivo);
  if (motivo.length > 60) errori.motivo = "Motivo troppo lungo";

  if (Object.keys(errori).length > 0) return { ok: false, errori };
  return {
    ok: true,
    dati: {
      tipo: "blocco",
      data,
      inizio,
      fine,
      operatoreId: operatori[0].id,
      ...(motivo ? { motivo } : {}),
    },
  };
}

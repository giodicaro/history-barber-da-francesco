import "server-only";
import { formatoOra, giornoDellaData, oraDiRoma, sommaGiorni, turniDellaGiornata } from "@/lib/orari";
import { GIORNI_PRENOTABILI, MARGINE_GESTIONE_MINUTI, orari, SPOSTAMENTI_MAX } from "@/lib/salone";
import { appuntamentoDelCodice, appuntamentoDelToken, occupatiConId, type AppuntamentoGestito } from "./archivio";
import { codiceCompleto } from "./codice";
import { impronta, improntaCodice, puoGestire, slotPerSpostamento, TOKEN_GESTIONE, type StatoGestione } from "./gestione";
import { normalizzaTelefono } from "./telefono";
import type { RispostaSlot } from "./tipi";
import { servizioPerId } from "./validazione";

/* "Gestisci il tuo appuntamento", lato server: dalla credenziale
   all'appuntamento, e ciò che il cliente vede. Lo usano l'API
   (app/api/appuntamento) e la pagina del link (app/appuntamento/[token]). */

export type Credenziale = { token: string } | { telefono: string; codice: string };

export const REGOLE = { margineMinuti: MARGINE_GESTIONE_MINUTI, spostamentiMax: SPOSTAMENTI_MAX };

export function leggiCredenziale(v: unknown): Credenziale | null {
  const c = v as Record<string, unknown> | null;
  if (typeof c?.token === "string") return { token: c.token };
  if (typeof c?.telefono === "string" && typeof c?.codice === "string") return { telefono: c.telefono, codice: c.codice };
  return null;
}

/** L'appuntamento della credenziale, o null. Credenziale sbagliata e
    appuntamento inesistente sono la stessa cosa per chi chiama: si fa
    comunque una ricerca per impronta, anche con dati malformati, perché i
    tempi di risposta non dicano niente. */
export async function trovaAppuntamento(c: Credenziale): Promise<AppuntamentoGestito | null> {
  if ("token" in c) {
    const a = await appuntamentoDelToken(impronta(c.token));
    return TOKEN_GESTIONE.test(c.token) ? a : null;
  }
  const telefono = normalizzaTelefono(c.telefono) ?? c.telefono.slice(0, 20);
  const a = await appuntamentoDelCodice(improntaCodice(telefono, c.codice), oraDiRoma().data);
  return codiceCompleto(c.codice) ? a : null;
}

export const statoDi = (a: AppuntamentoGestito, adessoIstante = Date.now()): StatoGestione => puoGestire(a, adessoIstante, REGOLE);

/** Ciò che il cliente vede del suo appuntamento: niente telefono, il solo
    nome di battesimo. */
export function riepilogo(a: AppuntamentoGestito, adessoIstante = Date.now()) {
  const stato = statoDi(a, adessoIstante);
  return {
    id: a.id,
    data: a.data,
    ora: formatoOra(a.inizio),
    finisceAlle: formatoOra(a.fine),
    inizio: a.inizio,
    fine: a.fine,
    servizio: a.servizioNome,
    prezzo: a.prezzo,
    nome: a.cliente.nome.trim().split(/\s+/)[0] ?? "",
    modificabile: stato.disdicibile,
    disdicibile: stato.disdicibile,
    spostabile: stato.spostabile,
    ...(stato.motivoBlocco ? { motivoBlocco: stato.motivoBlocco } : {}),
    spostamentiRimasti: stato.spostamentiRimasti,
    termine: { data: stato.termine.data, ora: formatoOra(stato.termine.minuti) },
  };
}

export type Riepilogo = ReturnType<typeof riepilogo>;

/** Le date fra cui si può spostare: da oggi a GIORNI_PRENOTABILI in avanti. */
export function dataSpostabile(data: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(Date.parse(`${data}T12:00:00Z`))) return false;
  const oggi = oraDiRoma().data;
  return data >= oggi && data <= sommaGiorni(oggi, GIORNI_PRENOTABILI);
}

/** Orari di un giorno per spostare: come GET /api/bookings, ma con la durata
    dell'appuntamento e senza l'appuntamento stesso fra gli occupati. */
export async function orariPerSpostamento(a: AppuntamentoGestito, data: string): Promise<RispostaSlot & { proprio: string | null }> {
  const giorno = giornoDellaData(data);
  const slot = slotPerSpostamento({
    id: a.id,
    data,
    giorno,
    durata: a.fine - a.inizio,
    occupati: await occupatiConId(data, a.operatoreId),
    adesso: oraDiRoma(),
  });
  return {
    data,
    giorno,
    giornoNome: orari[giorno].giorno,
    aperto: turniDellaGiornata(data).length > 0,
    servizio: {
      id: a.servizioId,
      nome: a.servizioNome,
      durata: a.fine - a.inizio,
      prezzo: servizioPerId(a.servizioId)?.prezzo ?? a.prezzo,
    },
    slot,
    liberi: slot.filter((s) => s.disponibile).length,
    proprio: data === a.data ? formatoOra(a.inizio) : null,
  };
}

/** I primi giorni (al massimo `quanti`) con almeno un orario libero, per
    chi trova pieno il giorno che voleva. */
export async function prossimiGiorniLiberi(a: AppuntamentoGestito, escludi: string, quanti = 3) {
  const oggi = oraDiRoma().data;
  const trovati: { data: string; liberi: number }[] = [];
  for (let i = 0; i <= GIORNI_PRENOTABILI && trovati.length < quanti; i++) {
    const data = sommaGiorni(oggi, i);
    if (data === escludi || turniDellaGiornata(data).length === 0) continue;
    const { liberi } = await orariPerSpostamento(a, data);
    if (liberi > 0) trovati.push({ data, liberi });
  }
  return trovati;
}

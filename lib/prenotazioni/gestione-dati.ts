import "server-only";
import { formatoOra } from "@/lib/orari";
import { MARGINE_GESTIONE_MINUTI, RIPENSAMENTO_MINUTI, ULTIMO_AVVISO_MINUTI } from "@/lib/salone";
import { appuntamentoDelCliente, appuntamentoDelToken } from "./archivio";
import { impronta, puoGestire, TOKEN_GESTIONE, type RegoleGestione, type StatoGestione } from "./gestione";
import type { Prenotazione } from "./tipi";

/* "Gestisci il tuo appuntamento", lato server: dalla credenziale
   all'appuntamento, e ciò che il cliente vede. Lo usano l'API
   (app/api/appuntamento) e la pagina del link (app/appuntamento/[token]). */

/* v2: { prenotazioneId } vale solo insieme al cookie del cliente.
   v1: il token del link, consegnato fino al 30/10/2026, vale finché il suo
   appuntamento non è passato (bible §11). */
export type Credenziale = { prenotazioneId: string } | { token: string };

export const REGOLE: RegoleGestione = {
  margineMinuti: MARGINE_GESTIONE_MINUTI,
  ripensamentoMinuti: RIPENSAMENTO_MINUTI,
  ultimoAvvisoMinuti: ULTIMO_AVVISO_MINUTI,
};

export function leggiCredenziale(v: unknown): Credenziale | null {
  const c = v as Record<string, unknown> | null;
  if (typeof c?.prenotazioneId === "string") return { prenotazioneId: c.prenotazioneId };
  if (typeof c?.token === "string") return { token: c.token };
  return null;
}

/** L'appuntamento della credenziale, o null. Credenziale sbagliata e
    appuntamento inesistente sono la stessa cosa per chi chiama: si fa
    comunque una ricerca per impronta, anche con dati malformati, perché i
    tempi di risposta non dicano niente. */
export async function trovaAppuntamento(c: Credenziale, clienteId: string | null = null): Promise<Prenotazione | null> {
  if ("prenotazioneId" in c) return clienteId ? appuntamentoDelCliente(c.prenotazioneId, clienteId) : null;
  const a = await appuntamentoDelToken(impronta(c.token));
  return TOKEN_GESTIONE.test(c.token) ? a : null;
}

export const statoDi = (a: Prenotazione, adessoIstante = Date.now()): StatoGestione => puoGestire(a, adessoIstante, REGOLE);

/** Ciò che il cliente vede del suo appuntamento: niente telefono, il solo
    nome di battesimo. */
export function riepilogo(a: Prenotazione, adessoIstante = Date.now()) {
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
    disdicibile: stato.disdicibile,
    ...(stato.motivoBlocco ? { motivoBlocco: stato.motivoBlocco } : {}),
    termine: { data: stato.termine.data, ora: formatoOra(stato.termine.minuti) },
    ...(stato.fineRipensamento
      ? { fineRipensamento: { data: stato.fineRipensamento.data, ora: formatoOra(stato.fineRipensamento.minuti) } }
      : {}),
    inRipensamento: stato.inRipensamento,
  };
}

export type Riepilogo = ReturnType<typeof riepilogo>;

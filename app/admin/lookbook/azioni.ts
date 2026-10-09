"use server";

import { refresh } from "next/cache";
import { auth } from "@/auth";
import {
  creaScheda,
  eliminaLook,
  eliminaScheda,
  LookbookNonPronto,
  perLog,
  rigeneraToken,
  segnaPreferito,
  TelefonoGiaPresente,
} from "@/lib/lookbook/archivio";
import type { EsitoLookbook } from "@/lib/lookbook/tipi";
import { analizzaScheda } from "@/lib/lookbook/validazione";

/* Server Action del lookbook, lato barbiere: le scritture piccole (scheda,
   preferito, link, cancellazioni). Le foto passano da POST /api/lookbook,
   perché le Server Action hanno un tetto di 1 MB sul corpo.

   Stesse regole di app/admin/azioni.ts: sessione per prima cosa, dati
   validati come se arrivassero da uno sconosciuto, refresh() per ridisegnare
   la pagina nella stessa risposta. */

async function autorizzato() {
  return Boolean((await auth())?.user);
}

const NON_AUTORIZZATO = { ok: false, errore: "Sessione scaduta: rientra nell'agenda." } as const;

// Il database non risponde, o lo schema nuovo non c'è: un messaggio chiaro
// nel foglio invece della pagina d'errore.
function guasto(e: unknown, cosa: string): EsitoLookbook<never> {
  if (e instanceof LookbookNonPronto) {
    return { ok: false, errore: "Il lookbook non è ancora attivo su questo database (npm run db:init)." };
  }
  console.error(`[lookbook] ${cosa} non riuscito`, perLog(e));
  return { ok: false, errore: "Non è andata a buon fine. Riprova." };
}

/** Crea la scheda con il consenso del cliente. Se il telefono ha già una
    scheda restituisce quella, con `esistente`. */
export async function creaSchedaCliente(dati: {
  nome: string;
  telefono: string;
  consenso: boolean;
}): Promise<EsitoLookbook<{ id: string; esistente?: true }>> {
  if (!(await autorizzato())) return NON_AUTORIZZATO;
  const analisi = analizzaScheda(dati ?? {});
  if (!analisi.ok) return { ok: false, errore: "Controlla i campi segnati.", campi: analisi.errori };
  try {
    return { ok: true, id: await creaScheda(analisi.nome, analisi.telefono) };
  } catch (e) {
    if (e instanceof TelefonoGiaPresente) return { ok: true, id: e.idEsistente, esistente: true };
    return guasto(e, "creazione della scheda");
  }
}

export async function eliminaSchedaCliente(id: string): Promise<EsitoLookbook> {
  if (!(await autorizzato())) return NON_AUTORIZZATO;
  try {
    // Già sparita (cancellata da un altro dispositivo): l'effetto è quello voluto.
    await eliminaScheda(String(id));
  } catch (e) {
    return guasto(e, "cancellazione della scheda");
  }
  return { ok: true };
}

/** Nuovo link per il cliente: quello vecchio smette subito di funzionare. */
export async function rigeneraLink(id: string): Promise<EsitoLookbook> {
  if (!(await autorizzato())) return NON_AUTORIZZATO;
  try {
    if (!(await rigeneraToken(String(id)))) return { ok: false, errore: "Questa scheda non esiste più." };
  } catch (e) {
    return guasto(e, "rigenerazione del link");
  }
  refresh();
  return { ok: true };
}

export async function cambiaPreferito(lookId: string, preferito: boolean): Promise<EsitoLookbook> {
  if (!(await autorizzato())) return NON_AUTORIZZATO;
  try {
    if (!(await segnaPreferito(String(lookId), preferito === true))) {
      return { ok: false, errore: "Questo look non c'è più." };
    }
  } catch (e) {
    return guasto(e, "cambio del preferito");
  }
  refresh();
  return { ok: true };
}

export async function eliminaLookCliente(lookId: string): Promise<EsitoLookbook> {
  if (!(await autorizzato())) return NON_AUTORIZZATO;
  try {
    await eliminaLook(String(lookId));
  } catch (e) {
    return guasto(e, "cancellazione del look");
  }
  refresh();
  return { ok: true };
}

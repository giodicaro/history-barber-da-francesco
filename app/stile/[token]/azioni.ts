"use server";

import { refresh } from "next/cache";
import { LookbookNonPronto, perLog, segnaPreferitoDelToken } from "@/lib/lookbook/archivio";
import type { EsitoLookbook } from "@/lib/lookbook/tipi";

/* L'unica scrittura concessa al cliente: segnare (o togliere) un look come
   preferito, "il taglio che voglio rifare". Pubblica come ogni Server
   Action, quindi autorizzata solo dal token, e solo sui look di quel
   cliente: il controllo è nello SQL di segnaPreferitoDelToken. */

export async function segnaPreferitoCliente(token: string, lookId: string, preferito: boolean): Promise<EsitoLookbook> {
  try {
    if (!(await segnaPreferitoDelToken(String(token), String(lookId), preferito === true))) {
      return { ok: false, errore: "Questo taglio non è più disponibile." };
    }
  } catch (e) {
    if (!(e instanceof LookbookNonPronto)) console.error("[lookbook] preferito del cliente non riuscito", perLog(e));
    return { ok: false, errore: "Non è andata a buon fine. Riprova." };
  }
  refresh();
  return { ok: true };
}

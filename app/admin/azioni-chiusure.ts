"use server";

import { refresh } from "next/cache";
import { auth } from "@/auth";
import { sovrapposte, unione, validaChiusura, type Chiusura, type ErroriChiusura } from "@/lib/chiusure";
import { formatoOra, oraDiRoma } from "@/lib/orari";
import { appuntamentiNelPeriodo } from "@/lib/prenotazioni/archivio";
import {
  aggiornaChiusura,
  creaChiusura,
  elencoChiusure,
  eliminaChiusura,
  impostaAttiva,
  unisciChiusure,
} from "@/lib/prenotazioni/chiusure";
import { salone } from "@/lib/salone";

/* Server Action di "Chiusure e ferie". Come quelle dell'agenda (azioni.ts):
   sessione controllata per prima cosa, dati validati come se arrivassero da
   uno sconosciuto. Mai disdire o spostare appuntamenti da qui: i conflitti si
   mostrano, decide Francesco. */

async function autorizzato() {
  return Boolean((await auth())?.user);
}

export type DatiChiusura = { id?: string; dal: string; al: string; motivo?: string };

/** Un appuntamento che cade in una chiusura: Francesco decide cosa farne. */
export type Conflitto = {
  id: string;
  data: string;
  ora: string;
  cliente: string;
  telefono?: string;
  servizio: string;
  /** wa.me con il messaggio già pronto, se c'è il telefono. */
  whatsapp?: string;
};

export type EsitoChiusura =
  | { ok: true; chiusura?: Chiusura; messaggio: string }
  | {
      ok: false;
      errore: string;
      campi?: ErroriChiusura;
      /** Si sovrappone (o si tocca) con queste: si possono unire. */
      sovrapposte?: Chiusura[];
    };

export type Verifica =
  | { ok: true; conflitti: Conflitto[]; sovrapposte: Chiusura[] }
  | { ok: false; errore: string; campi?: ErroriChiusura };

const NON_AUTORIZZATO = { ok: false as const, errore: "Sessione scaduta: rientra nell'agenda." };

const giornoLungo = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

function pulisci(d: DatiChiusura): DatiChiusura {
  return {
    ...(typeof d?.id === "string" ? { id: d.id } : {}),
    dal: String(d?.dal ?? "").trim(),
    al: String(d?.al ?? "").trim(),
    motivo: String(d?.motivo ?? "").trim().slice(0, 120) || undefined,
  };
}

async function conflittiDi(dal: string, al: string, motivo?: string): Promise<Conflitto[]> {
  return (await appuntamentiNelPeriodo(dal, al)).map((a) => {
    const quando = `${giornoLungo.format(new Date(`${a.data}T12:00:00Z`))} alle ${formatoOra(a.inizio)}`;
    const testo = `Ciao ${a.cliente.nome.split(" ")[0]}, ti scrivo da ${salone.nomeCompleto}: ${quando} il salone sarà chiuso${motivo ? ` (${motivo})` : ""}. Possiamo spostare il tuo appuntamento a un altro giorno?`;
    return {
      id: a.id,
      data: a.data,
      ora: formatoOra(a.inizio),
      cliente: a.cliente.nome,
      ...(a.cliente.telefono ? { telefono: a.cliente.telefono } : {}),
      servizio: a.servizioNome,
      ...(a.cliente.telefono
        ? { whatsapp: `https://wa.me/${a.cliente.telefono.replace(/\D/g, "")}?text=${encodeURIComponent(testo)}` }
        : {}),
    };
  });
}

/** Prima di salvare (o di riattivare): errori, appuntamenti in quei giorni,
    chiusure con cui si sovrappone. Non scrive niente. */
export async function verificaChiusura(grezzi: DatiChiusura): Promise<Verifica> {
  if (!(await autorizzato())) return NON_AUTORIZZATO;
  const d = pulisci(grezzi);
  const errori = validaChiusura(d, oraDiRoma().data);
  if (Object.keys(errori).length) return { ok: false, errore: "Controlla le date.", campi: errori };
  const altre = (await elencoChiusure()).filter((c) => c.id !== d.id && sovrapposte(c, d));
  return { ok: true, conflitti: await conflittiDi(d.dal, d.al, d.motivo), sovrapposte: altre };
}

/** Salva (crea o modifica). Con unisci, la chiusura assorbe quelle con cui
    si sovrappone e diventa una sola. */
export async function salvaChiusura(grezzi: DatiChiusura, opzioni: { unisci?: boolean } = {}): Promise<EsitoChiusura> {
  if (!(await autorizzato())) return NON_AUTORIZZATO;
  const d = pulisci(grezzi);
  const errori = validaChiusura(d, oraDiRoma().data);
  if (Object.keys(errori).length) return { ok: false, errore: "Controlla le date.", campi: errori };

  const altre = (await elencoChiusure()).filter((c) => c.id !== d.id && sovrapposte(c, d));
  if (altre.length && !opzioni.unisci) {
    return { ok: false, errore: "Si sovrappone a un'altra chiusura: puoi unirle in una sola.", sovrapposte: altre };
  }

  try {
    let chiusura: Chiusura | null;
    if (altre.length) {
      const periodo = { ...unione([d, ...altre]), motivo: d.motivo ?? altre.find((a) => a.motivo)?.motivo };
      chiusura = await unisciChiusure([...(d.id ? [d.id] : []), ...altre.map((a) => a.id)], periodo);
      if (!chiusura && !d.id) chiusura = await creaChiusura(periodo);
    } else {
      chiusura = d.id ? await aggiornaChiusura(d.id, d) : await creaChiusura(d);
    }
    if (!chiusura) return { ok: false, errore: "Questa chiusura non c'è più." };
    refresh();
    return { ok: true, chiusura, messaggio: altre.length ? "Chiusure unite e salvate." : "Chiusura salvata." };
  } catch (e) {
    console.error("[chiusure] salvataggio non riuscito", e);
    return { ok: false, errore: "Non è stato possibile salvare. Riprova." };
  }
}

export async function cambiaAttiva(id: string, attiva: boolean): Promise<EsitoChiusura> {
  if (!(await autorizzato())) return NON_AUTORIZZATO;
  try {
    const chiusura = await impostaAttiva(String(id), Boolean(attiva));
    if (!chiusura) return { ok: false, errore: "Questa chiusura non c'è più." };
    refresh();
    return { ok: true, chiusura, messaggio: attiva ? "Chiusura riattivata." : "Chiusura disattivata: quei giorni tornano prenotabili." };
  } catch (e) {
    console.error("[chiusure] cambio non riuscito", e);
    return { ok: false, errore: "Non è stato possibile salvare. Riprova." };
  }
}

export async function eliminaChiusuraAzione(id: string): Promise<EsitoChiusura> {
  if (!(await autorizzato())) return NON_AUTORIZZATO;
  try {
    if (!(await eliminaChiusura(String(id)))) return { ok: false, errore: "Questa chiusura non c'è più." };
    refresh();
    return { ok: true, messaggio: "Chiusura eliminata." };
  } catch (e) {
    console.error("[chiusure] eliminazione non riuscita", e);
    return { ok: false, errore: "Non è stato possibile eliminare. Riprova." };
  }
}

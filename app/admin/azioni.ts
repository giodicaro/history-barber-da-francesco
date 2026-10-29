"use server";

import { refresh } from "next/cache";
import { auth } from "@/auth";
import {
  aggiornaVoce,
  ConflittoOrario,
  creaVoce,
  eliminaVoce,
  voce as leggiVoce,
  vociDelGiorno,
  VoceNonTrovata,
} from "@/lib/prenotazioni/archivio";
import { etichettaVoce, primaSovrapposta } from "@/lib/prenotazioni/agenda";
import type { DatiAppuntamento, DatiBlocco, EsitoAzione, NuovaVoce } from "@/lib/prenotazioni/tipi";
import { analizzaAppuntamento, analizzaBlocco } from "@/lib/prenotazioni/validazione-agenda";
import {
  inviaATutti,
  iscrizioneValida,
  notificheConfigurate,
  salvaIscrizione,
  togliIscrizione,
} from "@/lib/prenotazioni/notifiche";

/* Server Action dell'agenda. Ognuna è un endpoint pubblico a tutti gli
   effetti (chiunque può chiamarla senza passare dall'interfaccia), quindi:
   1. controlla la sessione, sempre, per prima cosa;
   2. valida i dati come se arrivassero da uno sconosciuto;
   3. lascia al vincolo del database l'ultima parola sulle sovrapposizioni.
   Dopo una scrittura `refresh()` fa ridisegnare la pagina con i dati nuovi
   nella stessa risposta: statistiche e timeline si aggiornano da sole. */

async function autorizzato() {
  const sessione = await auth();
  return Boolean(sessione?.user);
}

const NON_AUTORIZZATO: EsitoAzione = {
  ok: false,
  errore: "Sessione scaduta: rientra nell'agenda.",
};

// Messaggio chiaro quando il database rifiuta per sovrapposizione: con chi.
async function spiegaConflitto(v: NuovaVoce, escludi?: string): Promise<EsitoAzione> {
  const scontro = primaSovrapposta(await vociDelGiorno(v.data), v, escludi);
  return {
    ok: false,
    errore: scontro ? `Si sovrappone a ${etichettaVoce(scontro)}.` : "Orario già occupato.",
    campi: { ora: "Orario occupato" },
  };
}

async function scrivi(
  analisi: ReturnType<typeof analizzaAppuntamento>,
  id?: string,
): Promise<EsitoAzione> {
  if (!analisi.ok) {
    return { ok: false, errore: "Controlla i campi segnati.", campi: analisi.errori };
  }
  let dati = analisi.dati;
  try {
    if (id) {
      // La modifica non tocca quello che il modulo non mostra: la nota
      // scritta dal cliente e il bottone da cui ha prenotato restano.
      const prima = await leggiVoce(id);
      if (!prima) throw new VoceNonTrovata();
      if (prima.tipo === "appuntamento" && dati.tipo === "appuntamento") {
        dati = {
          ...dati,
          cliente: { ...dati.cliente, ...(prima.cliente.note ? { note: prima.cliente.note } : {}) },
          origine: prima.origine ?? dati.origine,
        };
      }
      await aggiornaVoce(id, dati);
    } else {
      await creaVoce(dati);
    }
  } catch (e) {
    if (e instanceof ConflittoOrario) return spiegaConflitto(dati, id);
    if (e instanceof VoceNonTrovata) {
      refresh();
      return { ok: false, errore: "Questo appuntamento non c'è più: forse è stato appena cancellato." };
    }
    console.error("[agenda] scrittura non riuscita", e);
    return { ok: false, errore: "Salvataggio non riuscito. Riprova." };
  }
  refresh();
  return { ok: true };
}

export async function salvaAppuntamento(dati: DatiAppuntamento, id?: string): Promise<EsitoAzione> {
  if (!(await autorizzato())) return NON_AUTORIZZATO;
  return scrivi(analizzaAppuntamento(dati), id);
}

export async function salvaBlocco(dati: DatiBlocco, id?: string): Promise<EsitoAzione> {
  if (!(await autorizzato())) return NON_AUTORIZZATO;
  return scrivi(analizzaBlocco(dati), id);
}

/** Annulla un appuntamento o toglie un blocco. */
export async function elimina(id: string): Promise<EsitoAzione> {
  if (!(await autorizzato())) return NON_AUTORIZZATO;
  try {
    await eliminaVoce(id);
  } catch (e) {
    if (!(e instanceof VoceNonTrovata)) {
      console.error("[agenda] cancellazione non riuscita", e);
      return { ok: false, errore: "Cancellazione non riuscita. Riprova." };
    }
    // Già sparito (cancellato da un altro dispositivo): per chi guarda
    // l'effetto è quello voluto.
  }
  refresh();
  return { ok: true };
}

/* ── Notifiche sul telefono ─────────────────────────────────────────────── */

/** Registra questo dispositivo: riceverà una notifica a ogni prenotazione. */
export async function attivaNotifiche(iscrizione: unknown, etichetta: string): Promise<EsitoAzione> {
  if (!(await autorizzato())) return NON_AUTORIZZATO;
  if (!notificheConfigurate()) return { ok: false, errore: "Notifiche non configurate sul server (chiavi VAPID)." };
  if (!iscrizioneValida(iscrizione)) return { ok: false, errore: "Iscrizione del dispositivo non valida." };
  await salvaIscrizione(iscrizione, etichetta.trim().slice(0, 60) || null);
  return { ok: true };
}

export async function disattivaNotifiche(endpoint: string): Promise<EsitoAzione> {
  if (!(await autorizzato())) return NON_AUTORIZZATO;
  if (typeof endpoint !== "string" || endpoint.length > 1000) return { ok: false, errore: "Dispositivo non valido." };
  await togliIscrizione(endpoint);
  return { ok: true };
}

/** Manda una notifica di prova a tutti i dispositivi iscritti. */
export async function notificaDiProva(): Promise<EsitoAzione & { inviate?: number }> {
  if (!(await autorizzato())) return NON_AUTORIZZATO;
  const { inviate, fallite } = await inviaATutti({
    titolo: "Notifiche attive",
    testo: "Da ora ogni prenotazione dal sito arriva qui.",
    url: "/admin",
    tag: "prova",
  });
  if (inviate === 0) {
    return {
      ok: false,
      errore: fallite ? "Il servizio di notifiche ha rifiutato l'invio. Riattiva le notifiche." : "Nessun dispositivo iscritto.",
    };
  }
  return { ok: true, inviate };
}

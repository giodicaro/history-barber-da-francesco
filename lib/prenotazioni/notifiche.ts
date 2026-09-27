import "server-only";
import webpush from "web-push";
import { formatoOra } from "@/lib/orari";
import { db } from "./db";
import type { Prenotazione } from "./tipi";

/* Notifiche sul telefono di chi usa l'agenda (Web Push).

   Niente app da installare e niente servizi a pagamento: il telefono si
   iscrive dall'agenda stessa (bottone "Attiva notifiche"), il server salva
   l'indirizzo in `iscrizioni_push` e a ogni prenotazione dal sito manda un
   messaggio cifrato al servizio di notifiche del produttore (Apple, Google,
   Mozilla), che lo recapita.

   Sull'iPhone funziona da iOS 16.4, e solo con l'agenda aggiunta alla
   schermata Home da Safari: in una scheda normale Apple non lo permette.

   Servono tre variabili (vedi .env.example): VAPID_PUBLIC_KEY,
   VAPID_PRIVATE_KEY e VAPID_SUBJECT. Sono la "firma" del sito presso quei
   servizi. Senza, il bottone non compare e non parte niente.

   Come per Telegram: una notifica che non parte non deve mai far fallire la
   prenotazione. Qui non si lancia verso chi chiama. */

const PUBBLICA = process.env.VAPID_PUBLIC_KEY ?? "";
const PRIVATA = process.env.VAPID_PRIVATE_KEY ?? "";
const SOGGETTO = process.env.VAPID_SUBJECT ?? "https://history-barber-da-francesco.vercel.app";

export const notificheConfigurate = () => Boolean(PUBBLICA && PRIVATA);

/** Chiave pubblica da passare al browser per l'iscrizione (non è un segreto). */
export const chiavePubblica = () => (notificheConfigurate() ? PUBBLICA : null);

let pronto = false;
function prepara() {
  if (!pronto) {
    webpush.setVapidDetails(SOGGETTO, PUBBLICA, PRIVATA);
    pronto = true;
  }
}

export interface Iscrizione {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export function iscrizioneValida(v: unknown): v is Iscrizione {
  const i = v as Iscrizione;
  return (
    typeof i?.endpoint === "string" &&
    /^https:\/\//.test(i.endpoint) &&
    i.endpoint.length < 1000 &&
    typeof i.keys?.p256dh === "string" &&
    typeof i.keys?.auth === "string" &&
    i.keys.p256dh.length < 200 &&
    i.keys.auth.length < 100
  );
}

export async function salvaIscrizione(i: Iscrizione, etichetta: string | null) {
  await (await db()).query(
    `insert into iscrizioni_push (endpoint, p256dh, auth, etichetta) values ($1, $2, $3, $4)
     on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth,
       etichetta = excluded.etichetta`,
    [i.endpoint, i.keys.p256dh, i.keys.auth, etichetta],
  );
}

export async function togliIscrizione(endpoint: string) {
  await (await db()).query(`delete from iscrizioni_push where endpoint = $1`, [endpoint]);
}

export async function contaIscrizioni(): Promise<number> {
  const [r] = await (await db()).query<{ n: number }>(`select count(*)::int as n from iscrizioni_push`);
  return r?.n ?? 0;
}

export interface Messaggio {
  titolo: string;
  testo: string;
  /** Pagina da aprire al tocco sulla notifica. */
  url: string;
  /** Notifiche con lo stesso tag si sostituiscono invece di accumularsi. */
  tag?: string;
}

/** Manda a tutti i dispositivi iscritti. Restituisce quanti l'hanno ricevuta. */
export async function inviaATutti(m: Messaggio): Promise<{ inviate: number; fallite: number }> {
  if (!notificheConfigurate()) {
    console.info("[notifiche] non configurate (mancano le chiavi VAPID):", m.titolo);
    return { inviate: 0, fallite: 0 };
  }
  prepara();
  const iscritti = await (await db()).query<{ endpoint: string; p256dh: string; auth: string }>(
    `select endpoint, p256dh, auth from iscrizioni_push`,
  );
  const corpo = JSON.stringify(m);
  const esiti = await Promise.all(
    iscritti.map(async (r) => {
      try {
        await webpush.sendNotification(
          { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } },
          corpo,
          // Se il telefono è spento la notifica aspetta al massimo un giorno;
          // "high" la fa arrivare subito anche con il risparmio energetico.
          { TTL: 60 * 60 * 24, urgency: "high", timeout: 5000 },
        );
        return true;
      } catch (e) {
        const stato = (e as { statusCode?: number }).statusCode;
        // 404/410: il telefono ha tolto il permesso o disinstallato l'agenda.
        // L'iscrizione non vale più: si cancella, così non si riprova ogni volta.
        if (stato === 404 || stato === 410) await togliIscrizione(r.endpoint).catch(() => {});
        else console.error("[notifiche] invio non riuscito", stato ?? e);
        return false;
      }
    }),
  );
  const inviate = esiti.filter(Boolean).length;
  return { inviate, fallite: esiti.length - inviate };
}

const giornoBreve = new Intl.DateTimeFormat("it-IT", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** Avviso di una nuova prenotazione dal sito. Non lancia mai. */
export async function notificaPrenotazione(p: Prenotazione) {
  try {
    const quando = `${giornoBreve.format(new Date(`${p.data}T12:00:00Z`))} alle ${formatoOra(p.inizio)}`;
    return await inviaATutti({
      titolo: `Nuova prenotazione · ${p.cliente.nome}`,
      testo: `${p.servizioNome} · ${quando}${p.cliente.note ? `\n“${p.cliente.note}”` : ""}`,
      url: `/admin?data=${p.data}`,
      tag: `prenotazione-${p.id}`,
    });
  } catch (e) {
    console.error("[notifiche] errore inatteso", e);
    return { inviate: 0, fallite: 0 };
  }
}

/* Configurazione dell'accesso all'agenda: l'unico punto che legge e valida
   ADMIN_PASSWORD e AUTH_SECRET.

   Regole:
   - fail-closed: se manca qualcosa, nessuno entra (mai il contrario);
   - all'utente si mostra solo "Servizio temporaneamente non disponibile":
     i nomi delle variabili mancanti finiscono solo nei log del server, e i
     valori mai, da nessuna parte;
   - nessun prefisso NEXT_PUBLIC_: le variabili restano sul server.

   Niente import di Node: lo usa anche il middleware, sul runtime Edge. */

export const LUNGHEZZA_MINIMA_SEGRETO = 32;

export type ConfigAccesso =
  | { ok: true; password: string; segreto: string }
  | { ok: false; problemi: string[] };

// Un a capo o uno spazio incollati per sbaglio nel pannello di Vercel sono
// l'errore più comune: si tolgono, e lo si segnala nei log.
function leggi(nome: string, avvisi: string[]): string {
  const grezzo = process.env[nome] ?? "";
  const pulito = grezzo.trim();
  if (pulito && pulito !== grezzo) avvisi.push(`${nome} conteneva spazi o a capo all'inizio o alla fine (rimossi)`);
  return pulito;
}

let segnalato = false;

export function configAccesso(): ConfigAccesso {
  const avvisi: string[] = [];
  const problemi: string[] = [];
  const password = leggi("ADMIN_PASSWORD", avvisi);
  const segreto = leggi("AUTH_SECRET", avvisi);

  if (!password) problemi.push("ADMIN_PASSWORD mancante");
  if (!segreto) problemi.push("AUTH_SECRET mancante");
  else if (segreto.length < LUNGHEZZA_MINIMA_SEGRETO)
    problemi.push(`AUTH_SECRET troppo corto (${segreto.length} caratteri, minimo ${LUNGHEZZA_MINIMA_SEGRETO})`);

  // Una volta per istanza, solo nomi e lunghezze: mai i valori.
  if (!segnalato && (problemi.length || avvisi.length)) {
    segnalato = true;
    for (const a of avvisi) console.warn(`[accesso agenda] ${a}`);
    if (problemi.length)
      console.error(`[accesso agenda] configurazione non valida, accesso negato: ${problemi.join("; ")}. Vedi .env.example.`);
  }
  return problemi.length ? { ok: false, problemi } : { ok: true, password, segreto };
}

/** Testo per chi visita: generico di proposito. */
export const MESSAGGIO_NON_DISPONIBILE = "Servizio temporaneamente non disponibile. Riprova più tardi.";

/** Risposta 503 generica (middleware e rotte di Auth.js). */
export function rispostaNonDisponibile(): Response {
  return new Response(MESSAGGIO_NON_DISPONIBILE, {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "Retry-After": "300" },
  });
}

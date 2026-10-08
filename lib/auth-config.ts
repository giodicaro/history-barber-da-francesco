/* Configurazione dell'accesso all'agenda: l'unico punto che legge e valida
   ADMIN_PASSWORD e AUTH_SECRET.

   Regole:
   - fail-closed: se manca qualcosa, nessuno entra (mai il contrario);
   - all'utente si mostra solo "Servizio temporaneamente non disponibile":
     i nomi delle variabili mancanti finiscono solo nei log del server, e i
     valori mai, da nessuna parte;
   - nessun prefisso NEXT_PUBLIC_: le variabili restano sul server.

   Niente import di Node: resta compatibile con qualsiasi runtime. */

export const LUNGHEZZA_MINIMA_SEGRETO = 32;

export type ConfigAccesso =
  | { ok: true; password: string; segreto: string }
  | { ok: false; problemi: string[] };

// Un a capo, uno spazio o le virgolette incollati per sbaglio nel pannello
// di Vercel sono l'errore più comune: si tolgono, e lo si segnala nei log.
function pulisci(nome: string, grezzo: string | undefined, avvisi: string[]): string {
  const valore = grezzo ?? "";
  let pulito = valore.trim();
  if (/^(["']).*\1$/.test(pulito)) pulito = pulito.slice(1, -1).trim();
  if (pulito && pulito !== valore)
    avvisi.push(`${nome}_RIPULITA: spazi, a capo o virgolette all'inizio o alla fine (rimossi)`);
  return pulito;
}

let segnalato = false;

export function configAccesso(): ConfigAccesso {
  const avvisi: string[] = [];
  const problemi: string[] = [];
  // Nomi scritti per esteso, mai process.env[nome]: è la forma che ogni
  // runtime e ogni bundler riconoscono.
  const password = pulisci("ADMIN_PASSWORD", process.env.ADMIN_PASSWORD, avvisi);
  const segreto = pulisci("AUTH_SECRET", process.env.AUTH_SECRET, avvisi);

  // Codici fissi da cercare nei log di Vercel; mai i valori.
  if (!password) problemi.push("AUTH_CONFIG_MISSING_ADMIN_PASSWORD");
  if (!segreto) problemi.push("AUTH_CONFIG_MISSING_AUTH_SECRET");
  else if (segreto.length < LUNGHEZZA_MINIMA_SEGRETO)
    problemi.push(`AUTH_SECRET_TOO_SHORT (${segreto.length} caratteri, minimo ${LUNGHEZZA_MINIMA_SEGRETO})`);

  // Una volta per istanza, solo nomi e lunghezze: mai i valori.
  if (!segnalato && (problemi.length || avvisi.length)) {
    segnalato = true;
    for (const a of avvisi) console.warn(`[accesso agenda] ${a}`);
    if (problemi.length)
      console.error(
        `[accesso agenda] configurazione non valida, accesso negato: ${problemi.join("; ")} ` +
          `(runtime: ${process.env.NEXT_RUNTIME ?? "nodejs"}, ambiente Vercel: ${process.env.VERCEL_ENV ?? "nessuno"}). Vedi .env.example.`,
      );
  }
  return problemi.length ? { ok: false, problemi } : { ok: true, password, segreto };
}

/** Testo per chi visita: generico di proposito. */
export const MESSAGGIO_NON_DISPONIBILE = "Servizio temporaneamente non disponibile. Riprova più tardi.";

/** Risposta 503 generica (proxy e rotte di Auth.js). */
export function rispostaNonDisponibile(): Response {
  return new Response(MESSAGGIO_NON_DISPONIBILE, {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "Retry-After": "300" },
  });
}

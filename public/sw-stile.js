/* Service worker di "Il mio stile" (pagine /stile/<token>).

   Tiene sul telefono del cliente l'ultima copia della sua pagina e delle sue
   foto, così "Il mio stile" si apre anche senza rete. Registrato da
   components/lookbook/RegistraSW.tsx con scope "/stile/": non vede /admin,
   dove l'agenda ha il suo service worker (sw-agenda.js) e le sue notifiche.

   Strategie:
   - pagina /stile/<token>: prima la rete (al massimo ~4 s), poi la copia;
     ogni risposta 200 aggiorna la copia;
   - /_next/static/* (CSS, JavaScript, font, con l'hash nel nome) e foto
     /stile/<token>/foto/*: prima la copia, perché non cambiano mai;
   - tutto il resto passa dritto, senza copia: manifest, POST delle Server
     Action, richieste RSC.
   Privacy: se la pagina o una foto rispondono 404/410 (scheda cancellata,
   link rigenerato), si cancella dalla copia tutto ciò che riguarda quel
   token. Una scheda eliminata non si rivede, nemmeno offline. */

const CACHE = "stile-v1";
const ATTESA_RETE = 4000;

const TOKEN = "[A-Za-z0-9_-]{43}";
const PAGINA = new RegExp(`^/stile/(${TOKEN})/?$`);
const FOTO = new RegExp(`^/stile/(${TOKEN})/foto/[0-9a-f-]{36}$`, "i");

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      for (const nome of await caches.keys()) {
        if (nome.startsWith("stile-") && nome !== CACHE) await caches.delete(nome);
      }
      await self.clients.claim();
    })(),
  );
});

/** Toglie dalla copia pagina e foto di un token. */
async function dimentica(token) {
  const cache = await caches.open(CACHE);
  for (const richiesta of await cache.keys()) {
    if (new URL(richiesta.url).pathname.startsWith(`/stile/${token}`)) await cache.delete(richiesta);
  }
}

const chiavePagina = (url) => `${url.origin}${url.pathname.replace(/\/$/, "")}`;

const offline = () =>
  new Response(
    `<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Il mio stile — offline</title>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;background:#0a0a0a;color:#fff;font:16px/1.5 system-ui,sans-serif">
<main style="padding:1.25rem;max-width:32rem"><p style="letter-spacing:.2em;font-size:11px;font-weight:700;text-transform:uppercase;color:#a3a3a3">History Barber</p>
<h1 style="font-size:2rem;line-height:1;margin:.75rem 0 1rem;text-transform:uppercase">Sei offline</h1>
<p style="color:#a3a3a3">Questa pagina non è ancora salvata sul telefono. Aprila una volta con la rete e poi la ritrovi anche senza.</p></main>`,
    { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );

async function paginaPrimaLaRete(richiesta, url, token) {
  const cache = await caches.open(CACHE);
  const chiave = chiavePagina(url);
  try {
    const risposta = await Promise.race([
      fetch(richiesta),
      new Promise((_, rifiuta) => setTimeout(() => rifiuta(new Error("lenta")), ATTESA_RETE)),
    ]);
    if (risposta.status === 404 || risposta.status === 410) await dimentica(token);
    else if (risposta.ok) await cache.put(chiave, risposta.clone());
    return risposta;
  } catch {
    return (await cache.match(chiave)) ?? offline();
  }
}

async function primaLaCopia(richiesta, token) {
  const cache = await caches.open(CACHE);
  const copia = await cache.match(richiesta);
  if (copia) return copia;
  const risposta = await fetch(richiesta);
  if (token && (risposta.status === 404 || risposta.status === 410)) await dimentica(token);
  else if (risposta.ok) await cache.put(richiesta, risposta.clone());
  return risposta;
}

self.addEventListener("fetch", (evento) => {
  const richiesta = evento.request;
  if (richiesta.method !== "GET") return;
  const url = new URL(richiesta.url);
  if (url.origin !== self.location.origin) return;

  const pagina = url.pathname.match(PAGINA);
  // Solo la navigazione vera: le richieste RSC di Next (header "RSC") vanno dritte.
  if (pagina && richiesta.mode === "navigate") {
    evento.respondWith(paginaPrimaLaRete(richiesta, url, pagina[1]));
    return;
  }
  const foto = url.pathname.match(FOTO);
  if (foto) {
    evento.respondWith(primaLaCopia(richiesta, foto[1]));
    return;
  }
  if (url.pathname.startsWith("/_next/static/")) {
    evento.respondWith(primaLaCopia(richiesta, null));
  }
  // Tutto il resto: nessuna risposta qui, il browser fa da sé.
});

/* La pagina appena aperta chiede di salvare subito sé stessa, le sue foto e
   i file statici già caricati (prima che questo service worker la
   controllasse). Solo indirizzi dello stesso sito e dentro i percorsi
   previsti: un messaggio non può far salvare altro. */
self.addEventListener("message", (evento) => {
  const dati = evento.data;
  if (!dati || dati.tipo !== "precarica") return;
  evento.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const pagina = typeof dati.pagina === "string" ? new URL(dati.pagina, self.location.origin) : null;
      const token = pagina?.pathname.match(PAGINA)?.[1];
      if (pagina && token) {
        try {
          const risposta = await fetch(pagina, { credentials: "same-origin" });
          if (risposta.status === 404 || risposta.status === 410) {
            await dimentica(token);
            return;
          }
          if (risposta.ok) await cache.put(chiavePagina(pagina), risposta);
        } catch {
          // Offline proprio adesso: si salverà alla prossima visita.
        }
      }
      for (const indirizzo of Array.isArray(dati.file) ? dati.file.slice(0, 300) : []) {
        try {
          const url = new URL(indirizzo, self.location.origin);
          if (url.origin !== self.location.origin) continue;
          if (!FOTO.test(url.pathname) && !url.pathname.startsWith("/_next/static/")) continue;
          if (await cache.match(url.href)) continue;
          const risposta = await fetch(url.href, { credentials: "same-origin" });
          if (risposta.ok) await cache.put(url.href, risposta);
        } catch {
          // Un file che non arriva non ferma gli altri.
        }
      }
    })(),
  );
});

import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

// Indirizzi IPv4 di questo computer sulla rete locale (Wi-Fi, hotspot, cavo).
// Il server di sviluppo gira con -H 0.0.0.0 per aprirlo dall'iPhone, ma
// Next 16 accetta le richieste alle risorse di sviluppo (/_next/*, HMR) solo
// da localhost: aperto da 172.20.10.x la pagina arriva, React no, e nessun
// bottone risponde. Letti all'avvio: se cambia rete, basta riavviare `dev`.
const indirizziDiRete = Object.values(networkInterfaces())
  .flat()
  .filter((i) => i && i.family === "IPv4" && !i.internal)
  .map((i) => i!.address);

const nextConfig: NextConfig = {
  // Nella home dell'utente c'è un altro package-lock.json: senza una radice
  // esplicita Next la cerca risalendo le cartelle e avvisa a ogni avvio.
  turbopack: {
    root: __dirname,
  },
  // Il database locale (PGlite) carica da sé il suo WebAssembly e i file
  // dell'estensione btree_gist: va lasciato fuori dal bundle e letto da
  // node_modules così com'è.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Vale solo in sviluppo: la build di produzione non ha risorse di sviluppo.
  allowedDevOrigins: indirizziDiRete,

  /* App dei clienti (PWA): file statici in public/app, API in app/api/app.
     L'app usa indirizzi relativi alla sua cartella ("api/days", "css/…"),
     così funziona in qualsiasi sottocartella: qui /app/api/* porta alle
     rotte vere e /app porta alla pagina dell'app. */
  async redirects() {
    return [{ source: "/app", destination: "/app/index.html", permanent: false }];
  },
  async rewrites() {
    return [{ source: "/app/api/:path*", destination: "/api/app/:path*" }];
  },
  async headers() {
    return [
      {
        source: "/app/:path*",
        headers: [
          // Nessuno script o stile inline nell'app: la politica può essere stretta.
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; font-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      // Il browser deve vedere sempre l'ultimo service worker per accorgersi
      // degli aggiornamenti.
      { source: "/app/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] },
      {
        source: "/app/manifest.webmanifest",
        headers: [{ key: "Content-Type", value: "application/manifest+json" }],
      },
    ];
  },
};

export default nextConfig;

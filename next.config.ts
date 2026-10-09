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
  async headers() {
    return [
      {
        // "Il mio stile": pagine e foto personali, raggiungibili solo con il
        // link del cliente. Mai nei motori di ricerca, e il link (che è la
        // chiave d'accesso) non deve finire nel Referer di chi si apre da qui.
        source: "/stile/:percorso*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
      {
        // Il service worker del cliente si ricontrolla a ogni visita.
        source: "/sw-stile.js",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
    ];
  },
};

export default nextConfig;

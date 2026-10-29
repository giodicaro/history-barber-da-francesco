// Fa caricare a Node i moduli .ts dell'app così come li scrive Next: con
// l'alias "@/…" e con gli import relativi senza estensione ("./slot").
// Node toglie da solo i tipi (22.18+); qui si risolvono solo i percorsi.
// Registrato da tests/registra-alias.mjs (npm test).
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const RADICE = new URL("../", import.meta.url);
const ESTENSIONI = [".ts", ".tsx", "/index.ts"];

function conEstensione(url) {
  const percorso = fileURLToPath(url);
  if (existsSync(percorso) && !percorso.endsWith("\\") && /\.[cm]?[jt]sx?$/.test(percorso)) return url;
  for (const e of ESTENSIONI) if (existsSync(percorso + e)) return pathToFileURL(percorso + e).href;
  return null;
}

export async function resolve(specificatore, contesto, prossimo) {
  if (specificatore.startsWith("@/")) {
    const url = conEstensione(new URL(specificatore.slice(2), RADICE).href);
    if (url) return { url, shortCircuit: true };
  }
  if ((specificatore.startsWith("./") || specificatore.startsWith("../")) && contesto.parentURL?.startsWith("file:")) {
    const url = conEstensione(new URL(specificatore, contesto.parentURL).href);
    if (url) return { url, shortCircuit: true };
  }
  return prossimo(specificatore, contesto);
}

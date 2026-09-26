// Applica lo schema (db/schema.ts) al Postgres di DATABASE_URL.
// uso: npm run db:init   (legge .env.local, poi .env)
// Serve Node 22.18 o successivo, che importa il file .ts da solo.
// In locale senza DATABASE_URL non serve: l'app crea da sé il database su file.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { SCHEMA } from "../db/schema.ts";

const radice = join(dirname(fileURLToPath(import.meta.url)), "..");

// Piccolo lettore di .env: basta per uno script, niente dipendenze in più.
for (const file of [".env.local", ".env"]) {
  try {
    for (const riga of readFileSync(join(radice, file), "utf8").split("\n")) {
      const m = riga.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // Il file può non esserci: su Vercel le variabili arrivano dall'ambiente.
  }
}

const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
if (!url) {
  console.error(
    "Manca DATABASE_URL (o POSTGRES_URL).\n" +
      "Mettila in .env.local — vedi .env.example — oppure passala:\n" +
      '  DATABASE_URL="postgres://..." npm run db:init',
  );
  process.exit(1);
}

const sql = postgres(url, { max: 1, prepare: false });

try {
  await sql.unsafe(SCHEMA);
  const [{ n }] = await sql`select count(*)::int as n from prenotazioni`;
  const vincoli = await sql`
    select conname from pg_constraint where conrelid = 'prenotazioni'::regclass order by conname
  `;
  console.log("Schema applicato.");
  console.log(`  prenotazioni in archivio: ${n}`);
  console.log(`  vincoli: ${vincoli.map((v) => v.conname).join(", ")}`);
} catch (e) {
  console.error("Non riuscito:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await sql.end();
}

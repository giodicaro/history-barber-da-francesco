// Sends a test push to every stored subscription (or only the newest with
// --latest). Clicking it opens the app at #booking.
// Usage: npm run push:test [-- --latest] [-- --title "..."]

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { openDb } from "../server/db.js";
import { createPush } from "../server/push.js";
import { loadShop } from "../server/index.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const envFile = join(root, "server", ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const dataDir = process.env.DATA_DIR ? resolve(process.env.DATA_DIR) : join(root, "storage");
const db = openDb(join(dataDir, "history-barber.sqlite"));
const shop = loadShop();
const push = createPush({ db, shop, env: process.env });

if (!push.enabled) {
  console.error("Push disabled: run `npm run vapid` first.");
  process.exit(1);
}
let subs = db.allSubscriptions();
if (process.argv.includes("--latest")) subs = subs.slice(0, 1);
if (subs.length === 0) {
  console.error("No subscriptions stored. Open the app, enable reminders, then retry.");
  process.exit(1);
}
const sent = await push.sendToMany(subs, {
  title: arg("--title") ?? `${shop.shop.name}: notifica di prova`,
  body: "Se la vedi, le notifiche funzionano. Toccala per aprire la prenotazione.",
  url: "./#booking",
  tag: "push-test",
});
console.log(`Sent ${sent}/${subs.length} push notification(s).`);
db.close();

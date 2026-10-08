// Creates or updates server/.env with a VAPID key pair for Web Push.
// Existing keys are kept (rotating them breaks every subscription) unless
// --force is passed. Other variables in the file are left untouched.

import webpush from "web-push";
import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const envPath = fileURLToPath(new URL("../server/.env", import.meta.url));
const examplePath = fileURLToPath(new URL("../server/.env.example", import.meta.url));
const force = process.argv.includes("--force");

if (!existsSync(envPath)) copyFileSync(examplePath, envPath);
let text = readFileSync(envPath, "utf8");
const get = (key) => new RegExp(`^${key}=(.*)$`, "m").exec(text)?.[1]?.trim();
const set = (key, value) => {
  const line = `${key}=${value}`;
  text = new RegExp(`^${key}=.*$`, "m").test(text)
    ? text.replace(new RegExp(`^${key}=.*$`, "m"), line)
    : `${text.trimEnd()}\n${line}\n`;
};

if (get("VAPID_PUBLIC_KEY") && get("VAPID_PRIVATE_KEY") && !force) {
  console.log("VAPID keys already present in server/.env (use --force to rotate them).");
} else {
  const { publicKey, privateKey } = webpush.generateVAPIDKeys();
  set("VAPID_PUBLIC_KEY", publicKey);
  set("VAPID_PRIVATE_KEY", privateKey);
  if (!get("VAPID_SUBJECT")) set("VAPID_SUBJECT", "mailto:changeme@example.com");
  writeFileSync(envPath, text, { mode: 0o600 });
  console.log("VAPID keys written to server/.env");
  console.log(`Public key: ${publicKey}`);
}

// Controllo responsive automatico di tutto il sito (home, menu, widget,
// "Il mio appuntamento", privacy, accesso e agenda), con Chromium (Android)
// e WebKit (iPhone), a tutte le misure di PRODUCTION_BIBLE.md §7.
//
// Uso (Playwright NON è una dipendenza del progetto):
//   1. una volta sola, in una cartella fuori dal progetto:
//        npm i playwright@1.64.1 && npx playwright install chromium webkit
//   2. con il sito acceso (npm run build && npm run start -- -p 3200):
//        PLAYWRIGHT_DIR=<quella cartella> node scripts/controllo-responsive.mjs
//
// Opzioni: --url http://localhost:3200 · --motori chromium,webkit ·
//          --misure 320,390,844x390 · --pagine home,widget,agenda
// La password dell'agenda si legge da AGENDA_PASSWORD o da ADMIN_PASSWORD in
// .env.local, e non viene mai stampata.
//
// Risultato in .controllo-responsive/ (ignorata da git): uno screenshot per
// motore/misura/pagina e rapporto.md con i difetti, pagina per pagina.
// ATTENZIONE: prenota davvero (un appuntamento per motore e misura, nei giorni
// in fondo al calendario). Usalo solo su un database di prova, mai in
// produzione.

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RADICE = join(dirname(fileURLToPath(import.meta.url)), "..");
const USCITA = join(RADICE, ".controllo-responsive");

/* ── Opzioni ─────────────────────────────────────────────────────────────── */

const argomenti = Object.fromEntries(
  process.argv.slice(2).reduce((coppie, a, i, tutti) => (a.startsWith("--") ? [...coppie, [a.slice(2), tutti[i + 1]]] : coppie), []),
);
const URL_BASE = (argomenti.url ?? "http://localhost:3200").replace(/\/$/, "");
const MOTORI = (argomenti.motori ?? "chromium,webkit").split(",");
const TUTTE_LE_MISURE = [
  [320, 640], [360, 780], [375, 812], [390, 844], [412, 915], [430, 932],
  [768, 1024], [1024, 768], [1280, 800], [1440, 900], [1920, 1080],
  [844, 390], [915, 412],
];
const MISURE = argomenti.misure
  ? argomenti.misure.split(",").map((m) => TUTTE_LE_MISURE.find(([w, h]) => (m.includes("x") ? `${w}x${h}` === m : String(w) === m)) ?? (() => { throw new Error(`misura sconosciuta: ${m}`); })())
  : TUTTE_LE_MISURE;
const GRUPPI = (argomenti.pagine ?? "home,widget,mio,pagine,agenda").split(",");

function caricaPlaywright() {
  const richiedi = createRequire(import.meta.url);
  try {
    return richiedi("playwright");
  } catch {
    const dir = process.env.PLAYWRIGHT_DIR;
    if (!dir) throw new Error("Playwright non trovato: imposta PLAYWRIGHT_DIR (vedi l'intestazione dello script).");
    return createRequire(join(dir, "package.json"))("playwright");
  }
}

function passwordAgenda() {
  if (process.env.AGENDA_PASSWORD) return process.env.AGENDA_PASSWORD;
  try {
    const riga = readFileSync(join(RADICE, ".env.local"), "utf8").split(/\r?\n/).find((r) => r.startsWith("ADMIN_PASSWORD="));
    return riga?.slice("ADMIN_PASSWORD=".length).replace(/^["']|["']$/g, "") || null;
  } catch {
    return null;
  }
}

/* ── Il controllo, dentro la pagina ──────────────────────────────────────── */

// Gira nel browser: restituisce l'elenco dei difetti della vista corrente.
function controllaVista({ barra }) {
  const difetti = [];
  const vw = document.documentElement.clientWidth;
  const nome = (el) => {
    const classi = typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 3).join(".") : "";
    const testo = (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);
    return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${classi ? `.${classi}` : ""}${testo ? ` «${testo}»` : ""}`;
  };
  // Visibile davvero: niente display none, visibility hidden, opacità 0,
  // sottoalberi inerti (la pagina sotto un foglio aperto), aria-hidden, né
  // elementi solo per i lettori di schermo (sr-only: ritagliati a zero, come
  // "Vai al contenuto", che compare solo con il Tab).
  const visibile = (el) => {
    if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
    if (el.closest("[inert], [aria-hidden='true']")) return false;
    const st = getComputedStyle(el);
    if (st.clip === "rect(0px, 0px, 0px, 0px)" || st.clipPath === "inset(50%)") return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };
  // Un antenato che taglia l'eccedenza (overflow non visibile) e che sta lui
  // dentro la pagina: ciò che sporge è nascosto apposta (striscia dei giorni,
  // foto ingrandita, firma del footer).
  const tagliatoDaAntenato = (el) => {
    for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
      const s = getComputedStyle(a);
      if (s.overflowX !== "visible") {
        const r = a.getBoundingClientRect();
        return r.left >= -1 && r.right <= vw + 1;
      }
    }
    return false;
  };

  // 1. Scorrimento orizzontale.
  if (document.documentElement.scrollWidth > document.documentElement.clientWidth)
    difetti.push(`scorrimento orizzontale: ${document.documentElement.scrollWidth} > ${document.documentElement.clientWidth}`);

  const tutti = [...document.body.querySelectorAll("*")].filter(visibile);

  // 2. Elementi che escono dal viewport.
  for (const el of tutti) {
    const r = el.getBoundingClientRect();
    if ((r.right > vw + 1 || r.left < -1) && !tagliatoDaAntenato(el)) {
      difetti.push(`fuori dal viewport (${Math.round(r.left)}→${Math.round(r.right)} su ${vw}): ${nome(el)}`);
    }
  }

  // 3. Bersagli piccoli (< 44×44). Esclusi i link dentro il testo corrente e
  //    le caselle dentro un'etichetta grande abbastanza (si tocca l'etichetta).
  const interattivi = tutti.filter((el) => el.matches("a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button]"));
  for (const el of interattivi) {
    if (el.matches("a") && getComputedStyle(el).display === "inline") {
      const testoGenitore = [...el.parentElement.childNodes].filter((n) => n !== el).map((n) => n.textContent).join("").trim();
      if (testoGenitore) continue;
    }
    let r = el.getBoundingClientRect();
    if (el.matches("input[type=checkbox], input[type=radio]") && el.closest("label")) r = el.closest("label").getBoundingClientRect();
    if (r.width < 43.5 || r.height < 43.5) difetti.push(`bersaglio ${Math.round(r.width)}×${Math.round(r.height)}: ${nome(el)}`);
  }

  // 4. Campi sotto i 16 px (iOS fa lo zoom).
  for (const el of tutti.filter((e) => e.matches("input:not([type=checkbox]):not([type=radio]):not([type=hidden]), select, textarea"))) {
    const corpo = parseFloat(getComputedStyle(el).fontSize);
    if (corpo < 16) difetti.push(`campo a ${corpo}px: ${nome(el)}`);
  }

  // 5. Testo tagliato (overflow nascosto o puntini), salvo data-taglio-voluto.
  for (const el of tutti) {
    const s = getComputedStyle(el);
    const taglia = ["hidden", "clip"].includes(s.overflowX) || s.textOverflow === "ellipsis";
    if (!taglia || el.closest("[data-taglio-voluto]")) continue;
    if (!el.textContent.trim() || el.querySelector("img, video, picture, canvas, svg")) continue;
    if (el.scrollWidth > el.clientWidth + 1) difetti.push(`testo tagliato (${el.scrollWidth} > ${el.clientWidth}): ${nome(el)}`);
  }

  // 5b. Testo che sporge dal suo riquadro senza essere tagliato (una parola
  //     troppo lunga per la riga): il riquadro resta nella pagina, la parola
  //     no. Solo blocchi con testo proprio, senza media.
  for (const el of tutti) {
    const s = getComputedStyle(el);
    if (s.overflowX !== "visible" || s.display === "inline" || el.closest("[data-taglio-voluto]")) continue;
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && !el.matches("h1, h2, h3, p, dt, dd, li, a, button, span")) continue;
    if (el.querySelector("img, video, picture, canvas, svg, input, textarea, select") || !el.textContent.trim()) continue;
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
      const r = el.getBoundingClientRect();
      if (r.left + el.scrollWidth > vw + 1 || el.closest("main, header, footer, [role=dialog], dialog")) {
        difetti.push(`testo che sporge (${el.scrollWidth} > ${el.clientWidth}): ${nome(el)}`);
      }
    }
  }

  // 6. La barra fissa copre il primo contenuto (solo in cima alla pagina).
  const testata = document.querySelector("body > header, #contenuto ~ header, header.fixed, header[class*='fixed']");
  if (barra && testata && visibile(testata) && getComputedStyle(testata).position === "fixed") {
    const rb = testata.getBoundingClientRect();
    const foglie = tutti.filter(
      (el) => !testata.contains(el) && el.children.length === 0 && el.textContent.trim() && getComputedStyle(el).position !== "fixed",
    );
    for (const el of foglie) {
      const r = el.getBoundingClientRect();
      if (r.top < rb.bottom - 1 && r.bottom > rb.top + 1 && r.left < rb.right && r.right > rb.left) {
        difetti.push(`sotto la barra fissa: ${nome(el)}`);
        break;
      }
    }
  }
  return [...new Set(difetti)];
}

/* ── Il giro ─────────────────────────────────────────────────────────────── */

const attendi = (ms) => new Promise((r) => setTimeout(r, ms));
const risultati = []; // { motore, misura, pagina, difetti[] }
let contatore = 0;

async function vista(pagina, motore, misura, nomePagina, { intera = true, barra = false } = {}) {
  const dir = join(USCITA, motore, misura);
  mkdirSync(dir, { recursive: true });
  await attendi(250);
  const difetti = await pagina.evaluate(controllaVista, { barra });
  await pagina.screenshot({ path: join(dir, `${nomePagina}.png`), fullPage: intera });
  risultati.push({ motore, misura, pagina: nomePagina, difetti });
}

async function prova(fn, motore, misura, nomePagina) {
  try {
    await fn();
  } catch (e) {
    risultati.push({ motore, misura, pagina: nomePagina, difetti: [`la prova non è arrivata in fondo: ${e.message.split("\n")[0]}`] });
  }
}

async function giro(playwright, motore, [larghezza, altezza]) {
  const misura = `${larghezza}x${altezza}`;
  // Numero del giro: decide giorno e indirizzo, diversi per ogni motore e
  // misura (i due motori girano in parallelo e non devono prendere lo stesso
  // orario).
  const n = ++contatore;
  const browser = await playwright[motore].launch();
  const telefono = larghezza < 1024 || altezza < 500;
  const contesto = await browser.newContext({
    viewport: { width: larghezza, height: altezza },
    hasTouch: telefono,
    ...(motore === "chromium" ? { isMobile: telefono } : {}),
    // Un indirizzo diverso per ogni giro: il freno delle prenotazioni (5 ogni
    // 10 minuti per IP) non deve fermare il controllo.
    extraHTTPHeaders: { "x-forwarded-for": `10.77.${Math.floor(n / 200)}.${n % 200}` },
  });
  // WebKit su http (il server di prova) non rimanda i cookie "Secure" che il
  // sito scrive in produzione (dove è in https): solo in questo caso si toglie
  // "Secure" dalle risposte, come se la pagina fosse in https. Il server non
  // cambia: lo fa il browser di prova.
  if (motore === "webkit" && URL_BASE.startsWith("http:")) {
    // Solo le rotte che scrivono hb_cliente; se la richiesta cade si riprova
    // una volta, poi la si lascia passare com'è.
    const conCookie = (u) => /\/api\/(bookings|appuntamento)|\/appuntamento\/accesso\//.test(u.pathname);
    await contesto.route(conCookie, async (route) => {
      let risposta;
      try {
        risposta = await route.fetch().catch(() => route.fetch());
      } catch {
        return route.continue().catch(() => {});
      }
      const cookie = (await risposta.headersArray()).filter((h) => h.name.toLowerCase() === "set-cookie");
      if (cookie.length === 0) return route.fulfill({ response: risposta });
      const intestazioni = { ...risposta.headers(), "set-cookie": cookie.map((h) => h.value.replace(/;\s*Secure/i, "")).join("\n") };
      return route.fulfill({ response: risposta, headers: intestazioni });
    });
  }
  const p = await contesto.newPage();
  p.setDefaultTimeout(15000);
  const dialogo = '[role="dialog"]';

  if (GRUPPI.includes("home")) {
    await prova(async () => {
      await p.goto(`${URL_BASE}/`, { waitUntil: "networkidle" });
      await attendi(3200); // sequenza d'entrata della hero
      await vista(p, motore, misura, "home-cima", { barra: true });
      // Scorrendo si accendono le entrate allo scroll.
      const alto = await p.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < alto; y += Math.round(altezza * 0.8)) {
        await p.evaluate((y) => window.scrollTo(0, y), y);
        await attendi(120);
      }
      await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 2));
      await attendi(1200);
      await vista(p, motore, misura, "home-meta");
      await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await attendi(1200);
      await vista(p, motore, misura, "home-fondo");
      await p.evaluate(() => window.scrollTo(0, 0));
      await attendi(800);
      await p.locator("header button[aria-expanded]").first().click();
      await attendi(1300);
      await vista(p, motore, misura, "menu", { intera: false });
      await p.keyboard.press("Escape");
      await attendi(900);
    }, motore, misura, "home");
  }

  if (GRUPPI.includes("mio")) {
    await prova(async () => {
      await p.goto(`${URL_BASE}/`, { waitUntil: "networkidle" });
      await attendi(2500);
      await p.locator('[data-mio-appuntamento="hero"]').click();
      await p.locator(dialogo).getByText("Hai prenotato per telefono").waitFor();
      await attendi(700);
      await vista(p, motore, misura, "mio-non-riconosciuto", { intera: false });
      await p.keyboard.press("Escape");
      await attendi(700);
    }, motore, misura, "mio-non-riconosciuto");
  }

  let dataPrenotata = null;
  if (GRUPPI.includes("widget")) {
    await prova(async () => {
      await p.goto(`${URL_BASE}/`, { waitUntil: "networkidle" });
      await attendi(2500);
      await p.locator('[data-prenota="hero"]').click();
      await p.locator(dialogo).getByText("Taglio uomo").first().waitFor();
      await attendi(700);
      await vista(p, motore, misura, "widget-1", { intera: false });
      await p.locator(`${dialogo} li button`, { hasText: "Taglio uomo" }).first().click();
      await p.locator(dialogo).getByText("Orari liberi").waitFor();
      // Un giorno aperto verso la fine del calendario, diverso a ogni giro.
      const giorni = p.locator(`${dialogo} ul.flex button:not([disabled])`);
      const quanti = await giorni.count();
      await giorni.nth(Math.max(1, quanti - 1 - (n % Math.max(1, quanti - 2)))).click();
      await p.locator(`${dialogo} ul.grid button:not([disabled])`).first().waitFor();
      await attendi(500);
      await vista(p, motore, misura, "widget-2", { intera: false });
      await p.locator(`${dialogo} ul.grid button:not([disabled])`).first().click();
      await p.locator(`${dialogo} button`, { hasText: "Continua" }).click();
      await attendi(500);
      const campi = p.locator(`${dialogo} input:not([type=checkbox])`);
      await campi.nth(0).fill("Prova Responsive");
      await campi.nth(1).fill("347 000 4321");
      await vista(p, motore, misura, "widget-3", { intera: false });
      const risposta = p.waitForResponse((r) => r.url().endsWith("/api/bookings") && r.request().method() === "POST");
      await p.locator(`${dialogo} button`, { hasText: "Conferma prenotazione" }).click();
      dataPrenotata = (await (await risposta).json()).prenotazione?.data ?? null;
      await p.locator(dialogo).getByText("Per spostare o disdire").waitFor();
      await attendi(700);
      await vista(p, motore, misura, "widget-conferma", { intera: false });
      await p.keyboard.press("Escape");
      await attendi(800);
    }, motore, misura, "widget");
  }

  if (GRUPPI.includes("mio") && dataPrenotata) {
    await prova(async () => {
      await p.locator('[data-mio-appuntamento="hero"]').click();
      await p.locator(dialogo).getByText("Scegli un altro orario").waitFor();
      await attendi(900);
      await vista(p, motore, misura, "mio-riconosciuto", { intera: false });
      await p.keyboard.press("Escape");
      await p.goto(`${URL_BASE}/appuntamento`, { waitUntil: "networkidle" });
      await p.getByText("Scegli un altro orario").waitFor();
      await attendi(600);
      await vista(p, motore, misura, "mio-pagina", { barra: true });
    }, motore, misura, "mio-riconosciuto");
  }

  if (GRUPPI.includes("pagine")) {
    await prova(async () => {
      await p.goto(`${URL_BASE}/privacy`, { waitUntil: "networkidle" });
      await vista(p, motore, misura, "privacy", { barra: true });
      await p.goto(`${URL_BASE}/admin/login`, { waitUntil: "networkidle" });
      await vista(p, motore, misura, "login", { barra: true });
    }, motore, misura, "pagine");
  }

  if (GRUPPI.includes("agenda")) {
    await prova(async () => {
      const password = passwordAgenda();
      if (!password) throw new Error("password dell'agenda assente (AGENDA_PASSWORD o .env.local)");
      await p.goto(`${URL_BASE}/admin/login`, { waitUntil: "networkidle" });
      await p.locator('input[type="password"]').fill(password);
      await Promise.all([p.waitForURL((u) => !u.pathname.includes("login")), p.keyboard.press("Enter")]);
      await p.goto(`${URL_BASE}/admin${dataPrenotata ? `?data=${dataPrenotata}` : ""}`, { waitUntil: "networkidle" });
      await attendi(600);
      await vista(p, motore, misura, "agenda", { barra: true });
      await p.locator('button[aria-label^="Libero dalle"]').first().click();
      await p.locator("dialog[open]").waitFor();
      await attendi(700);
      await vista(p, motore, misura, "agenda-nuovo", { intera: false });
      await p.keyboard.press("Escape");
      await attendi(600);
      if (dataPrenotata) {
        await p.locator("ol > li button", { hasText: "Prova Responsive" }).first().click();
        await p.locator("dialog[open]").waitFor();
        await attendi(700);
        await vista(p, motore, misura, "agenda-dettaglio", { intera: false });
        await p.keyboard.press("Escape");
        await attendi(600);
      }
      await p.locator('button[aria-label$="scegli un altro giorno"]').click();
      await p.locator("dialog[open]").waitFor();
      await attendi(700);
      await vista(p, motore, misura, "agenda-calendario", { intera: false });
    }, motore, misura, "agenda");
  }

  await browser.close();
}

/* ── Rapporto ────────────────────────────────────────────────────────────── */

function rapporto() {
  const misure = MISURE.map(([w, h]) => `${w}x${h}`);
  const pagine = [...new Set(risultati.map((r) => r.pagina))];
  const cella = (motore, misura, pagina) => {
    const r = risultati.find((x) => x.motore === motore && x.misura === misura && x.pagina === pagina);
    return !r ? "—" : r.difetti.length === 0 ? "✅" : `❌ ${r.difetti.length}`;
  };
  const righe = [
    "# Controllo responsive",
    "",
    `${new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" })} · ${URL_BASE} · motori: ${MOTORI.join(", ")}`,
    "",
    `**Esito: ${risultati.every((r) => r.difetti.length === 0) ? "tutto ✅" : `${risultati.filter((r) => r.difetti.length).length} viste con difetti`}** su ${risultati.length} viste.`,
    "",
    `| Pagina | Misura | ${MOTORI.join(" | ")} |`,
    `|---|---|${MOTORI.map(() => "---").join("|")}|`,
    ...pagine.flatMap((pagina) => misure.map((m) => `| ${pagina} | ${m} | ${MOTORI.map((mo) => cella(mo, m, pagina)).join(" | ")} |`)),
    "",
    "## Difetti",
    "",
    ...risultati.filter((r) => r.difetti.length).flatMap((r) => [`### ${r.pagina} · ${r.misura} · ${r.motore}`, ...r.difetti.map((d) => `- ${d}`), ""]),
    "## Come si legge",
    "",
    "- WebKit su http://localhost non rimanda i cookie `Secure` (`hb_cliente`, che il server rinnova a ogni risposta): solo con WebKit e solo in http lo script toglie «Secure» dalle risposte nel browser di prova, come se la pagina fosse in https. Il sito non cambia.",
    "- Gli screenshot dei fogli e del menu (`widget-*`, `mio-*`, `menu`, `agenda-nuovo|dettaglio|calendario`) sono della sola finestra: il foglio è fisso e una cattura a pagina intera mostrerebbe la pagina sotto.",
    "- Non contano come difetto: gli elementi solo per i lettori di schermo (`sr-only`, come «Vai al contenuto», che compare solo da tastiera), i link dentro una frase (si toccano come testo), le caselle dentro un'etichetta da 44 px (si tocca l'etichetta), ciò che sporge dentro un contenitore che lo taglia apposta (striscia dei giorni, foto ingrandita) e gli elementi marcati `data-taglio-voluto` (la firma del footer).",
  ];
  writeFileSync(join(USCITA, "rapporto.md"), righe.join("\n"));
  return risultati.filter((r) => r.difetti.length).length;
}

const playwright = caricaPlaywright();
rmSync(USCITA, { recursive: true, force: true });
mkdirSync(USCITA, { recursive: true });
for (const misura of MISURE) {
  await Promise.all(MOTORI.map((motore) => giro(playwright, motore, misura)));
  const ultimi = risultati.filter((r) => r.misura === `${misura[0]}x${misura[1]}`);
  console.log(`${misura[0]}x${misura[1]}: ${ultimi.filter((r) => r.difetti.length === 0).length}/${ultimi.length} viste senza difetti`);
}
const conDifetti = rapporto();
console.log(conDifetti === 0 ? "Tutto ✅ — rapporto in .controllo-responsive/rapporto.md" : `${conDifetti} viste con difetti — vedi .controllo-responsive/rapporto.md`);
process.exitCode = conDifetti === 0 ? 0 : 1;

// Small DOM and formatting helpers shared by the page modules.

import { utcToZoned, formatTime, parseDate } from "./shared/time.js";

/** Create an element: el("p", { class: "x", text: "hi" }, child…). */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "dataset") Object.assign(node.dataset, value);
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else if (value === true) node.setAttribute(key, "");
    else node.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** Inline SVG from trusted, hard-coded markup. */
export function svg(markup) {
  const t = document.createElement("template");
  t.innerHTML = markup.trim();
  return t.content.firstElementChild;
}

const toasts = () => document.getElementById("toasts");

/** Non-blocking message; `action` adds a button ({ label, onClick }). */
export function toast(message, { action, timeout = action ? 0 : 5000 } = {}) {
  const node = el("div", { class: "toast", role: "status" }, el("span", { text: message }));
  const close = () => node.remove();
  if (action) {
    node.append(
      el("button", {
        type: "button",
        class: "btn btn-sm",
        text: action.label,
        onclick: () => {
          close();
          action.onClick();
        },
      }),
    );
  }
  toasts().append(node);
  if (timeout) setTimeout(close, timeout);
  return close;
}

/** Native <dialog> confirmation. Resolves true when confirmed. */
export function confirmDialog({ title, text, ok = "Conferma" }) {
  const dialog = document.getElementById("confirm-dialog");
  dialog.querySelector("#confirm-title").textContent = title;
  dialog.querySelector("#confirm-text").textContent = text;
  const okBtn = dialog.querySelector("#confirm-ok");
  okBtn.textContent = ok;
  return new Promise((resolve) => {
    const done = (value) => {
      okBtn.removeEventListener("click", onOk);
      dialog.removeEventListener("close", onClose);
      if (dialog.open) dialog.close();
      resolve(value);
    };
    const onOk = () => done(true);
    const onClose = () => done(false);
    okBtn.addEventListener("click", onOk);
    dialog.addEventListener("close", onClose);
    dialog.showModal();
  });
}

// <dialog> buttons marked data-close close their dialog.
document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-close]");
  if (button) button.closest("dialog")?.close();
});

/* ── Formatting (Italian) ──────────────────────────────────────────────── */

const dateFormats = {
  long: new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }),
  dow: new Intl.DateTimeFormat("it-IT", { weekday: "short", timeZone: "UTC" }),
  month: new Intl.DateTimeFormat("it-IT", { month: "short", timeZone: "UTC" }),
};

// A calendar date as a UTC midnight, so formatting never shifts the day.
const asDate = (date) => {
  const [y, m, d] = parseDate(date);
  return new Date(Date.UTC(y, m - 1, d));
};

export const formatDateLong = (date) => dateFormats.long.format(asDate(date));
export const formatDow = (date) => dateFormats.dow.format(asDate(date)).replace(".", "");
export const formatMonth = (date) => dateFormats.month.format(asDate(date)).replace(".", "");
export const formatDay = (date) => String(parseDate(date)[2]);

export const formatPrice = (n) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);

/** "martedì 13 ottobre alle 10:30" from a UTC instant, in the shop's zone. */
export function formatWhen(startUtc, timeZone) {
  const { date, minutes } = utcToZoned(startUtc, timeZone);
  return `${formatDateLong(date)} alle ${formatTime(minutes)}`;
}

export const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/* ── Calendar file ─────────────────────────────────────────────────────── */

const icsDate = (ms) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsText = (s) => String(s).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

/** Build and download an .ics for a booking (times in UTC, works everywhere). */
export function downloadIcs({ id, startUtc, endUtc, title, location, description }) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//History Barber//PWA//IT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${id}@history-barber`,
    `DTSTAMP:${icsDate(Date.now())}`,
    `DTSTART:${icsDate(startUtc)}`,
    `DTEND:${icsDate(endUtc)}`,
    `SUMMARY:${icsText(title)}`,
    `LOCATION:${icsText(location)}`,
    `DESCRIPTION:${icsText(description)}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "TRIGGER:-PT2H",
    `DESCRIPTION:${icsText(title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  const blob = new Blob([lines.join("\r\n") + "\r\n"], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = el("a", { href: url, download: "appuntamento-history-barber.ics" });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

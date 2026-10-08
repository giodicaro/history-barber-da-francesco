// Timezone helpers without a library. Instants are UTC milliseconds; "local"
// means wall-clock time in the shop's IANA zone (Europe/Rome). Shared by the
// browser and the server, so it must stay free of DOM and Node APIs.

const MINUTE = 60_000;
const DAY = 86_400_000;

const formatters = new Map();

function formatterFor(timeZone) {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

function wallParts(instant, timeZone) {
  const parts = {};
  for (const p of formatterFor(timeZone).formatToParts(new Date(instant))) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  return parts;
}

/** Offset of `timeZone` from UTC at `instant`, in ms (Rome: +1h or +2h). */
export function tzOffset(instant, timeZone) {
  const p = wallParts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - (instant - (instant % 1000));
}

/** "YYYY-MM-DD" → [y, m, d] */
export function parseDate(date) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? "");
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return [y, mo, d];
}

/** "HH:MM" → minutes from midnight */
export function parseTime(time) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time ?? "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function formatTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Wall-clock date + minutes in `timeZone` → UTC instant.
 * First guess uses the offset at the naive instant; if the offset at the
 * result differs (we crossed a DST switch), correct with the second offset.
 */
export function zonedToUtc(date, minutes, timeZone) {
  const [y, mo, d] = parseDate(date);
  const naive = Date.UTC(y, mo - 1, d) + minutes * MINUTE;
  const first = tzOffset(naive, timeZone);
  let utc = naive - first;
  const second = tzOffset(utc, timeZone);
  if (second !== first) utc = naive - second;
  return utc;
}

/** UTC instant → { date: "YYYY-MM-DD", minutes } in `timeZone`. */
export function utcToZoned(instant, timeZone) {
  const p = wallParts(instant, timeZone);
  const date = `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
  return { date, minutes: p.hour * 60 + p.minute };
}

/** Day of week of a calendar date (0 = Sunday); independent of timezone. */
export function weekday(date) {
  const [y, mo, d] = parseDate(date);
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
}

export function addDays(date, n) {
  const [y, mo, d] = parseDate(date);
  return new Date(Date.UTC(y, mo - 1, d) + n * DAY).toISOString().slice(0, 10);
}

export function todayIn(timeZone, now = Date.now()) {
  return utcToZoned(now, timeZone).date;
}

export { MINUTE, DAY };

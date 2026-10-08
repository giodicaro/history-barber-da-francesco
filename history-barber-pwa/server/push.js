// Web Push: VAPID setup, sending with cleanup of dead subscriptions, and the
// reminder scheduler (24h and 2h before each appointment, subscribers only).

import webpush from "web-push";
import { utcToZoned, formatTime } from "../public/js/shared/time.js";
import { findService } from "../public/js/shared/slots.js";

const HOUR = 3_600_000;

/**
 * Extension point for email/SMS reminders. Each hook receives
 * ({ booking, kind, shop }) for every reminder due, push subscriber or not.
 * Register providers here (e.g. an SMTP or SMS gateway client); with none
 * registered, reminders go out only as push notifications.
 */
export const reminderHooks = [];

export function createPush({ db, shop, env, now = Date.now, log = console }) {
  const publicKey = env.VAPID_PUBLIC_KEY;
  const privateKey = env.VAPID_PRIVATE_KEY;
  const subject = env.VAPID_SUBJECT || "mailto:changeme@example.com";
  const enabled = Boolean(publicKey && privateKey);
  if (enabled) webpush.setVapidDetails(subject, publicKey, privateKey);
  else log.warn("[push] VAPID keys missing: run `npm run vapid`. Push notifications are disabled.");

  async function sendTo(sub, payload) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
        { TTL: 6 * 3600, urgency: "high" },
      );
      return true;
    } catch (err) {
      // 404/410: the browser dropped the subscription. Forget it.
      if (err.statusCode === 404 || err.statusCode === 410) {
        db.deleteSubscription(sub.endpoint);
        log.info(`[push] removed expired subscription (${err.statusCode})`);
      } else {
        log.warn(`[push] send failed: ${err.statusCode ?? ""} ${err.body ?? err.message}`);
      }
      return false;
    }
  }

  async function sendToMany(subs, payload) {
    if (!enabled) return 0;
    const results = await Promise.all(subs.map((s) => sendTo(s, payload)));
    return results.filter(Boolean).length;
  }

  function reminderPayload(booking, kind) {
    const service = findService(shop, booking.serviceId);
    const { date, minutes } = utcToZoned(booking.startUtc, shop.shop.timezone);
    const when = kind === "24h" ? "Domani" : "Tra 2 ore";
    const day = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
      new Date(`${date}T00:00:00Z`),
    );
    return {
      title: `${when}: ${service?.name ?? "appuntamento"} alle ${formatTime(minutes)}`,
      body: `${shop.shop.name}, ${shop.shop.street}. ${day}. Per spostare o disdire apri l'app.`,
      url: "./#booking",
      tag: `reminder-${booking.id}-${kind}`,
    };
  }

  /**
   * One scheduler tick. A reminder is sent only if the booking was made before
   * its window opened (no "tomorrow" push for a booking made an hour ago); in
   * any case the flag is set so the booking is not looked at again.
   */
  async function runReminders() {
    const t = now();
    const { h24, h2 } = db.dueReminders(t);
    const jobs = [];
    for (const [kind, list, lead] of [["24h", h24, 24 * HOUR], ["2h", h2, 2 * HOUR]]) {
      for (const booking of list) {
        db.markReminded(booking.id, kind);
        const madeInTime = booking.createdAt <= booking.startUtc - lead;
        const tooLate = kind === "24h" && booking.startUtc - t <= 2 * HOUR;
        if (!madeInTime || tooLate) continue;
        const payload = reminderPayload(booking, kind);
        jobs.push(sendToMany(db.subscriptionsForBooking(booking.id), payload));
        for (const hook of reminderHooks) {
          jobs.push(Promise.resolve().then(() => hook({ booking, kind, shop })).catch((e) => log.warn(`[reminder hook] ${e.message}`)));
        }
      }
    }
    await Promise.all(jobs);
    return jobs.length;
  }

  let timer = null;
  function start(intervalMs = 60_000) {
    timer = setInterval(() => runReminders().catch((e) => log.error("[push] reminders failed", e)), intervalMs);
    timer.unref();
  }
  const stop = () => clearInterval(timer);

  return { enabled, publicKey: enabled ? publicKey : null, sendToMany, runReminders, reminderPayload, start, stop };
}

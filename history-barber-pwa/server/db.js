// SQLite storage (better-sqlite3). The driver is synchronous: inside one
// process a transaction cannot interleave with another request, which is what
// makes "check slot, then insert" atomic. The triggers below repeat the
// overlap rule at the database level in case two processes share the file.

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS bookings (
  id                TEXT PRIMARY KEY,
  client_request_id TEXT UNIQUE,
  barber_id         TEXT NOT NULL,
  service_id        TEXT NOT NULL,
  start_utc         INTEGER NOT NULL,
  end_utc           INTEGER NOT NULL,
  name              TEXT NOT NULL,
  phone             TEXT NOT NULL,
  email             TEXT NOT NULL,
  notes             TEXT NOT NULL DEFAULT '',
  status            TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','cancelled')),
  created_at        INTEGER NOT NULL,
  cancelled_at      INTEGER,
  reminded_24h      INTEGER NOT NULL DEFAULT 0,
  reminded_2h       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS bookings_barber_time ON bookings (barber_id, start_utc);
CREATE INDEX IF NOT EXISTS bookings_phone ON bookings (phone);
CREATE INDEX IF NOT EXISTS bookings_email ON bookings (email);

CREATE TRIGGER IF NOT EXISTS bookings_no_overlap_insert
BEFORE INSERT ON bookings WHEN NEW.status = 'confirmed'
BEGIN
  SELECT RAISE(ABORT, 'slot_taken') WHERE EXISTS (
    SELECT 1 FROM bookings
    WHERE barber_id = NEW.barber_id AND status = 'confirmed'
      AND start_utc < NEW.end_utc AND NEW.start_utc < end_utc);
END;

CREATE TRIGGER IF NOT EXISTS bookings_no_overlap_update
BEFORE UPDATE OF start_utc, end_utc, barber_id, status ON bookings WHEN NEW.status = 'confirmed'
BEGIN
  SELECT RAISE(ABORT, 'slot_taken') WHERE EXISTS (
    SELECT 1 FROM bookings
    WHERE id <> NEW.id AND barber_id = NEW.barber_id AND status = 'confirmed'
      AND start_utc < NEW.end_utc AND NEW.start_utc < end_utc);
END;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint   TEXT PRIMARY KEY,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS booking_subscriptions (
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL REFERENCES push_subscriptions(endpoint) ON DELETE CASCADE ON UPDATE CASCADE,
  PRIMARY KEY (booking_id, endpoint)
);
`;

const toBooking = (r) =>
  r && {
    id: r.id,
    barberId: r.barber_id,
    serviceId: r.service_id,
    startUtc: r.start_utc,
    endUtc: r.end_utc,
    name: r.name,
    phone: r.phone,
    email: r.email,
    notes: r.notes,
    status: r.status,
    createdAt: r.created_at,
    cancelledAt: r.cancelled_at,
  };

export function openDb(path) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.exec(SCHEMA);

  const s = {
    byId: db.prepare("SELECT * FROM bookings WHERE id = ?"),
    byRequest: db.prepare("SELECT * FROM bookings WHERE client_request_id = ?"),
    inRange: db.prepare(
      "SELECT * FROM bookings WHERE status = 'confirmed' AND start_utc < ? AND end_utc > ?",
    ),
    insert: db.prepare(`INSERT INTO bookings
      (id, client_request_id, barber_id, service_id, start_utc, end_utc, name, phone, email, notes, created_at)
      VALUES (@id, @clientRequestId, @barberId, @serviceId, @startUtc, @endUtc, @name, @phone, @email, @notes, @createdAt)`),
    activeForContact: db.prepare(
      "SELECT COUNT(*) AS n FROM bookings WHERE status = 'confirmed' AND end_utc > ? AND (phone = ? OR email = ?)",
    ),
    cancel: db.prepare("UPDATE bookings SET status = 'cancelled', cancelled_at = ? WHERE id = ?"),
    move: db.prepare(
      "UPDATE bookings SET barber_id = ?, start_utc = ?, end_utc = ?, reminded_24h = 0, reminded_2h = 0 WHERE id = ?",
    ),
    purge: db.prepare("DELETE FROM bookings WHERE end_utc < ?"),
    upsertSub: db.prepare(`INSERT INTO push_subscriptions (endpoint, p256dh, auth, created_at)
      VALUES (?, ?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth`),
    linkSub: db.prepare("INSERT OR IGNORE INTO booking_subscriptions (booking_id, endpoint) VALUES (?, ?)"),
    moveLinks: db.prepare(
      "INSERT OR IGNORE INTO booking_subscriptions (booking_id, endpoint) SELECT booking_id, ? FROM booking_subscriptions WHERE endpoint = ?",
    ),
    deleteSub: db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?"),
    allSubs: db.prepare("SELECT * FROM push_subscriptions ORDER BY created_at DESC"),
    subsForBooking: db.prepare(`SELECT p.* FROM push_subscriptions p
      JOIN booking_subscriptions l ON l.endpoint = p.endpoint WHERE l.booking_id = ?`),
    due24: db.prepare(`SELECT * FROM bookings WHERE status = 'confirmed' AND reminded_24h = 0
      AND start_utc <= @now + 86400000 AND start_utc > @now`),
    due2: db.prepare(`SELECT * FROM bookings WHERE status = 'confirmed' AND reminded_2h = 0
      AND start_utc <= @now + 7200000 AND start_utc > @now`),
    mark24: db.prepare("UPDATE bookings SET reminded_24h = 1 WHERE id = ?"),
    mark2: db.prepare("UPDATE bookings SET reminded_2h = 1 WHERE id = ?"),
  };

  return {
    raw: db,
    transaction: (fn) => db.transaction(fn),
    getBooking: (id) => toBooking(s.byId.get(id)),
    getByRequestId: (rid) => toBooking(s.byRequest.get(rid)),
    /** Confirmed bookings overlapping [from, to). */
    bookingsBetween: (from, to) => s.inRange.all(to, from).map(toBooking),
    insertBooking: (b) => s.insert.run(b),
    countActiveForContact: (now, phone, email) => s.activeForContact.get(now, phone, email).n,
    cancelBooking: (id, now) => s.cancel.run(now, id),
    moveBooking: (id, barberId, startUtc, endUtc) => s.move.run(barberId, startUtc, endUtc, id),
    purgeBefore: (instant) => s.purge.run(instant).changes,
    saveSubscription(sub, now) {
      s.upsertSub.run(sub.endpoint, sub.keys.p256dh, sub.keys.auth, now);
    },
    linkSubscription: (bookingId, endpoint) => s.linkSub.run(bookingId, endpoint),
    /** pushsubscriptionchange: carry the old endpoint's bookings over to the new one. */
    migrateSubscription: db.transaction((oldEndpoint, newEndpoint) => {
      s.moveLinks.run(newEndpoint, oldEndpoint);
      s.deleteSub.run(oldEndpoint);
    }),
    deleteSubscription: (endpoint) => s.deleteSub.run(endpoint).changes,
    allSubscriptions: () => s.allSubs.all(),
    subscriptionsForBooking: (id) => s.subsForBooking.all(id),
    dueReminders(now) {
      return { h24: s.due24.all({ now }).map(toBooking), h2: s.due2.all({ now }).map(toBooking) };
    },
    markReminded: (id, kind) => (kind === "24h" ? s.mark24 : s.mark2).run(id),
    close: () => db.close(),
  };
}

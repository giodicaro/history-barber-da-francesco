// Booking rules on top of the DB: availability, atomic create, cancel and
// reschedule with the cutoff, per-contact limits, booking tokens.

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { ANY_BARBER, computeDays, computeSlots, findBarber, findService, pickBarber } from "../public/js/shared/slots.js";
import { MINUTE, DAY, parseDate, parseTime, zonedToUtc, addDays } from "../public/js/shared/time.js";
import { validateCustomer } from "../public/js/shared/validation.js";

export class BookingError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const UUID = /^[0-9a-f-]{16,64}$/i;

export function createBookingService({ db, shop, secret, now = Date.now }) {
  const tz = shop.shop.timezone;

  // Token = HMAC(secret, id): verifiable without storing it, and the same
  // token can be handed back when an offline retry replays a request.
  const tokenFor = (id) => createHmac("sha256", secret).update(id).digest("base64url");
  const checkToken = (id, token) => {
    const expected = Buffer.from(tokenFor(id));
    const given = Buffer.from(String(token ?? ""));
    return given.length === expected.length && timingSafeEqual(given, expected);
  };

  // Confirmed bookings that can overlap a local date (a day of margin each side
  // is plenty: the longest service is well under a day).
  const bookingsAround = (date) => {
    const from = zonedToUtc(addDays(date, -1), 0, tz);
    const to = zonedToUtc(addDays(date, 2), 0, tz);
    return db.bookingsBetween(from, to);
  };

  function requireServiceAndBarber(serviceId, barberId) {
    if (!findService(shop, serviceId)) throw new BookingError(422, "invalid_service", "Servizio non valido.");
    if (barberId !== ANY_BARBER && !findBarber(shop, barberId))
      throw new BookingError(422, "invalid_barber", "Barbiere non valido.");
  }

  function availability({ date, serviceId, barberId = ANY_BARBER, excludeId }) {
    requireServiceAndBarber(serviceId, barberId);
    if (!parseDate(date)) throw new BookingError(422, "invalid_date", "Data non valida.");
    const bookings = bookingsAround(date).filter((b) => b.id !== excludeId);
    return computeSlots({ shop, date, serviceId, barberId, bookings, now: now() });
  }

  function days({ serviceId, barberId = ANY_BARBER }) {
    requireServiceAndBarber(serviceId, barberId);
    const t = now();
    const bookings = db.bookingsBetween(t - DAY, t + (shop.booking.maxDaysAhead + 2) * DAY);
    return computeDays({ shop, serviceId, barberId, bookings, now: t });
  }

  /** Pick the slot (and barber) or throw 409. Must run inside a transaction. */
  function resolveSlot({ date, time, serviceId, barberId, excludeId }) {
    if (parseTime(time) === null) throw new BookingError(422, "invalid_time", "Orario non valido.");
    const slot = availability({ date, serviceId, barberId, excludeId }).find((s) => s.time === time);
    if (!slot)
      throw new BookingError(409, "slot_taken", "Questo orario non è più disponibile. Scegline un altro.");
    const dayBookings = bookingsAround(date).filter((b) => b.id !== excludeId);
    const chosen = barberId === ANY_BARBER ? pickBarber(shop, slot.barberIds, dayBookings) : barberId;
    return { slot, barberId: chosen };
  }

  const create = db.transaction((input) => {
    const clientRequestId = UUID.test(String(input.clientRequestId ?? "")) ? input.clientRequestId : null;
    // Idempotent replay: the offline queue may resend a request whose first
    // attempt reached us but whose response was lost.
    if (clientRequestId) {
      const existing = db.getByRequestId(clientRequestId);
      if (existing) return { booking: existing, token: tokenFor(existing.id), replayed: true };
    }

    const { ok, errors, value } = validateCustomer(input);
    if (!ok) throw new BookingError(422, "invalid_input", "Controlla i dati inseriti.", errors);
    const serviceId = String(input.serviceId ?? "");
    const barberId = String(input.barberId ?? ANY_BARBER);
    requireServiceAndBarber(serviceId, barberId);

    const t = now();
    const { slot, barberId: chosen } = resolveSlot({ date: String(input.date ?? ""), time: String(input.time ?? ""), serviceId, barberId });

    if (db.countActiveForContact(t, value.phone, value.email) >= shop.booking.maxActivePerContact)
      throw new BookingError(
        429,
        "too_many_active",
        `Hai già ${shop.booking.maxActivePerContact} prenotazioni attive. Disdicine una o chiama il salone.`,
      );

    const booking = {
      id: randomBytes(9).toString("base64url"),
      clientRequestId,
      barberId: chosen,
      serviceId,
      startUtc: slot.startUtc,
      endUtc: slot.endUtc,
      ...value,
      createdAt: t,
    };
    try {
      db.insertBooking(booking);
    } catch (err) {
      if (String(err.message).includes("slot_taken"))
        throw new BookingError(409, "slot_taken", "Questo orario non è più disponibile. Scegline un altro.");
      throw err;
    }
    return { booking: db.getBooking(booking.id), token: tokenFor(booking.id), replayed: false };
  });

  function authorized(id, token) {
    const booking = typeof id === "string" ? db.getBooking(id) : null;
    // Same answer for "missing" and "wrong token": no booking-id probing.
    if (!booking || !checkToken(id, token)) throw new BookingError(404, "not_found", "Prenotazione non trovata.");
    return booking;
  }

  function assertBeforeCutoff(booking) {
    const cutoff = booking.startUtc - shop.booking.cancelCutoffMinutes * MINUTE;
    if (now() >= cutoff)
      throw new BookingError(
        403,
        "cutoff_passed",
        `Mancano meno di ${shop.booking.cancelCutoffMinutes / 60} ore all'appuntamento: per modificarlo chiama il salone.`,
      );
  }

  const cancel = db.transaction((id, token) => {
    const booking = authorized(id, token);
    if (booking.status === "cancelled") return booking;
    assertBeforeCutoff(booking);
    db.cancelBooking(id, now());
    return db.getBooking(id);
  });

  const reschedule = db.transaction((id, token, { date, time, barberId }) => {
    const booking = authorized(id, token);
    if (booking.status !== "confirmed")
      throw new BookingError(409, "not_active", "La prenotazione è stata disdetta.");
    assertBeforeCutoff(booking);
    const wanted = barberId ?? booking.barberId;
    const { slot, barberId: chosen } = resolveSlot({
      date: String(date ?? ""),
      time: String(time ?? ""),
      serviceId: booking.serviceId,
      barberId: wanted,
      excludeId: id,
    });
    try {
      db.moveBooking(id, chosen, slot.startUtc, slot.endUtc);
    } catch (err) {
      if (String(err.message).includes("slot_taken"))
        throw new BookingError(409, "slot_taken", "Questo orario non è più disponibile. Scegline un altro.");
      throw err;
    }
    return db.getBooking(id);
  });

  /** Public view: everything the customer entered, plus manage permissions. */
  function present(booking) {
    const cutoff = booking.startUtc - shop.booking.cancelCutoffMinutes * MINUTE;
    return {
      id: booking.id,
      barberId: booking.barberId,
      serviceId: booking.serviceId,
      startUtc: booking.startUtc,
      endUtc: booking.endUtc,
      name: booking.name,
      phone: booking.phone,
      email: booking.email,
      notes: booking.notes,
      status: booking.status,
      canModify: booking.status === "confirmed" && now() < cutoff,
      modifyUntil: cutoff,
    };
  }

  const purgeOld = () => db.purgeBefore(now() - shop.booking.retentionDays * DAY);

  return { availability, days, create, cancel, reschedule, authorized, present, tokenFor, checkToken, purgeOld };
}

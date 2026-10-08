// Slot engine: which start times are bookable for a service on a given day.
// Pure function, shared by the server (source of truth), the local mock and
// the tests. All instants are UTC ms; opening hours are local to shop.timezone.

import { MINUTE, addDays, parseDate, parseTime, todayIn, weekday, zonedToUtc, formatTime } from "./time.js";

export const ANY_BARBER = "any";

export function findService(shop, serviceId) {
  return shop.services.find((s) => s.id === serviceId) ?? null;
}

export function findBarber(shop, barberId) {
  return shop.barbers.find((b) => b.id === barberId) ?? null;
}

/** First and last bookable calendar dates, relative to `now`. */
export function bookingWindow(shop, now) {
  const first = todayIn(shop.shop.timezone, now);
  return { first, last: addDays(first, shop.booking.maxDaysAhead - 1) };
}

export function isClosedDate(shop, date) {
  if (shop.hours.closedDates.includes(date)) return true;
  return shop.hours.days[weekday(date)].shifts.length === 0;
}

/**
 * @param {object} p
 * @param {object} p.shop       parsed shop.json
 * @param {string} p.date       "YYYY-MM-DD" (local date)
 * @param {string} p.serviceId
 * @param {string} p.barberId   a barber id or "any"
 * @param {{barberId:string,startUtc:number,endUtc:number}[]} p.bookings
 *        confirmed bookings that may overlap the day (others are ignored)
 * @param {number} p.now        current instant (ms)
 * @returns {{time:string,startUtc:number,endUtc:number,barberIds:string[]}[]}
 */
export function computeSlots({ shop, date, serviceId, barberId, bookings, now }) {
  const service = findService(shop, serviceId);
  if (!service || !parseDate(date)) return [];
  const candidates =
    barberId === ANY_BARBER ? shop.barbers.map((b) => b.id) : findBarber(shop, barberId) ? [barberId] : [];
  if (candidates.length === 0) return [];

  const { first, last } = bookingWindow(shop, now);
  if (date < first || date > last || isClosedDate(shop, date)) return [];

  const tz = shop.shop.timezone;
  const step = shop.booking.slotStepMinutes;
  const earliest = now + shop.booking.minNoticeMinutes * MINUTE;
  const duration = service.durationMinutes * MINUTE;
  const slots = [];

  for (const [open, close] of shop.hours.days[weekday(date)].shifts) {
    const openMin = parseTime(open);
    const closeMin = parseTime(close);
    // The whole service must fit before the shift closes (no overrunning lunch).
    for (let t = openMin; t + service.durationMinutes <= closeMin; t += step) {
      const startUtc = zonedToUtc(date, t, tz);
      const endUtc = startUtc + duration;
      if (startUtc < earliest) continue;
      const free = candidates.filter(
        (id) => !bookings.some((b) => b.barberId === id && b.startUtc < endUtc && startUtc < b.endUtc),
      );
      if (free.length) slots.push({ time: formatTime(t), startUtc, endUtc, barberIds: free });
    }
  }
  return slots;
}

/**
 * For "Primo disponibile": among the free barbers, the one with the fewest
 * bookings that day, so work is spread evenly; ties keep shop.json order.
 */
export function pickBarber(shop, freeIds, dayBookings) {
  const load = (id) => dayBookings.filter((b) => b.barberId === id).length;
  return shop.barbers
    .map((b) => b.id)
    .filter((id) => freeIds.includes(id))
    .sort((a, b) => load(a) - load(b))[0];
}

/** Every date in the booking window with the number of free slots. */
export function computeDays({ shop, serviceId, barberId, bookings, now }) {
  const { first } = bookingWindow(shop, now);
  const days = [];
  for (let i = 0; i < shop.booking.maxDaysAhead; i++) {
    const date = addDays(first, i);
    const closed = isClosedDate(shop, date);
    const available = closed ? 0 : computeSlots({ shop, date, serviceId, barberId, bookings, now }).length;
    days.push({ date, closed, available });
  }
  return days;
}

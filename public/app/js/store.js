// localStorage wrappers. Storage can be unavailable (private mode, blocked
// site data): every access is guarded and the app keeps working without it.
// Only on-device conveniences live here; the server is the source of truth.

const PREFIX = "hb:";

export function read(key, fallback = null) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function write(key, value) {
  try {
    if (value === null || value === undefined) localStorage.removeItem(PREFIX + key);
    else localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: nothing to do */
  }
}

/* My bookings: id + token let this device open the manage screen again. */

export function myBookings() {
  return read("my-bookings", []);
}

export function saveMyBooking({ booking, token }) {
  const list = myBookings().filter((b) => b.id !== booking.id);
  list.push({ id: booking.id, token, serviceId: booking.serviceId, barberId: booking.barberId, startUtc: booking.startUtc, status: booking.status });
  // Keep the list short; old entries are of no use on the device.
  write("my-bookings", list.sort((a, b) => a.startUtc - b.startUtc).slice(-10));
}

export function updateMyBooking(booking) {
  write(
    "my-bookings",
    myBookings().map((b) => (b.id === booking.id ? { ...b, startUtc: booking.startUtc, barberId: booking.barberId, status: booking.status } : b)),
  );
}

/* "Ripeti l'ultimo taglio": barber + service, and the contact details so the
   form is already filled. Stays on this device only. */

export const lastBooking = () => read("last-booking");
export const saveLastBooking = (value) => write("last-booking", value);

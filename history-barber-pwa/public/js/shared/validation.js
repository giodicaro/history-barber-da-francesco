// Customer-data validation, shared by the form (inline messages) and the API
// (authoritative check). Messages are user-facing, so they are in Italian.

export const LIMITS = { name: 60, email: 254, notes: 300 };

// Strip control characters and collapse whitespace: what we store is what the
// barber reads, nothing else.
export function clean(value, max) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/**
 * Italian-friendly phone normalisation: accepts spaces, dots, dashes,
 * parentheses and a +39 / 0039 prefix. Mobiles start with 3 (9–10 digits),
 * landlines with 0 (6–11 digits). Returns "+39…" or null.
 */
export function normalizePhone(value) {
  let digits = String(value ?? "").replace(/[\s.\-()/]/g, "");
  if (digits.startsWith("+39")) digits = digits.slice(3);
  else if (digits.startsWith("0039")) digits = digits.slice(4);
  if (!/^\d+$/.test(digits)) return null;
  if (/^3\d{8,9}$/.test(digits) || /^0\d{5,10}$/.test(digits)) return `+39${digits}`;
  return null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * @returns {{ ok: boolean, errors: Record<string,string>, value: object }}
 */
export function validateCustomer(input) {
  const errors = {};
  const name = clean(input?.name, LIMITS.name);
  const email = clean(input?.email, LIMITS.email).toLowerCase();
  const notes = clean(input?.notes, LIMITS.notes);
  const phone = normalizePhone(input?.phone);

  if (name.length < 2) errors.name = "Scrivi nome e cognome (almeno 2 caratteri).";
  if (!String(input?.phone ?? "").trim()) errors.phone = "Serve un numero di telefono.";
  else if (!phone) errors.phone = "Numero non valido: es. 348 123 4567 oppure 041 123456.";
  if (!email) errors.email = "Serve un indirizzo email.";
  else if (!EMAIL.test(email)) errors.email = "Email non valida: es. nome@esempio.it.";
  if (input?.privacy !== true) errors.privacy = "Per prenotare devi accettare l'informativa privacy.";

  return { ok: Object.keys(errors).length === 0, errors, value: { name, phone, email, notes } };
}

// Customer-data validation, shared by the form (inline messages) and the API
// (authoritative check). Messages are user-facing, so they are in Italian.

export const LIMITS = { name: 60, notes: 280 };

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
 * Italian phone normalisation, the same rule as the site and the agenda
 * (lib/prenotazioni/telefono.ts): spaces, dots, dashes and a +39 / 0039 / 39
 * prefix are accepted; 9–11 digits starting with 3 (mobile) or 0 (landline).
 * Returns "+39…" or null.
 */
export function normalizePhone(value) {
  const digits = String(value ?? "").replace(/[\s.\-()/]/g, "");
  const national = digits.replace(/^(\+39|0039|39)(?=\d{9})/, "");
  if (!/^\d{9,11}$/.test(national) || !/^[03]/.test(national)) return null;
  return `+39${national}`;
}

/**
 * @returns {{ ok: boolean, errors: Record<string,string>, value: object }}
 */
export function validateCustomer(input) {
  const errors = {};
  const name = clean(input?.name, LIMITS.name);
  const notes = clean(input?.notes, LIMITS.notes);
  const phone = normalizePhone(input?.phone);

  if (name.length < 2) errors.name = "Scrivi nome e cognome (almeno 2 caratteri).";
  if (!String(input?.phone ?? "").trim()) errors.phone = "Serve un numero di telefono.";
  else if (!phone) errors.phone = "Numero non valido: cellulare o fisso italiano, es. 348 123 4567.";
  if (input?.privacy !== true) errors.privacy = "Per prenotare devi accettare l'informativa privacy.";

  return { ok: Object.keys(errors).length === 0, errors, value: { name, phone, notes } };
}

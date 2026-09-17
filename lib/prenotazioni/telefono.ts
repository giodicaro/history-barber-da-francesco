/* Normalizzazione del telefono, condivisa fra widget e server.

   Sta in un file suo perché il widget la usa per la validazione mentre si
   scrive, e il server per fidarsi: stessa regola in tutti e due i posti, senza
   trascinare nel browser il resto della validazione. */

export function normalizzaTelefono(grezzo: string): string | null {
  const cifre = grezzo.replace(/[\s.\-()/]/g, "");
  const senzaPrefisso = cifre.replace(/^(\+39|0039|39)(?=\d{9})/, "");
  if (!/^\d{9,11}$/.test(senzaPrefisso)) return null;
  // Un cellulare italiano comincia per 3; i fissi di Venezia per 041.
  if (!/^[03]/.test(senzaPrefisso)) return null;
  return `+39${senzaPrefisso}`;
}

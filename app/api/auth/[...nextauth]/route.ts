import { handlers } from "@/auth";
import { configAccesso, rispostaNonDisponibile } from "@/lib/auth-config";

// Rotte di Auth.js (accesso, uscita, sessione): le genera la libreria.
// Senza configurazione valida rispondono 503 generico (fail-closed).
export function GET(...args: Parameters<typeof handlers.GET>) {
  return configAccesso().ok ? handlers.GET(...args) : rispostaNonDisponibile();
}

export function POST(...args: Parameters<typeof handlers.POST>) {
  return configAccesso().ok ? handlers.POST(...args) : rispostaNonDisponibile();
}

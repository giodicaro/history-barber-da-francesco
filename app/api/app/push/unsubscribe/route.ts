import { leggiCorpo, rispondi, togliIscrizioneCliente } from "@/lib/prenotazioni/app";

/** Il cliente spegne i promemoria: si dimentica il suo telefono. */
export async function POST(request: Request) {
  return rispondi(async () => {
    const { endpoint } = await leggiCorpo(request);
    if (typeof endpoint === "string") await togliIscrizioneCliente(endpoint);
    return { ok: true };
  });
}

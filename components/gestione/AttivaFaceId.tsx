"use client";

import { useEffect, useState } from "react";
import { browserSupportsWebAuthn, platformAuthenticatorIsAvailable, startRegistration } from "@simplewebauthn/browser";
import { Rotella } from "@/components/agenda/FoglioInBasso";

/* "Ritrovalo con Face ID o impronta su ogni tuo dispositivo" (N3), dopo la
   conferma della prenotazione. Facoltativo: un tocco e il sistema crea la
   passkey, che iCloud o Google portano sugli altri dispositivi del cliente.
   Compare solo se il dispositivo ha Face ID, impronta o PIN integrati;
   altrimenti niente, senza messaggi d'errore. */

export function AttivaFaceId() {
  const [disponibile, setDisponibile] = useState(false);
  const [stato, setStato] = useState<"pronto" | "invio" | "fatto" | "errore">("pronto");

  useEffect(() => {
    let vivo = true;
    if (browserSupportsWebAuthn()) {
      platformAuthenticatorIsAvailable()
        .then((si) => vivo && setDisponibile(si))
        .catch(() => {});
    }
    return () => {
      vivo = false;
    };
  }, []);

  if (!disponibile) return null;

  const attiva = async () => {
    setStato("invio");
    try {
      const posta = (corpo: unknown) =>
        fetch("/api/appuntamento/passkey/registra", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(corpo),
          credentials: "same-origin",
        });
      const opzioni = await posta({ fase: "opzioni" });
      if (!opzioni.ok) throw new Error();
      const risposta = await startRegistration({ optionsJSON: await opzioni.json() });
      const verifica = await posta({ fase: "verifica", risposta });
      setStato(verifica.status === 201 ? "fatto" : "errore");
    } catch {
      setStato("errore");
    }
  };

  return (
    <div className="mt-4">
      {stato === "fatto" ? (
        <p role="status" className="text-sm">
          Fatto: dagli altri tuoi dispositivi entri con Face ID o impronta.
        </p>
      ) : (
        <>
          <button
            type="button"
            onClick={attiva}
            disabled={stato === "invio"}
            aria-busy={stato === "invio"}
            className="eyebrow inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-3 border border-ink px-4 text-center transition-colors duration-200 hover:bg-ink hover:text-paper disabled:opacity-50"
          >
            {stato === "invio" && <Rotella />}
            Ritrovalo con Face ID o impronta su ogni tuo dispositivo
          </button>
          <p aria-live="polite" className="mt-2 text-sm text-steel">
            {stato === "errore" ? "Non è stato attivato. Puoi farlo quando vuoi da «Il mio appuntamento»." : "Facoltativo. Il sito non riceve mai volto né impronta."}
          </p>
        </>
      )}
    </div>
  );
}

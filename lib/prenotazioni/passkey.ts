import "server-only";
import { randomBytes } from "node:crypto";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { oraDiRoma } from "@/lib/orari";
import { salone } from "@/lib/salone";
import {
  appuntamentiDelCliente,
  idUtenteDelCliente,
  passkeyDelCliente,
  passkeyPerId,
  salvaPasskey,
  usaPasskey,
} from "./archivio";
import { leggiSfida, sfidaFirmata } from "./cliente";
import { chiave } from "./riconoscimento";

/* Face ID / impronta per ritrovarsi su un altro dispositivo (N3), con
   @simplewebauthn/server 14.

   - Passkey "scopribile" (residentKey required) e verifica dell'utente
     obbligatoria: all'accesso non serve sapere chi è, lo dice la passkey.
   - user.id = 32 byte casuali legati al cliente in passkey_clienti, non il
     cliente_id; il nome della passkey è "<Nome> · History Barber", mai il
     telefono.
   - La sfida sta in un cookie firmato che dura 5 minuti (niente tabella) e
     vale una volta sola per istanza (elenco in memoria delle sfide usate).
   Il sito non riceve mai volto né impronta: solo una chiave pubblica. */

const RP_NOME = salone.nomeCompleto;
const usate = ((globalThis as { __sfideUsate?: Map<string, number> }).__sfideUsate ??= new Map());

function consumaSfida(sfida: string): boolean {
  const adesso = Date.now();
  for (const [s, scade] of usate) if (scade < adesso) usate.delete(s);
  if (usate.has(sfida)) return false;
  usate.set(sfida, adesso + 10 * 60 * 1000);
  return true;
}

export async function opzioniRegistrazione(clienteId: string, rpID: string) {
  const k = chiave();
  if (!k) return null;
  const idUtente = (await idUtenteDelCliente(clienteId)) ?? randomBytes(32).toString("base64url");
  const [prossimo] = await appuntamentiDelCliente(clienteId, oraDiRoma().data);
  const nome = prossimo?.cliente.nome.trim().split(/\s+/)[0] || "Cliente";
  const opzioni = await generateRegistrationOptions({
    rpName: RP_NOME,
    rpID,
    userID: new Uint8Array(Buffer.from(idUtente, "base64url")),
    userName: `${nome} · History Barber`,
    userDisplayName: `${nome} · History Barber`,
    attestationType: "none",
    excludeCredentials: (await passkeyDelCliente(clienteId)).map((id) => ({ id })),
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
  });
  // Nella sfida firmata: il cliente e l'id utente da salvare alla verifica.
  return { opzioni, sfida: sfidaFirmata({ scopo: "registra", sfida: opzioni.challenge, clienteId: `${clienteId}|${idUtente}` }, k) };
}

export async function verificaRegistrazione(
  risposta: RegistrationResponseJSON,
  sfidaCookie: string | undefined,
  clienteId: string,
  atteso: { rpID: string; origin: string },
): Promise<boolean> {
  const k = chiave();
  const sfida = k ? leggiSfida(sfidaCookie, "registra", k) : null;
  if (!sfida?.clienteId) return false;
  const [clienteSfida, idUtente] = sfida.clienteId.split("|");
  if (clienteSfida !== clienteId || !idUtente || !consumaSfida(sfida.sfida)) return false;
  try {
    const v = await verifyRegistrationResponse({
      response: risposta,
      expectedChallenge: sfida.sfida,
      expectedOrigin: atteso.origin,
      expectedRPID: atteso.rpID,
      requireUserVerification: true,
    });
    if (!v.verified) return false;
    const c = v.registrationInfo.credential;
    await salvaPasskey({
      idCredenziale: c.id,
      chiavePubblica: c.publicKey,
      contatore: c.counter,
      trasporti: c.transports ?? [],
      idUtente,
      clienteId,
    });
    return true;
  } catch {
    return false;
  }
}

export async function opzioniAccesso(rpID: string) {
  const k = chiave();
  if (!k) return null;
  // Nessun allowCredentials: è la passkey a dire di chi è.
  const opzioni = await generateAuthenticationOptions({ rpID, userVerification: "required" });
  return { opzioni, sfida: sfidaFirmata({ scopo: "accedi", sfida: opzioni.challenge }, k) };
}

/** Il cliente_id della passkey se la firma è valida, altrimenti null. */
export async function verificaAccesso(
  risposta: AuthenticationResponseJSON,
  sfidaCookie: string | undefined,
  atteso: { rpID: string; origin: string },
): Promise<string | null> {
  const k = chiave();
  const sfida = k ? leggiSfida(sfidaCookie, "accedi", k) : null;
  if (!sfida || typeof risposta?.id !== "string") return null;
  const passkey = await passkeyPerId(risposta.id);
  if (!passkey || !consumaSfida(sfida.sfida)) return null;
  try {
    const v = await verifyAuthenticationResponse({
      response: risposta,
      expectedChallenge: sfida.sfida,
      expectedOrigin: atteso.origin,
      expectedRPID: atteso.rpID,
      credential: { id: passkey.idCredenziale, publicKey: passkey.chiavePubblica, counter: passkey.contatore, transports: passkey.trasporti },
      requireUserVerification: true,
    });
    if (!v.verified) return null;
    // Contatore: la libreria rifiuta quello che torna indietro; qui si
    // aggiorna solo se nessun altro l'ha già fatto nel frattempo.
    if (!(await usaPasskey(passkey.idCredenziale, passkey.contatore, v.authenticationInfo.newCounter))) return null;
    return passkey.clienteId;
  } catch {
    return null;
  }
}

import { auth } from "@/auth";
import { oraDiRoma, sommaGiorni } from "@/lib/orari";
import { LookbookNonPronto, perLog, salvaLook, type FotoInArrivo } from "@/lib/lookbook/archivio";
import { POSIZIONI } from "@/lib/lookbook/tipi";
import {
  analizzaNote,
  dataValida,
  MAX_FOTO,
  MAX_MINIATURA,
  MAX_RICHIESTA,
  tipoDaiByte,
  UUID,
} from "@/lib/lookbook/validazione";
import { operatori } from "@/lib/salone";

/* POST /api/lookbook — salva un look con le sue foto (multipart).

   Un Route Handler e non una Server Action: le Server Action accettano al
   massimo 1 MB di corpo (serverActions.bodySizeLimit), e tre foto con le
   miniature ci arrivano vicino. Qui il tetto è 3 MB, sotto i 4,5 MB oltre cui
   Vercel taglia la richiesta.

   Il proxy (proxy.ts) protegge solo /admin: questa rotta si difende da sola, con
   la sessione controllata per prima cosa.

   Campi: id (UUID scelto dal browser: un secondo invio dello stesso look non
   lo duplica), clienteId, data, preferito ("1"/"0"), le note, e per ogni
   posizione `foto-<posizione>` + `mini-<posizione>`. */

const SENZA_CACHE = { "Cache-Control": "no-store" };

const risposta = (stato: number, corpo: object) => Response.json(corpo, { status: stato, headers: SENZA_CACHE });
const errore = (stato: number, messaggio: string, campi?: Record<string, string>) =>
  risposta(stato, { ok: false, errore: messaggio, ...(campi ? { campi } : {}) });

class TroppoGrande extends Error {}

// Legge il corpo contando i byte e smette oltre il tetto: Content-Length si
// può omettere o falsificare, e request.formData() leggerebbe tutto.
async function corpoLimitato(richiesta: Request): Promise<Uint8Array<ArrayBuffer>> {
  const dichiarato = Number(richiesta.headers.get("content-length") ?? 0);
  if (dichiarato > MAX_RICHIESTA) throw new TroppoGrande();
  if (!richiesta.body) return new Uint8Array();
  const pezzi: Uint8Array[] = [];
  let totale = 0;
  const lettore = richiesta.body.getReader();
  for (;;) {
    const { done, value } = await lettore.read();
    if (done) break;
    totale += value.byteLength;
    if (totale > MAX_RICHIESTA) {
      await lettore.cancel();
      throw new TroppoGrande();
    }
    pezzi.push(value);
  }
  const tutto = new Uint8Array(totale);
  let posizione = 0;
  for (const p of pezzi) {
    tutto.set(p, posizione);
    posizione += p.byteLength;
  }
  return tutto;
}

export async function POST(richiesta: Request) {
  const sessione = await auth();
  if (!sessione?.user) return errore(401, "Sessione scaduta: rientra nell'agenda.");

  const tipoCorpo = richiesta.headers.get("content-type") ?? "";
  if (!tipoCorpo.startsWith("multipart/form-data")) return errore(415, "Formato della richiesta non valido.");

  let modulo: FormData;
  try {
    const byte = await corpoLimitato(richiesta);
    modulo = await new Response(byte, { headers: { "content-type": tipoCorpo } }).formData();
  } catch (e) {
    if (e instanceof TroppoGrande) return errore(413, "Le foto sono troppo pesanti. Riprova a scattarle.");
    return errore(400, "Richiesta non leggibile.");
  }

  // Al massimo: 5 note, 4 campi di servizio, 6 file.
  if ([...modulo.keys()].length > 20) return errore(400, "Troppi campi.");

  const testo = (chiave: string) => {
    const v = modulo.get(chiave);
    return typeof v === "string" ? v : "";
  };

  const id = testo("id");
  const clienteId = testo("clienteId");
  if (!UUID.test(id) || !UUID.test(clienteId)) return errore(400, "Richiesta non valida.");

  const note = analizzaNote(Object.fromEntries([...modulo.entries()].filter(([, v]) => typeof v === "string")));
  if (!note.ok) return errore(400, "Controlla le note segnate.", note.errori);

  // La data è quella in cui è stato fatto il look: una bozza rimasta sul
  // telefono e inviata il giorno dopo tiene la sua. Mai nel futuro, mai più
  // vecchia di un anno.
  const oggi = oraDiRoma().data;
  const dataChiesta = testo("data");
  const data = dataValida(dataChiesta) && dataChiesta <= oggi && dataChiesta >= sommaGiorni(oggi, -366) ? dataChiesta : oggi;

  const foto: FotoInArrivo[] = [];
  for (const posizione of POSIZIONI) {
    const intera = modulo.get(`foto-${posizione}`);
    const mini = modulo.get(`mini-${posizione}`);
    if (intera === null && mini === null) continue;
    if (!(intera instanceof Blob) || !(mini instanceof Blob)) return errore(400, "Foto incompleta.");
    if (intera.size > MAX_FOTO || mini.size > MAX_MINIATURA) {
      return errore(413, "Una foto è troppo pesante. Riprova a scattarla.");
    }
    const [byteFoto, byteMini] = await Promise.all([intera.arrayBuffer(), mini.arrayBuffer()]).then((b) =>
      b.map((x) => Buffer.from(x)),
    );
    // Il tipo vero si legge dai byte: il Content-Type del browser non conta.
    const tipo = tipoDaiByte(byteFoto);
    if (!tipo || tipoDaiByte(byteMini) !== tipo) return errore(415, "Formato della foto non valido.");
    foto.push({ posizione, tipo, dati: byteFoto, miniatura: byteMini });
  }
  if (foto.length === 0) return errore(400, "Serve almeno una foto.");

  try {
    const salvato = await salvaLook({
      id,
      clienteId,
      operatoreId: operatori[0].id,
      data,
      note: note.note,
      preferito: testo("preferito") === "1",
      foto,
    });
    if (!salvato) return errore(404, "Questa scheda non esiste più.");
    return risposta(201, { ok: true, id: salvato });
  } catch (e) {
    if (e instanceof LookbookNonPronto) return errore(503, "Lookbook non ancora attivo su questo database.");
    console.error("[lookbook] salvataggio del look non riuscito", perLog(e));
    return errore(500, "Salvataggio non riuscito. Riprova.");
  }
}

import type { NoteLook, Posizione, TipoImmagine } from "./tipi";

/* Bozza del Nuovo look sul telefono del barbiere (IndexedDB, senza librerie).

   Prima di ogni invio foto compresse e note si salvano qui. Se la rete
   manca, la bozza resta e il foglio offre "Riprova"; a invio riuscito si
   cancella. Una bozza per cliente. Niente Background Sync (iOS non lo ha) e
   niente invii automatici nascosti: decide sempre Francesco.

   Se IndexedDB non c'è (navigazione privata di vecchi Safari) ogni funzione
   fallisce in silenzio: si perde solo la bozza, non il salvataggio. */

export interface FotoBozza {
  posizione: Posizione;
  tipo: TipoImmagine;
  foto: Blob;
  miniatura: Blob;
}

export interface Bozza {
  /** Id del look, scelto qui: un secondo invio non lo duplica. */
  id: string;
  clienteId: string;
  data: string;
  note: NoteLook;
  preferito: boolean;
  foto: FotoBozza[];
  salvataIl: number;
}

const NOME = "lookbook";
const ARCHIVIO = "bozze";

function apri(): Promise<IDBDatabase> {
  return new Promise((risolvi, rifiuta) => {
    const r = indexedDB.open(NOME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(ARCHIVIO, { keyPath: "clienteId" });
    r.onsuccess = () => risolvi(r.result);
    r.onerror = () => rifiuta(r.error);
  });
}

async function operazione<T>(modo: IDBTransactionMode, fai: (s: IDBObjectStore) => IDBRequest): Promise<T | undefined> {
  try {
    const db = await apri();
    return await new Promise<T>((risolvi, rifiuta) => {
      const t = db.transaction(ARCHIVIO, modo);
      const r = fai(t.objectStore(ARCHIVIO));
      t.oncomplete = () => {
        db.close();
        risolvi(r.result as T);
      };
      t.onerror = t.onabort = () => {
        db.close();
        rifiuta(t.error);
      };
    });
  } catch {
    return undefined;
  }
}

export const leggiBozza = (clienteId: string) => operazione<Bozza>("readonly", (s) => s.get(clienteId));
export const salvaBozza = (b: Bozza) => operazione("readwrite", (s) => s.put(b)).then(() => undefined);
export const cancellaBozza = (clienteId: string) => operazione("readwrite", (s) => s.delete(clienteId)).then(() => undefined);

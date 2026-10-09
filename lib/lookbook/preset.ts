import type { CampoNota } from "./tipi";

/* Scorciatoie a tocco per le note del Nuovo look: le parole che Francesco
   scriverebbe comunque, già pronte. Un tocco le aggiunge al campo (separate
   da " · "), un secondo tocco le toglie; il testo libero resta sempre
   possibile.

   ⚠️ Lista di partenza scritta senza Francesco: le voci vanno riviste con lui
   dopo le prime settimane (quali usa, quali mancano). Cambiarle qui basta. */

export const PRESET: Partial<Record<CampoNota, string[]>> = {
  sfumatura: ["Skin fade", "Low fade", "Mid fade", "High fade", "Zero", "0,5 mm", "1", "1,5", "2", "3", "Rasoio", "Sfumatura alta", "Sfumatura bassa"],
  sopra: ["Forbice 1 cm", "Forbice 3 cm", "Forbice 5 cm", "Macchinetta 4", "Macchinetta 6", "Texturizzato", "Pettinato indietro", "Riga di lato", "Frangia"],
  barba: ["Rifinita", "Corta 3 mm", "Contorni a rasoio", "Panno caldo", "Rasata", "Sfumata sulle basette"],
  prodotto: ["Cera opaca", "Pasta", "Pomata lucida", "Argilla", "Spray sale", "Olio barba", "Niente"],
};

export const SEPARATORE = " · ";

/** Aggiunge o toglie una scorciatoia dal testo del campo. */
export function alternaPreset(valore: string, voce: string): string {
  const parti = valore
    .split(SEPARATORE)
    .map((p) => p.trim())
    .filter(Boolean);
  const indice = parti.indexOf(voce);
  if (indice >= 0) parti.splice(indice, 1);
  else parti.push(voce);
  return parti.join(SEPARATORE);
}

export const presetAttivo = (valore: string, voce: string) =>
  valore.split(SEPARATORE).map((p) => p.trim()).includes(voce);

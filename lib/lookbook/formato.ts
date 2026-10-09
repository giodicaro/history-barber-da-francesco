/* Formati di testo del lookbook, validi sul server e nel browser. */

const dataBreve = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** "3 ott 2026" (dentro `info` diventa maiuscolo). La data è una giornata
    di salone "YYYY-MM-DD": letta a mezzogiorno UTC non cambia giorno. */
export const dataLook = (data: string) => dataBreve.format(new Date(`${data}T12:00:00Z`));

/** Il nome di battesimo, per parlare al cliente: "Mario Rossi" → "Mario". */
export const battesimo = (nome: string) => nome.trim().split(/\s+/)[0] ?? nome;

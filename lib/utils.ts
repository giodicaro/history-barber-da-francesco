export function cn(...classi: (string | false | null | undefined)[]) {
  return classi.filter(Boolean).join(" ");
}

// Creato al primo prezzo e non al caricamento: questo file lo importano tutti
// i componenti (per cn) e un Intl.NumberFormat costava circa 60 ms a ogni
// apertura della home con la CPU 4 volte più lenta (profilo del 7/11), anche
// senza prezzi da formattare.
let euro: Intl.NumberFormat | undefined;

export function formatoPrezzo(prezzo: number) {
  euro ??= new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
  return euro.format(prezzo);
}

export function cn(...classi: (string | false | null | undefined)[]) {
  return classi.filter(Boolean).join(" ");
}

const euro = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function formatoPrezzo(prezzo: number) {
  return euro.format(prezzo);
}

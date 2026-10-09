/* Classi dei campi e dei bottoni dei fogli dell'agenda, condivise con il
   lookbook (components/lookbook/): stessi bordi, stesse altezze, stessi
   stati. Spostate qui da FoglioVoce.tsx senza cambiare una classe. */

export const campo =
  "mt-2 block min-h-12 w-full appearance-none rounded-none border border-ink/30 bg-paper px-3 text-base text-ink outline-none transition-colors duration-150 focus:border-ink aria-invalid:border-ink aria-invalid:border-2";

export const bottonePieno =
  "eyebrow flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-3 border border-ink bg-ink px-5 text-paper transition-colors duration-150 hover:bg-paper hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-ink disabled:hover:text-paper";

export const bottoneVuoto =
  "eyebrow flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-3 border border-ink px-5 transition-colors duration-150 hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:opacity-50";

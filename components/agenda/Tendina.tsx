import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { campo } from "./stili";

/* Tendina dei fogli dell'agenda: <select> nativo (sul telefono apre il
   selettore del sistema, senza tastiera) con la freccia disegnata a mano,
   perché `campo` toglie quella del browser. */
export function Tendina({ children, ...props }: ComponentProps<"select">) {
  return (
    <span className="relative block">
      <select {...props} className={cn(campo, "pr-10")}>
        {children}
      </select>
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className="pointer-events-none absolute right-3 top-[calc(50%+0.25rem)] size-4 -translate-y-1/2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </span>
  );
}

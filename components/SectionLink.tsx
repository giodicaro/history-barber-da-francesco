"use client";

import type { ComponentPropsWithoutRef } from "react";
import { useVaiASezione } from "./SmoothScroll";

type Props = Omit<ComponentPropsWithoutRef<"a">, "href"> & { id: string };

// Link interno con scorrimento morbido. Resta un <a href="#..."> vero: senza
// JavaScript fa il salto nativo, con lo stesso scroll-margin.
export function SectionLink({ id, onClick, ...resto }: Props) {
  const vaiA = useVaiASezione();
  return (
    <a
      {...resto}
      href={`#${id}`}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        e.preventDefault();
        vaiA(id);
      }}
    />
  );
}

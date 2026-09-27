import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

/* Tutto ciò che sta sotto /admin è l'agenda, installabile come app sulla
   schermata Home del telefono (serve per le notifiche sull'iPhone).
   Il manifest vale solo qui: il sito vetrina resta un sito normale. */

export const metadata: Metadata = {
  manifest: "/agenda/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Agenda HB",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/agenda/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function LayoutAgenda({ children }: { children: ReactNode }) {
  return children;
}

import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Syne } from "next/font/google";
import "./globals.css";

// Tre voci, tre ruoli: Syne per i titoli giganti (è il tratto riconoscibile
// del sito), Inter per testi e listino, JetBrains Mono per le informazioni
// pratiche (indirizzo, orari, stato di apertura). Tutti variabili: un file
// per famiglia copre ogni peso usato.
const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin", "latin-ext"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "History Barber da Francesco — Barbiere a Mestre",
  description:
    "Barbiere in Via Ca' Rossa 47/A-B a Mestre (VE). Tagli, sfumature e barba, solo su appuntamento. Da martedì a sabato.",
  openGraph: {
    title: "History Barber da Francesco",
    description:
      "L'eccellenza del grooming maschile. Via Ca' Rossa 47/A-B, Mestre (VE). Solo su appuntamento.",
    locale: "it_IT",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="it"
      className={`${syne.variable} ${inter.variable} ${jetbrainsMono.variable} antialiased`}
    >
      <body>
        {/* Senza JavaScript GSAP non parte e i testi resterebbero invisibili. */}
        <noscript>
          <style>{`[data-reveal],[data-slide]{opacity:1!important;transform:none!important}[data-mask-line]>span{transform:none!important}`}</style>
        </noscript>
        {children}
      </body>
    </html>
  );
}

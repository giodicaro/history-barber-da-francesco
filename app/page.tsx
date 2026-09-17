import { ChiSiamo } from "@/components/ChiSiamo";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { Navbar } from "@/components/Navbar";
import { Portfolio } from "@/components/Portfolio";
import { PriceList } from "@/components/PriceList";
import { RevealOnScroll } from "@/components/RevealOnScroll";
import { SmoothScroll } from "@/components/SmoothScroll";
import { orari, salone } from "@/lib/salone";

const giorniSchema = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const orarioSchema = (minuti: number) =>
  `${String(Math.floor(minuti / 60)).padStart(2, "0")}:${String(minuti % 60).padStart(2, "0")}`;

// Dati strutturati per Google: stessa sorgente degli orari mostrati in pagina.
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "HairSalon",
  name: salone.nomeCompleto,
  telephone: "+39 348 697 6353",
  address: {
    "@type": "PostalAddress",
    streetAddress: salone.via,
    postalCode: salone.cap,
    addressLocality: "Venezia",
    addressRegion: salone.provincia,
    addressCountry: "IT",
  },
  sameAs: [salone.instagramHref],
  openingHoursSpecification: orari.flatMap((giorno, i) =>
    giorno.turni.map((t) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: giorniSchema[i],
      opens: orarioSchema(t.apre),
      closes: orarioSchema(t.chiude),
    })),
  ),
};

export default function Home() {
  return (
    <SmoothScroll>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <a
        href="#chi-siamo"
        className="label sr-only z-50 bg-paper p-3 text-ink focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Vai al contenuto
      </a>
      <Navbar />
      {/* Contenitore reso inerte dal menu aperto. */}
      <div id="contenuto">
        <main>
          <Hero />
          <ChiSiamo />
          <Portfolio />
          <PriceList />
        </main>
        <Footer />
      </div>
      <RevealOnScroll />
    </SmoothScroll>
  );
}

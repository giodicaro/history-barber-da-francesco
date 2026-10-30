import type { MetadataRoute } from "next";
import { salone } from "@/lib/salone";

/* Le sole pagine pubbliche: la home (con tutte le sezioni) e l'informativa. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${salone.sito}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${salone.sito}/privacy`, changeFrequency: "yearly", priority: 0.3 },
  ];
}

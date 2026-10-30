import type { MetadataRoute } from "next";
import { salone } from "@/lib/salone";

/* robots.txt: il sito pubblico si indicizza; agenda, API e pagine personali
   di "Il mio appuntamento" no (hanno anche noindex nelle intestazioni). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/appuntamento"] },
    sitemap: `${salone.sito}/sitemap.xml`,
  };
}

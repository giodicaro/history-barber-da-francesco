"use client";

import {
  EASE,
  gsap,
  prefersReducedMotion,
  prendiInCarico,
  ScrollTrigger,
  useIsoLayoutEffect,
} from "@/lib/gsap";

// Distanza da cui salgono gli elementi, uguale per tutto il sito.
const SALITA = 50;

/* Animazioni d'entrata di tutta la pagina, fuori dalla hero (che ha la sua
   sequenza al caricamento). Non disegna nulla: trova gli elementi marcati e
   li affida a ScrollTrigger.

   - [data-reveal]                     sale di 50px e compare
   - [data-slide-item] [data-slide]    cascata del listino: ogni categoria e
                                       ogni riga è un gruppo che entra quando
                                       arriva in vista; dentro la riga il nome
                                       precede di poco il prezzo
   - [data-mask-line="scroll"] > span  sale da dietro la maschera

   La scansione non avviene una volta sola: un MutationObserver prende in
   carico anche gli elementi aggiunti dopo il montaggio. Senza, un elemento
   sostituito (ricaricamento a caldo in sviluppo, contenuti che cambiano)
   restava nascosto dal CSS per sempre.

   ScrollTrigger e non IntersectionObserver: con un salto via ancora o uno
   scroll molto rapido l'observer può non ricevere mai la soglia, e gli
   elementi resterebbero invisibili. ScrollTrigger scatta anche se la soglia
   viene scavalcata. */
export function RevealOnScroll() {
  useIsoLayoutEffect(() => {
    const ridotto = prefersReducedMotion();
    const ctx = gsap.context(() => {});
    const fuoriHero = (el: Element) => !el.closest("[data-hero]");
    const trova = <T extends HTMLElement>(selettore: string) =>
      gsap.utils.toArray<T>(selettore).filter(fuoriHero);

    const prepara = (tardiva: boolean) => {
      let nuovi = 0;
      // Tutto dentro il contesto, anche la presa in carico: così la pulizia
      // annulla pure gli stili fissati per gli elementi già visibili.
      ctx.add(() => {
        const comparse = prendiInCarico(trova("[data-reveal]"));
        const scivolanti = prendiInCarico(trova("[data-slide]"));
        const maschere = prendiInCarico(trova("[data-mask-line='scroll']"));
        nuovi = comparse.length + scivolanti.length + maschere.length;
        // Con il movimento ridotto il CSS li mostra già: basta averli marcati.
        if (ridotto || nuovi === 0) return;

        if (comparse.length) {
          gsap.set(comparse, { y: SALITA });
          ScrollTrigger.batch(comparse, {
            start: "top 90%",
            once: true,
            onEnter: (gruppo) =>
              gsap.to(gruppo, { opacity: 1, y: 0, duration: 1, ease: EASE, stagger: 0.08, overwrite: true }),
          });
        }

        if (scivolanti.length) {
          // Il CSS parte già da translateY(50px): lo dichiariamo anche a GSAP,
          // così la sua lettura iniziale coincide con quella del browser.
          gsap.set(scivolanti, { y: SALITA });
          const gruppi = [
            ...new Set(scivolanti.map((el) => el.closest<HTMLElement>("[data-slide-item]") ?? el)),
          ];
          ScrollTrigger.batch(gruppi, {
            start: "top 92%",
            interval: 0.12,
            once: true,
            onEnter: (entrati) =>
              gsap.to(
                scivolanti.filter((el) => entrati.some((g) => g === el || g.contains(el))),
                { opacity: 1, y: 0, duration: 0.9, ease: "power3.out", stagger: 0.07, overwrite: true },
              ),
          });
        }

        maschere.forEach((riga) => {
          gsap.fromTo(
            riga.children,
            { y: 0, yPercent: 105 },
            {
              yPercent: 0,
              duration: 1.2,
              ease: EASE,
              scrollTrigger: { trigger: riga, start: "top 92%", once: true },
            },
          );
        });
      });

      // I trigger creati dopo il caricamento calcolano la loro posizione su
      // una pagina che nel frattempo può essere cambiata: si ricalcola tutto.
      if (tardiva && nuovi > 0 && !ridotto) ScrollTrigger.refresh();
    };

    prepara(false);

    let attesa = 0;
    const osservatore = new MutationObserver((mutazioni) => {
      if (!mutazioni.some((m) => m.addedNodes.length > 0)) return;
      cancelAnimationFrame(attesa);
      attesa = requestAnimationFrame(() => prepara(true));
    });
    osservatore.observe(document.body, { childList: true, subtree: true });

    return () => {
      osservatore.disconnect();
      cancelAnimationFrame(attesa);
      ctx.revert();
      // revert toglie gli stili in linea: senza togliere anche il segno, gli
      // elementi tornerebbero nascosti dal CSS e fuori dalla rete di sicurezza.
      document.querySelectorAll("[data-animato]").forEach((el) => {
        if (fuoriHero(el)) el.removeAttribute("data-animato");
      });
    };
  }, []);

  return null;
}

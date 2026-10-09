import type { Metadata } from "next";
import Link from "next/link";
import { CONSERVAZIONE_LOOKBOOK_MESI, CONSERVAZIONE_MESI, salone } from "@/lib/salone";

/* Informativa privacy (art. 13 GDPR) per chi prenota dal sito e per chi
   accetta il Lookbook personale (foto e note del taglio, con consenso).

   Il sito non usa cookie di profilazione né statistiche: l'unico cookie è
   quello tecnico della sessione dell'agenda, che riguarda solo il salone.
   Per questo non serve un banner dei cookie.

   Titolare e P.IVA vengono da `lib/salone.ts`: finché sono vuoti la pagina
   indica il salone per nome, indirizzo e telefono, che bastano a
   contattarlo, ma prima della consegna vanno compilati. */

export const metadata: Metadata = {
  title: "Informativa privacy — History Barber da Francesco",
  description: "Come History Barber da Francesco tratta i dati di chi prenota dal sito e di chi usa il lookbook.",
};

const AGGIORNATA = "10 ottobre 2026";

export default function Privacy() {
  const indirizzo = `${salone.via}, ${salone.cap} ${salone.citta} (${salone.provincia})`;

  return (
    <main className="min-h-svh bg-paper text-ink">
      <div className="shell max-w-2xl py-12 md:py-20">
        <Link href="/" className="eyebrow inline-flex min-h-11 items-center hover:underline">
          ← {salone.nomeCompleto}
        </Link>
        <h1 className="display mt-6 text-[clamp(2.25rem,8vw,4.5rem)]">Privacy</h1>
        <p className="info mt-4 text-ink/70">
          Informativa per chi prenota dal sito e per il lookbook · aggiornata al {AGGIORNATA}
        </p>

        <div className="mt-12 space-y-10 text-base leading-relaxed [&_h2]:eyebrow [&_h2]:mb-3">
          <section>
            <h2>Chi tratta i dati</h2>
            <p>
              {salone.titolare ? `${salone.titolare}, titolare di ` : ""}
              {salone.nomeCompleto}, {indirizzo}
              {salone.partitaIva && `, P.IVA ${salone.partitaIva}`}. Per qualsiasi richiesta sui tuoi dati puoi
              chiamare il{" "}
              <a href={salone.telefonoHref} className="underline underline-offset-4">
                {salone.telefono}
              </a>{" "}
              o passare in salone.
            </p>
          </section>

          <section>
            <h2>Quali dati e perché</h2>
            <p>
              Quando prenoti ci lasci <b>nome</b>, <b>telefono</b> ed eventuali <b>note</b>, insieme al servizio e
              all&apos;orario scelti. Li usiamo solo per gestire il tuo appuntamento: riservarti la poltrona e, se
              serve, chiamarti per confermarlo o spostarlo. La base giuridica è l&apos;esecuzione della tua richiesta
              (art. 6.1.b GDPR): senza nome e telefono non possiamo fissare l&apos;appuntamento.
            </p>
            <p className="mt-3">
              Non usiamo i tuoi dati per pubblicità, non li vendiamo e non li cediamo a nessuno. Per evitare
              prenotazioni automatiche il sito ricorda per pochi minuti l&apos;indirizzo IP da cui arriva la
              richiesta.
            </p>
          </section>

          <section>
            <h2>Per quanto tempo</h2>
            <p>
              Il tempo necessario a gestire l&apos;appuntamento, e comunque non oltre {CONSERVAZIONE_MESI} mesi dalla
              data dell&apos;appuntamento: dopo, i dati vengono cancellati in automatico.
            </p>
          </section>

          <section id="lookbook">
            <h2>Lookbook personale (facoltativo)</h2>
            <p>
              Se sei d&apos;accordo, dopo il taglio conserviamo le <b>foto del lavoro finito</b> (dietro, di profilo
              e, se vuoi, davanti), le <b>note tecniche</b> (sfumatura, lunghezze, barba, prodotto), il tuo{" "}
              <b>nome</b> e, se lo lasci, il <b>telefono</b>. Servono a ricordare com&apos;è fatto il tuo taglio e a
              rifarlo uguale la volta dopo.
            </p>
            <p className="mt-3">
              La base giuridica è il tuo <b>consenso</b> (art. 6.1.a GDPR), che chiediamo in salone prima di creare la
              scheda. Puoi ritirarlo quando vuoi, senza conseguenze sugli appuntamenti: basta chiamare il{" "}
              <a href={salone.telefonoHref} className="underline underline-offset-4">
                {salone.telefono}
              </a>{" "}
              o dirlo in salone, e cancelliamo scheda, foto e note.
            </p>
            <p className="mt-3">
              Foto e note le vedi solo tu, dalla pagina &ldquo;Il mio stile&rdquo;, con il link personale che ti diamo
              (anche con un codice QR). Chi non ha il link non le vede, e la pagina non compare nei motori di
              ricerca. Se il link finisce in mani sbagliate possiamo cambiarlo: quello vecchio smette di funzionare.
            </p>
            <p className="mt-3">
              Restano al massimo {CONSERVAZIONE_LOOKBOOK_MESI} mesi dal tuo ultimo taglio fotografato: dopo, la scheda
              viene cancellata in automatico con tutte le foto. Per funzionare anche senza rete, la pagina
              &ldquo;Il mio stile&rdquo; tiene una copia sul tuo telefono; se la scheda viene cancellata, la copia
              sparisce la prima volta che riapri la pagina con la rete.
            </p>
          </section>

          <section>
            <h2>Dove stanno</h2>
            <p>
              Il sito è ospitato da Vercel Inc.; le prenotazioni e il lookbook sono salvati in un database di Neon.
              Entrambi trattano i dati per nostro conto come responsabili del trattamento, su server nell&apos;Unione
              Europea (Francoforte). Quando arriva una prenotazione, il salone riceve una notifica sul proprio
              telefono.
            </p>
          </section>

          <section>
            <h2>I tuoi diritti</h2>
            <p>
              Puoi chiederci in qualsiasi momento di vedere, correggere o cancellare i tuoi dati, o di limitarne
              l&apos;uso (artt. 15–22 GDPR). Se pensi che non li trattiamo correttamente puoi rivolgerti al Garante per
              la protezione dei dati personali (garanteprivacy.it).
            </p>
          </section>

          <section>
            <h2>Cookie</h2>
            <p>
              Il sito non usa cookie di profilazione né strumenti di statistica. L&apos;unico cookie è tecnico e serve
              al salone per accedere alla propria agenda. La copia di &ldquo;Il mio stile&rdquo; sul tuo telefono è
              una memoria tecnica del browser, che serve solo a mostrarti la pagina senza rete.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

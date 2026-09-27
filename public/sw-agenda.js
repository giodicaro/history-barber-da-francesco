/* Service worker dell'agenda di History Barber.
   Fa una cosa sola: mostrare le notifiche delle nuove prenotazioni e, al
   tocco, aprire l'agenda sul giorno giusto. Non mette niente in cache: l'agenda
   deve sempre mostrare i dati veri, mai una copia vecchia.
   Registrato da components/agenda/Notifiche.tsx con scope "/admin". */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (evento) => evento.waitUntil(self.clients.claim()));

self.addEventListener("push", (evento) => {
  let dati = { titolo: "History Barber", testo: "Nuova prenotazione", url: "/admin" };
  try {
    if (evento.data) dati = { ...dati, ...evento.data.json() };
  } catch {
    // Messaggio non in JSON: resta il testo generico.
  }
  evento.waitUntil(
    self.registration.showNotification(dati.titolo, {
      body: dati.testo,
      icon: "/agenda/icona-192.png",
      badge: "/agenda/icona-192.png",
      tag: dati.tag,
      data: { url: dati.url },
    }),
  );
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const destinazione = new URL(evento.notification.data?.url || "/admin", self.location.origin).href;
  evento.waitUntil(
    (async () => {
      // Se l'agenda è già aperta la si porta davanti sul giorno giusto,
      // altrimenti se ne apre una nuova.
      const aperte = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const finestra of aperte) {
        if (new URL(finestra.url).pathname.startsWith("/admin") && "focus" in finestra) {
          await finestra.navigate(destinazione).catch(() => {});
          return finestra.focus();
        }
      }
      return self.clients.openWindow(destinazione);
    })(),
  );
});

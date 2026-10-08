/* Offline booking queue in IndexedDB, shared by the page and the service
   worker. It is a classic script (not a module) so the worker can load it
   with importScripts(); both contexts use it through `self.HBOutbox`.

   A queued booking is never "confirmed": it stays "pending" until the server
   answers. Every item carries its clientRequestId, so sending it twice (page
   and worker racing after reconnecting) creates one booking only. */

(function () {
  "use strict";

  var DB_NAME = "history-barber";
  var STORE = "outbox";
  var dbPromise = null;

  function open() {
    if (!dbPromise) {
      dbPromise = new Promise(function (resolve, reject) {
        var req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = function () {
          req.result.createObjectStore(STORE, { keyPath: "id" });
        };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
      });
    }
    return dbPromise;
  }

  function tx(mode, fn) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(STORE, mode);
        var result = fn(t.objectStore(STORE));
        t.oncomplete = function () { resolve(result && "result" in result ? result.result : undefined); };
        t.onerror = function () { reject(t.error); };
      });
    });
  }

  var flushing = null;

  var HBOutbox = {
    add: function (item) { return tx("readwrite", function (s) { return s.put(item); }); },
    put: function (item) { return tx("readwrite", function (s) { return s.put(item); }); },
    remove: function (id) { return tx("readwrite", function (s) { return s.delete(id); }); },
    all: function () {
      return tx("readonly", function (s) { return s.getAll(); }).then(function (items) {
        return (items || []).sort(function (a, b) { return a.createdAt - b.createdAt; });
      });
    },

    /**
     * Send every pending item to `apiBase + "bookings"`. Resolves with the
     * items whose status changed. Rejects on a network error, which is what
     * Background Sync needs to schedule a retry.
     */
    flush: function (apiBase) {
      if (flushing) return flushing;
      flushing = HBOutbox.all()
        .then(function (items) {
          var pending = items.filter(function (i) { return i.status === "pending"; });
          var changed = [];
          return pending
            .reduce(function (chain, item) {
              return chain.then(function () {
                return fetch(apiBase + "bookings", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(item.payload),
                }).then(function (res) {
                  return res.json().catch(function () { return {}; }).then(function (body) {
                    if (res.ok) {
                      item.status = "sent";
                      item.result = { booking: body.booking, token: body.token };
                    } else if (res.status === 409) {
                      item.status = "conflict";
                      item.error = body.message || "Orario non più disponibile.";
                    } else if (res.status >= 500 || res.status === 429 && body.error === "rate_limited") {
                      return; // transient: leave it pending for the next attempt
                    } else {
                      item.status = "rejected";
                      item.error = body.message || "Prenotazione rifiutata dal server.";
                    }
                    item.updatedAt = Date.now();
                    changed.push(item);
                    return HBOutbox.put(item);
                  });
                });
              });
            }, Promise.resolve())
            .then(function () { return changed; });
        })
        .finally(function () { flushing = null; });
      return flushing;
    },
  };

  self.HBOutbox = HBOutbox;
})();

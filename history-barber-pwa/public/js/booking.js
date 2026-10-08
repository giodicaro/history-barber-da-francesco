// Booking flow: a 5-step state machine (barber → service → date/time →
// details → summary), the confirmation screen, the offline queue view and
// the "Gestisci prenotazione" screen. State lives in one object; every
// change goes through `go()` / `render()`.

import { api, apiBase, ApiError, OfflineError, getMode } from "./api.js";
import { ANY_BARBER, findBarber, findService } from "./shared/slots.js";
import { validateCustomer } from "./shared/validation.js";
import * as store from "./store.js";
import { el, svg, toast, confirmDialog, downloadIcs, formatDateLong, formatDow, formatDay, formatMonth, formatPrice, formatWhen, capitalize } from "./ui.js";

const STEPS = ["Barbiere", "Servizio", "Data e ora", "I tuoi dati", "Riepilogo"];
const $ = (id) => document.getElementById(id);

let shop;
let notifications;
const state = { step: 1, barberId: null, serviceId: null, date: null, time: null, customer: {}, days: [], slots: [], stale: false, busy: false };

const tz = () => shop.shop.timezone;
const barberName = (id) => (id === ANY_BARBER ? "Primo disponibile" : findBarber(shop, id)?.name ?? id);
const initials = (name) => name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();

/* ── Option rendering (radios styled as cards: native keyboard support) ── */

function choice({ name, value, checked, disabled, body, label }) {
  const id = `${name}-${value}`;
  return el(
    "div",
    { class: "choice" },
    el("input", { type: "radio", name, id, value, checked, disabled, "aria-label": label }),
    el("label", { for: id, class: "choice-body" }, body),
  );
}

function renderBarbers() {
  const list = [...shop.barbers.map((b) => ({ id: b.id, name: b.name, meta: b.role ?? "" })), { id: ANY_BARBER, name: "Primo disponibile", meta: "Il primo orario libero, con chiunque" }];
  $("barber-options").replaceChildren(
    ...list.map((b) =>
      choice({
        name: "barber",
        value: b.id,
        checked: state.barberId === b.id,
        body: [
          el("span", { class: `avatar${b.id === ANY_BARBER ? " avatar-any" : ""}`, "aria-hidden": "true", text: b.id === ANY_BARBER ? "★" : initials(b.name) }),
          el("span", { class: "choice-main" }, el("span", { class: "choice-name", text: b.name }), el("span", { class: "choice-meta", text: b.meta })),
        ],
      }),
    ),
  );
}

function renderServices() {
  const nodes = [];
  for (const cat of shop.categories) {
    const services = shop.services.filter((s) => s.category === cat.id);
    if (!services.length) continue;
    nodes.push(el("p", { class: "choice-cat", text: cat.title, "aria-hidden": "true" }));
    for (const s of services) {
      nodes.push(
        choice({
          name: "service",
          value: s.id,
          checked: state.serviceId === s.id,
          label: `${s.name}, ${s.durationMinutes} minuti, ${formatPrice(s.price)}`,
          body: [
            el("span", { class: "choice-main" }, el("span", { class: "choice-name", text: s.name }), el("span", { class: "choice-meta", text: `${s.durationMinutes} min · ${s.description}` })),
            el("span", { class: "choice-price", text: formatPrice(s.price) }),
          ],
        }),
      );
    }
  }
  $("service-options").replaceChildren(...nodes);
}

function dateChoices(container, name, days, selected) {
  container.replaceChildren(
    ...days
      .filter((d) => !d.closed)
      .map((d) =>
        choice({
          name,
          value: d.date,
          checked: selected === d.date,
          disabled: d.available === 0,
          label: `${capitalize(formatDateLong(d.date))}${d.available === 0 ? ", completo" : `, ${d.available} orari liberi`}`,
          body: [
            el("span", { class: "date-dow", text: formatDow(d.date) }),
            el("span", { class: "date-day", text: formatDay(d.date) }),
            el("span", { class: "date-month", text: d.available === 0 ? "pieno" : formatMonth(d.date) }),
          ],
        }),
      ),
  );
}

function slotChoices(container, name, slots, selected) {
  const nodes = [];
  let lastGroup = "";
  for (const s of slots) {
    const group = s.time < "13:00" ? "Mattina" : "Pomeriggio";
    if (group !== lastGroup) {
      nodes.push(el("p", { class: "slot-group", text: group, "aria-hidden": "true" }));
      lastGroup = group;
    }
    nodes.push(choice({ name, value: s.time, checked: selected === s.time, body: s.time, label: `Ore ${s.time}` }));
  }
  container.replaceChildren(...nodes);
}

/* ── Step 3: days and slots from the server ───────────────────────────── */

function slotMessage(text, tone) {
  const node = $("slot-message");
  node.textContent = text ?? "";
  if (tone) node.dataset.tone = tone;
  else delete node.dataset.tone;
}

async function loadDays() {
  slotMessage("Carico i giorni disponibili…");
  $("slot-options").replaceChildren();
  try {
    const { days, stale } = await api.getDays(state.serviceId, state.barberId);
    state.days = days;
    state.stale = Boolean(stale);
    const open = days.filter((d) => d.available > 0);
    if (!open.some((d) => d.date === state.date)) state.date = open[0]?.date ?? null;
    dateChoices($("date-options"), "date", days, state.date);
    if (!state.date) return slotMessage("Nessun orario libero nei prossimi giorni. Chiama il salone.", "error");
    await loadSlots();
  } catch (err) {
    $("date-options").replaceChildren();
    slotMessage(err instanceof OfflineError ? "Sei offline e gli orari non sono ancora stati scaricati. Riprova quando torni online." : err.message, "error");
  }
}

async function loadSlots() {
  slotMessage("Carico gli orari…");
  try {
    const { slots, stale } = await api.getAvailability(state.date, state.serviceId, state.barberId);
    state.slots = slots;
    if (!slots.some((s) => s.time === state.time)) state.time = null;
    slotChoices($("slot-options"), "time", slots, state.time);
    const stamp = `${capitalize(formatDateLong(state.date))}: ${slots.length} orari liberi.`;
    slotMessage(stale || state.stale ? `${stamp} Sei offline: gli orari potrebbero non essere aggiornati.` : slots.length ? stamp : "Giornata piena: scegli un altro giorno.");
  } catch (err) {
    $("slot-options").replaceChildren();
    slotMessage(err instanceof OfflineError ? "Sei offline: non riesco a scaricare gli orari di questo giorno." : err.message, "error");
  }
}

/* ── Step 4: customer form ────────────────────────────────────────────── */

const FIELDS = ["name", "phone", "email", "privacy"];

function readCustomer() {
  return {
    name: $("f-name").value,
    phone: $("f-phone").value,
    email: $("f-email").value,
    notes: $("f-notes").value,
    privacy: $("f-privacy").checked,
  };
}

function fillCustomer(c = {}) {
  $("f-name").value = c.name ?? "";
  $("f-phone").value = c.phone ?? "";
  $("f-email").value = c.email ?? "";
  $("f-notes").value = c.notes ?? "";
  $("f-privacy").checked = Boolean(c.privacy);
}

function showFieldErrors(errors, only) {
  for (const field of FIELDS) {
    if (only && field !== only) continue;
    const input = $(`f-${field}`);
    const msg = errors[field] ?? "";
    $(`e-${field}`).textContent = msg;
    input.setAttribute("aria-invalid", msg ? "true" : "false");
  }
}

/* ── Navigation between steps ─────────────────────────────────────────── */

function stepError(message) {
  $("step-status").textContent = message;
}

function validateStep() {
  if (state.step === 1 && !state.barberId) return "Scegli con chi vuoi prenotare.";
  if (state.step === 2 && !state.serviceId) return "Scegli un servizio.";
  if (state.step === 3 && (!state.date || !state.time)) return "Scegli giorno e orario.";
  if (state.step === 4) {
    state.customer = readCustomer();
    const { ok, errors } = validateCustomer(state.customer);
    showFieldErrors(errors);
    if (!ok) {
      $(`f-${FIELDS.find((f) => errors[f])}`).focus();
      return "Controlla i campi evidenziati.";
    }
  }
  return null;
}

function renderSummary() {
  const service = findService(shop, state.serviceId);
  const rows = [
    ["Servizio", `${service.name} · ${service.durationMinutes} min`],
    ["Prezzo", `${formatPrice(service.price)}${service.sample ? " (indicativo)" : ""}`],
    ["Con", barberName(state.barberId)],
    ["Quando", `${capitalize(formatDateLong(state.date))} alle ${state.time}`],
    ["Dove", `${shop.shop.street}, ${shop.shop.city}`],
    ["Nome", state.customer.name],
    ["Telefono", state.customer.phone],
    ["Email", state.customer.email],
  ];
  if (state.customer.notes) rows.push(["Note", state.customer.notes]);
  $("summary").replaceChildren(...rows.flatMap(([k, v]) => [el("dt", { text: k }), el("dd", { text: v })]));
  updateOfflineHint();
}

function updateOfflineHint() {
  if (state.step !== 5) return;
  const node = $("submit-message");
  delete node.dataset.tone;
  node.textContent =
    !navigator.onLine && getMode() === "real"
      ? "Sei offline: la richiesta partirà da sola appena torni online. Fino alla risposta del salone la prenotazione non è confermata."
      : "";
}

function render({ focus = true } = {}) {
  for (const fs of document.querySelectorAll("#booking-form .step")) fs.hidden = Number(fs.dataset.step) !== state.step;
  $("progress-bar").style.width = `${(state.step / STEPS.length) * 100}%`;
  $("step-status").textContent = `Passo ${state.step} di ${STEPS.length} · ${STEPS[state.step - 1]}`;
  $("step-back").style.visibility = state.step === 1 ? "hidden" : "visible";
  $("step-next").textContent = state.step === 5 ? "Conferma prenotazione" : "Avanti";
  $("step-next").disabled = state.busy;
  if (state.step === 5) renderSummary();
  if (focus) {
    const legend = document.querySelector(`#booking-form .step[data-step="${state.step}"] legend`);
    legend.tabIndex = -1;
    legend.focus({ preventScroll: true });
  }
}

async function go(step, opts) {
  state.step = step;
  render(opts);
  if (step === 3) await loadDays();
}

/* ── Submit ───────────────────────────────────────────────────────────── */

function payload() {
  return {
    clientRequestId: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`.replace(".", ""),
    barberId: state.barberId,
    serviceId: state.serviceId,
    date: state.date,
    time: state.time,
    ...state.customer,
  };
}

function rememberLast() {
  const { name, phone, email } = state.customer;
  store.saveLastBooking({ barberId: state.barberId, serviceId: state.serviceId, customer: { name, phone, email } });
}

async function submit() {
  const body = payload();
  if (getMode() === "real" && !navigator.onLine) return queue(body);
  state.busy = true;
  render({ focus: false });
  $("submit-message").textContent = "Invio in corso…";
  try {
    const result = await api.createBooking(body);
    rememberLast();
    store.saveMyBooking(result);
    showDone(result);
  } catch (err) {
    if (err instanceof OfflineError && getMode() === "real") return queue(body);
    handleSubmitError(err);
  } finally {
    state.busy = false;
    render({ focus: false });
  }
}

function handleSubmitError(err) {
  if (err instanceof ApiError && err.status === 409) {
    state.time = null;
    go(3).then(() => {
      slotMessage(err.message, "error");
    });
    toast("Quell'orario è appena stato preso: scegline un altro.");
    return;
  }
  if (err instanceof ApiError && err.status === 422 && err.fields) {
    go(4).then(() => showFieldErrors(err.fields));
    return;
  }
  const node = $("submit-message");
  node.dataset.tone = "error";
  node.textContent = err.message;
}

/* ── Offline queue ────────────────────────────────────────────────────── */

async function queue(body) {
  const service = findService(shop, body.serviceId);
  const item = {
    id: body.clientRequestId,
    createdAt: Date.now(),
    status: "pending",
    payload: body,
    summary: { service: service.name, barber: barberName(body.barberId), date: body.date, time: body.time },
  };
  await self.HBOutbox.add(item);
  rememberLast();
  // Background Sync (Chromium) retries even if the page is closed; Safari and
  // Firefox fall back to the `online` event handled in app.js.
  try {
    const reg = await navigator.serviceWorker?.ready;
    await reg?.sync?.register("booking-queue");
  } catch {
    /* no Background Sync: the online-event fallback covers it */
  }
  resetForm();
  $("booking-form").hidden = true;
  const done = $("booking-done");
  done.hidden = false;
  done.replaceChildren(
    el("span", { class: "badge badge-wait", text: "In attesa di invio" }),
    el("h3", { text: "Richiesta salvata, non ancora confermata" }),
    el("p", { text: `${item.summary.service}, ${formatDateLong(item.summary.date)} alle ${item.summary.time}. Sei offline: la invieremo da sola appena torni online e ti diremo se l'orario è confermato.` }),
    el("div", { class: "done-actions" }, el("button", { type: "button", class: "btn btn-ghost", text: "Nuova prenotazione", onclick: restart })),
  );
  done.focus();
  renderOutbox();
}

/** Called on load, when back online and when the worker reports a flush. */
export async function processOutbox() {
  if (!self.HBOutbox) return;
  let items = await self.HBOutbox.all();
  for (const item of items.filter((i) => i.status === "sent")) {
    store.saveMyBooking(item.result);
    await self.HBOutbox.remove(item.id);
    const doneShowsQueued = !$("booking-done").hidden && $("booking-done").querySelector(".badge-wait");
    if (doneShowsQueued) showDone(item.result);
    else toast(`Prenotazione confermata: ${item.summary.service}, ${formatDateLong(item.summary.date)} alle ${item.summary.time}.`);
  }
  items = await self.HBOutbox.all();
  renderOutbox(items);
}

export async function flushOutbox() {
  if (!self.HBOutbox || getMode() !== "real") return;
  try {
    await self.HBOutbox.flush(apiBase);
  } catch {
    /* still offline: items stay pending */
  }
  await processOutbox();
}

async function renderOutbox(items) {
  items ??= self.HBOutbox ? await self.HBOutbox.all() : [];
  const upcoming = store.myBookings().filter((b) => b.status === "confirmed" && b.startUtc > Date.now());
  const nodes = [];
  for (const item of items) {
    const { service, date, time } = item.summary;
    const badge =
      item.status === "pending"
        ? el("span", { class: "badge badge-wait", text: "In attesa di invio" })
        : el("span", { class: "badge badge-err", text: item.status === "conflict" ? "Orario non disponibile" : "Non inviata" });
    const actions = el("div", { class: "done-actions" });
    if (item.status === "conflict") {
      actions.append(
        el("button", {
          type: "button",
          class: "btn btn-gold btn-sm",
          text: "Scegli un altro orario",
          onclick: async () => {
            await self.HBOutbox.remove(item.id);
            Object.assign(state, { barberId: item.payload.barberId, serviceId: item.payload.serviceId, date: item.payload.date, time: null });
            fillCustomer(item.payload);
            showForm();
            renderOutbox();
            go(3);
          },
        }),
      );
    }
    if (item.status !== "pending") {
      actions.append(el("button", { type: "button", class: "btn btn-ghost btn-sm", text: "Rimuovi", onclick: async () => { await self.HBOutbox.remove(item.id); renderOutbox(); } }));
    }
    nodes.push(
      el("div", { class: "card outbox-item", dataset: { status: item.status } }, badge, el("p", { class: "repeat-title", text: `${service} · ${formatDateLong(date)} alle ${time}` }), item.error ? el("p", { class: "small muted", text: item.error }) : null, actions.childElementCount ? actions : null),
    );
  }
  for (const b of upcoming) {
    nodes.push(
      el(
        "div",
        { class: "card outbox-item", dataset: { status: "confirmed" } },
        el("span", { class: "badge badge-ok", text: "Confermata" }),
        el("p", { class: "repeat-title", text: `${findService(shop, b.serviceId)?.name ?? "Appuntamento"} · ${formatWhen(b.startUtc, tz())}` }),
        el("a", { class: "link-arrow", href: `#gestisci/${b.id}/${b.token}`, text: "Gestisci prenotazione" }),
      ),
    );
  }
  $("outbox-list").replaceChildren(...nodes);
  $("outbox-list").hidden = nodes.length === 0;
}

/* ── Confirmation ─────────────────────────────────────────────────────── */

function bookingIcs(booking, manageUrl) {
  const service = findService(shop, booking.serviceId);
  return {
    id: booking.id,
    startUtc: booking.startUtc,
    endUtc: booking.endUtc,
    title: `${service?.name ?? "Appuntamento"} · ${shop.shop.name}`,
    location: `${shop.shop.name}, ${shop.shop.street}, ${shop.shop.postalCode} ${shop.shop.city}`,
    description: `Con ${barberName(booking.barberId)}. Per spostare o disdire: ${manageUrl}`,
  };
}

const manageHref = (id, token) => new URL(`#gestisci/${id}/${token}`, location.href.split("#")[0]).href;

function showDone({ booking, token }) {
  const service = findService(shop, booking.serviceId);
  const url = manageHref(booking.id, token);
  $("booking-form").hidden = true;
  const done = $("booking-done");
  done.hidden = false;
  const reminder = el("div");
  done.replaceChildren(
    svg('<svg class="done-tick" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="m15 27 7 7 15-16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>'),
    el("h3", { text: "Prenotazione confermata" }),
    el("p", { text: `${service.name} con ${barberName(booking.barberId)}, ${formatWhen(booking.startUtc, tz())}.` }),
    el("p", { class: "small muted", text: `Puoi spostarla o disdirla fino a ${shop.booking.cancelCutoffMinutes / 60} ore prima dalla pagina "Gestisci prenotazione". Il link è salvato su questo dispositivo.` }),
    el(
      "div",
      { class: "done-actions" },
      el("button", { type: "button", class: "btn btn-gold", text: "Aggiungi al calendario", onclick: () => downloadIcs(bookingIcs(booking, url)) }),
      el("a", { class: "btn btn-ghost", href: `#gestisci/${booking.id}/${token}`, text: "Gestisci prenotazione" }),
      el("button", { type: "button", class: "btn btn-ghost", text: "Nuova prenotazione", onclick: restart }),
    ),
    reminder,
  );
  done.focus();
  notifications.afterBooking(reminder, { booking, token, title: "Prenotazione confermata", body: `${service.name}, ${formatWhen(booking.startUtc, tz())}` });
  resetForm();
  renderOutbox();
  renderRepeat();
}

function resetForm() {
  Object.assign(state, { step: 1, date: null, time: null, days: [], slots: [] });
  fillCustomer(store.lastBooking()?.customer);
}

function showForm() {
  $("booking-done").hidden = true;
  $("booking-form").hidden = false;
}

function restart() {
  showForm();
  resetForm();
  state.barberId = null;
  state.serviceId = null;
  renderBarbers();
  renderServices();
  go(1);
}

/* ── "Ripeti l'ultimo taglio" ─────────────────────────────────────────── */

function renderRepeat() {
  const last = store.lastBooking();
  const service = last && findService(shop, last.serviceId);
  const valid = service && (last.barberId === ANY_BARBER || findBarber(shop, last.barberId));
  $("repeat-card").hidden = !valid;
  if (valid) $("repeat-detail").textContent = `${service.name} con ${barberName(last.barberId)}: scegli solo giorno e ora.`;
}

function repeatLast() {
  const last = store.lastBooking();
  showForm();
  Object.assign(state, { barberId: last.barberId, serviceId: last.serviceId, date: null, time: null });
  renderBarbers();
  renderServices();
  fillCustomer(last.customer);
  document.getElementById("booking").scrollIntoView({ block: "start" });
  go(3);
}

/* ── Manage screen (#gestisci/<id>/<token>) ───────────────────────────── */

export async function openManage(id, token) {
  const body = $("manage-body");
  body.replaceChildren(el("p", { text: "Carico la prenotazione…" }));
  try {
    const { booking } = await api.getBooking(id, token);
    renderManage(booking, token);
  } catch (err) {
    body.replaceChildren(
      el("p", { text: err instanceof OfflineError ? "Serve la connessione per aprire la prenotazione. Riprova quando torni online." : err.message }),
      el("a", { class: "btn btn-ghost", href: "#booking", text: "Torna alla prenotazione" }),
    );
  }
}

function renderManage(booking, token) {
  store.updateMyBooking(booking);
  const service = findService(shop, booking.serviceId);
  const body = $("manage-body");
  const status =
    booking.status === "cancelled"
      ? el("span", { class: "badge badge-err", text: "Disdetta" })
      : el("span", { class: "badge badge-ok", text: "Confermata" });
  const nodes = [
    status,
    el("dl", { class: "summary" }, el("dt", { text: "Servizio" }), el("dd", { text: service?.name ?? booking.serviceId }), el("dt", { text: "Con" }), el("dd", { text: barberName(booking.barberId) }), el("dt", { text: "Quando" }), el("dd", { text: capitalize(formatWhen(booking.startUtc, tz())) }), el("dt", { text: "Nome" }), el("dd", { text: booking.name })),
  ];
  const message = el("p", { class: "field-hint", role: "status" });
  if (booking.status === "confirmed" && booking.canModify) {
    const until = formatWhen(booking.modifyUntil, tz());
    nodes.push(
      el("p", { class: "small muted", text: `Puoi spostarla o disdirla fino a ${until}.` }),
      el(
        "div",
        { class: "done-actions" },
        el("button", { type: "button", class: "btn btn-gold", text: "Sposta", onclick: () => startReschedule(booking, token, body) }),
        el("button", {
          type: "button",
          class: "btn btn-danger",
          text: "Disdici",
          onclick: async () => {
            const ok = await confirmDialog({ title: "Disdire la prenotazione?", text: `${service?.name}, ${formatWhen(booking.startUtc, tz())}. L'orario tornerà libero per altri clienti.`, ok: "Disdici" });
            if (!ok) return;
            try {
              const res = await api.cancelBooking(booking.id, token);
              renderManage(res.booking, token);
              toast("Prenotazione disdetta.");
              renderOutbox();
            } catch (err) {
              message.dataset.tone = "error";
              message.textContent = err instanceof OfflineError ? "Serve la connessione per disdire." : err.message;
            }
          },
        }),
        el("button", { type: "button", class: "btn btn-ghost", text: "Calendario", onclick: () => downloadIcs(bookingIcs(booking, manageHref(booking.id, token))) }),
      ),
    );
  } else if (booking.status === "confirmed") {
    nodes.push(el("p", {}, `Mancano meno di ${shop.booking.cancelCutoffMinutes / 60} ore: per modifiche chiama il salone al `, el("a", { href: shop.shop.phoneHref, text: shop.shop.phone }), "."));
  } else {
    nodes.push(el("a", { class: "btn btn-gold", href: "#booking", text: "Prenota di nuovo" }));
  }
  nodes.push(message);
  body.replaceChildren(...nodes);
}

async function startReschedule(booking, token, body) {
  const dates = el("div", { class: "date-strip", role: "radiogroup", "aria-label": "Nuovo giorno" });
  const slots = el("div", { class: "slot-grid", role: "radiogroup", "aria-label": "Nuovo orario" });
  const message = el("p", { class: "field-hint", role: "status", text: "Carico i giorni disponibili…" });
  const pick = { date: null, time: null };
  const confirm = el("button", { type: "button", class: "btn btn-gold", text: "Conferma nuovo orario", disabled: true });
  const panel = el("div", { class: "reminder-ask" }, el("p", { class: "repeat-title", text: "Scegli il nuovo orario" }), message, dates, slots, el("div", { class: "done-actions" }, confirm, el("button", { type: "button", class: "btn btn-ghost", text: "Annulla", onclick: () => renderManage(booking, token) })));
  body.append(panel);
  panel.scrollIntoView({ block: "nearest" });

  const loadSlotsFor = async (date) => {
    pick.date = date;
    pick.time = null;
    confirm.disabled = true;
    message.textContent = "Carico gli orari…";
    try {
      const res = await api.getAvailability(date, booking.serviceId, booking.barberId);
      // The current appointment is still "taken" by this booking itself.
      slotChoices(slots, "new-time", res.slots, null);
      message.textContent = res.slots.length ? "" : "Giornata piena: scegli un altro giorno.";
    } catch (err) {
      message.textContent = err instanceof OfflineError ? "Serve la connessione per spostare la prenotazione." : err.message;
    }
  };
  dates.addEventListener("change", (e) => loadSlotsFor(e.target.value));
  slots.addEventListener("change", (e) => {
    pick.time = e.target.value;
    confirm.disabled = false;
  });
  confirm.addEventListener("click", async () => {
    confirm.disabled = true;
    try {
      const res = await api.rescheduleBooking(booking.id, token, pick);
      renderManage(res.booking, token);
      toast(`Spostata a ${formatWhen(res.booking.startUtc, tz())}.`);
      renderOutbox();
    } catch (err) {
      message.dataset.tone = "error";
      message.textContent = err.message;
      if (err instanceof ApiError && err.status === 409) loadSlotsFor(pick.date);
      else confirm.disabled = false;
    }
  });

  try {
    const { days } = await api.getDays(booking.serviceId, booking.barberId);
    const first = days.find((d) => d.available > 0);
    dateChoices(dates, "new-date", days, first?.date);
    if (first) await loadSlotsFor(first.date);
    else message.textContent = "Nessun orario libero nei prossimi giorni.";
  } catch (err) {
    message.textContent = err instanceof OfflineError ? "Serve la connessione per spostare la prenotazione." : err.message;
  }
}

/* ── Setup ────────────────────────────────────────────────────────────── */

export function initBooking(shopData, notificationsModule) {
  shop = shopData;
  notifications = notificationsModule;
  renderBarbers();
  renderServices();
  fillCustomer(store.lastBooking()?.customer);
  renderRepeat();

  const form = $("booking-form");
  form.addEventListener("change", (e) => {
    const { name, value } = e.target;
    if (name === "barber") state.barberId = value;
    else if (name === "service") state.serviceId = value;
    else if (name === "date") {
      state.date = value;
      state.time = null;
      loadSlots();
    } else if (name === "time") state.time = value;
  });
  // Inline validation: a field is checked when the user leaves it.
  form.addEventListener("focusout", (e) => {
    const field = e.target.name;
    if (!FIELDS.includes(field) || state.step !== 4 || !e.target.value) return;
    showFieldErrors(validateCustomer(readCustomer()).errors, field);
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (state.busy) return;
    const error = validateStep();
    if (error) return stepError(error);
    if (state.step < 5) await go(state.step + 1);
    else await submit();
  });
  $("step-back").addEventListener("click", () => go(Math.max(1, state.step - 1)));
  $("repeat-btn").addEventListener("click", repeatLast);
  window.addEventListener("online", updateOfflineHint);
  window.addEventListener("offline", updateOfflineHint);

  render({ focus: false });
  processOutbox();
}

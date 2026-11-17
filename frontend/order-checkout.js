"use strict";

const money = (cents) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
function returnToOrder(search) {
  const values = new URLSearchParams(search).getAll("menu");
  const edits = new URLSearchParams(search).getAll("order");
  if (edits.length > 1 || (edits.length && (!/^[1-9]\d*$/.test(edits[0]) || !Number.isSafeInteger(Number(edits[0]))))) return null;
  return values.length === 1 && /^[1-9]\d*$/.test(values[0]) && Number.isSafeInteger(Number(values[0])) ? `commande.html?menu=${values[0]}${edits.length ? "&order=" + edits[0] : ""}` : null;
}
async function initCheckout(doc = document, location = window.location, request = fetch) {
  const status = doc.getElementById("selection-status");
  const error = doc.getElementById("checkout-error");
  const form = doc.getElementById("checkout-form");
  const quoteSection = doc.getElementById("quote");
  const confirm = doc.getElementById("confirm");
  const calculate = doc.getElementById("calculate");
  let quote = null;
  let key = null;
  let busy = false;
  let editOrderId = null;
  let revision = 0;
  const destination = returnToOrder(location.search);
  const redirect = () => location.assign(`connexion.html?next=${encodeURIComponent(destination)}`);
  const showError = (message) => { error.textContent = message; error.focus(); };
  async function api(url, body) {
    const response = await request(url, body === undefined ? { credentials: "same-origin", cache: "no-store" } : {
      method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-Requested-With": "ViteGourmand" }, body: JSON.stringify(body)
    });
    if (response.status === 401) { redirect(); throw new Error("Reconnectez-vous pour continuer."); }
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Commande indisponible.");
    return data;
  }
  const setBusy = (value) => { busy = value; calculate.disabled = value; confirm.disabled = value || !quote; form.setAttribute("aria-busy", String(value)); };
  const invalidate = () => { revision++; quote = null; key = null; quoteSection.hidden = true; confirm.disabled = true; };
  if (!destination) { status.textContent = "Menu absent ou invalide. Choisissez un menu depuis le catalogue."; return; }
  const menuId = Number(new URLSearchParams(location.search).get("menu"));
  try {
    const edit = new URLSearchParams(location.search).get("order");
    const context = await api(`/api/orders/checkout?menu=${menuId}${edit ? "&order=" + edit : ""}`);
    const menu = context.menu;
    doc.getElementById("selection-title").textContent = menu.title;
    doc.getElementById("selection-id").textContent = `Menu n° ${menu.id} · Données fictives`;
    doc.getElementById("selection-description").textContent = `Prix pour ${menu.minimumPeople} personnes : ${money(menu.basePriceCents)}.`;
    doc.getElementById("selected-menu").hidden = false;
    doc.getElementById("customer").textContent = `${context.customer.firstName} ${context.customer.lastName} · ${context.customer.email} · ${context.customer.phone}`;
    doc.getElementById("people").min = menu.minimumPeople;
    doc.getElementById("people").value = menu.minimumPeople;
    doc.getElementById("pricing-rule").textContent = context.pricing === "prorata"
      ? "Personnes supplémentaires au prorata du prix minimum, arrondi au centime. Remise de 10 % dès cinq personnes au-delà du minimum."
      : "Commande au minimum uniquement : tarif supplémentaire en attente de validation.";
    doc.getElementById("order-conditions").textContent = menu.orderConditions;
    doc.getElementById("storage-conditions").textContent = menu.storageConditions;
    doc.getElementById("terms-version").textContent = `Version des conditions : ${context.termsVersion}. Délai minimum : ${menu.noticeHours} heures.`;
    if (context.address) for (const name of ["street", "additionalLine", "postalCode", "city", "countryCode"]) doc.getElementById(name).value = context.address[name] || "";
    if (context.editing) {
      const order = context.editing; editOrderId = order.id;
      for (const name of ["street", "additionalLine", "postalCode", "city", "countryCode", "serviceDate", "people"]) doc.getElementById(name).value = order[name] || "";
      const parts = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(order.deliveryAt));
      const p = Object.fromEntries(parts.map((part) => [part.type,part.value]));
      doc.getElementById("deliveryDate").value = `${p.year}-${p.month}-${p.day}`;
      doc.getElementById("deliveryTime").value = `${p.hour}:${p.minute}`;
      confirm.textContent = "Confirmer la modification";
    }
    if (menu.stock < 1) { status.textContent = "Ce menu est épuisé. Revenez au catalogue."; return; }
    status.textContent = "Complétez le formulaire pour obtenir un devis. Le stock n’est réservé qu’après confirmation.";
    form.hidden = false;
  } catch (failure) { status.textContent = ""; showError(failure.message); return; }
  form.addEventListener("input", invalidate);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy || !form.reportValidity()) return;
    invalidate(); const version = revision; error.textContent = ""; setBusy(true);
    try {
      const body = { menuId, people: Number(doc.getElementById("people").value), conditionsAccepted: doc.getElementById("conditionsAccepted").checked };
      for (const name of ["serviceDate", "deliveryDate", "deliveryTime", "street", "additionalLine", "postalCode", "city", "countryCode"]) body[name] = doc.getElementById(name).value;
      const result = await api(editOrderId ? `/api/orders/${editOrderId}/quote` : "/api/orders/quote", body);
      if (version !== revision) return;
      quote = result; key = crypto.randomUUID();
      const breakdown = doc.getElementById("price-breakdown"); breakdown.replaceChildren();
      for (const [label, value] of [["Menu avant remise", money(result.grossCents)], [`Remise (${result.discountPercent} %)`, money(result.discountCents)], ["Menu après remise", money(result.menuCents)], ["Livraison", money(result.deliveryCents)], ["Total", money(result.totalCents)]]) {
        const term = doc.createElement("dt"); term.textContent = label; const amount = doc.createElement("dd"); amount.textContent = value; breakdown.append(term, amount);
      }
      if (result.distanceKm !== null) { const label = doc.createElement("dt"); label.textContent = "Distance routière vérifiée"; const note = doc.createElement("dd"); note.textContent = `${result.distanceKm} km. Source : ${result.distanceSource}`; breakdown.append(label,note); }
      doc.getElementById("quote-expiry").textContent = `Devis valable jusqu’au ${new Date(result.expiresAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })} (heure de Paris). Le prix et le stock seront revérifiés.`;
      quoteSection.hidden = false; doc.getElementById("quote-title").focus();
    } catch (failure) { showError(failure.message); }
    finally { setBusy(false); }
  });
  confirm.addEventListener("click", async () => {
    if (busy || !quote) return;
    if (Date.parse(quote.expiresAt) <= Date.now()) { invalidate(); showError("Le devis a expiré. Recalculez le prix."); return; }
    setBusy(true); error.textContent = "";
    try {
      const result = await api("/api/orders", { quoteId: quote.quoteId, idempotencyKey: key });
      form.hidden = true; quoteSection.hidden = true; quote = null;
      const message = doc.getElementById("confirmation"); message.textContent = `Commande ${result.order.reference} enregistrée, statut : ${result.order.statusLabel}. Total : ${money(result.order.totalCents)}. ` + (result.confirmationEmail === "sent" ? "Email transmis au serveur de messagerie." : "Email de confirmation préparé, en attente d’envoi."); message.focus();
    } catch (failure) { showError(`${failure.message} Si la réponse a été interrompue, consultez Mes commandes ou réessayez cette même confirmation ; elle ne crée pas de doublon.`); }
    finally { setBusy(false); }
  });
}
if (typeof module !== "undefined") module.exports = { returnToOrder, initCheckout };
if (typeof window !== "undefined") initCheckout();

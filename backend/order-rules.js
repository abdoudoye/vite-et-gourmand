"use strict";

const { createHash } = require("node:crypto");
class OrderError extends Error {
  constructor(status, message) { super(message); this.name = "OrderError"; this.status = status; }
}
const fail = (message, status = 400) => { throw new OrderError(status, message); };
// jsonb peut réordonner les clés : l'empreinte doit être indépendante de leur ordre.
const canonical = (value) => value instanceof Date ? value.toISOString() : Array.isArray(value) ? value.map(canonical)
  : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key,canonical(value[key])])) : value;
const hash = (value) => createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
const normalize = (value) => value.normalize("NFD").replace(/\p{M}/gu, "").trim().replace(/\s+/g, " ").toLowerCase();
const addressKey = (address) => hash([address.street, address.additionalLine, address.postalCode, address.city, address.countryCode].map(normalize));

function readOrderConfig(env = process.env) {
  const pricing = env.ORDER_EXTRA_PRICING || "prorata";
  if (!["disabled", "prorata"].includes(pricing)) throw new Error("ORDER_EXTRA_PRICING invalide.");
  const termsVersion = env.ORDER_TERMS_VERSION || (env.NODE_ENV === "production" ? "" : "DEMO-conditions-v1");
  if (termsVersion.length > 100 || /[\p{Cc}<>]/u.test(termsVersion)) throw new Error("ORDER_TERMS_VERSION invalide.");
  return { pricing, termsVersion };
}

function parisDelivery(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) fail("Date ou heure invalide.");
  const formatter = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const wall = `${date} ${time}`;
  const candidates = ["+01:00", "+02:00"].map((offset) => new Date(`${date}T${time}:00${offset}`))
    .filter((instant) => Number.isFinite(instant.getTime()) && formatter.format(instant) === wall);
  if (candidates.length !== 1) fail("Date inexistante ou heure ambiguë au changement d’heure : choisissez un autre horaire.");
  return candidates[0].toISOString();
}

function validateOrder(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) fail("Formulaire invalide.");
  if (!Number.isSafeInteger(body.menuId) || body.menuId < 1 || !Number.isSafeInteger(body.people) || body.people < 1 || body.people > 10000) fail("Menu ou nombre de personnes invalide.");
  const text = (key, max, optional = false) => {
    const value = typeof body[key] === "string" ? body[key].trim() : "";
    if ((!optional && !value) || value.length > max || /[\p{Cc}\p{Cf}<>]/u.test(value)) fail("Adresse ou date invalide.");
    return value;
  };
  const data = { menuId: body.menuId, people: body.people, serviceDate: text("serviceDate", 10), deliveryDate: text("deliveryDate", 10), deliveryTime: text("deliveryTime", 5),
    street: text("street", 200), additionalLine: text("additionalLine", 200, true), postalCode: text("postalCode", 20), city: text("city", 100), countryCode: text("countryCode", 2).toUpperCase() };
  if (!/^[A-Z]{2}$/.test(data.countryCode) || !/^[\p{L}\p{N} -]{2,20}$/u.test(data.postalCode)) fail("Pays ou code postal invalide.");
  parisDelivery(data.serviceDate, "12:00");
  data.deliveryAt = parisDelivery(data.deliveryDate, data.deliveryTime);
  if (data.deliveryDate > data.serviceDate) fail("La livraison doit précéder ou avoir lieu le jour de la prestation.");
  if (body.conditionsAccepted !== true) fail("Vous devez accepter les conditions de commande et de conservation.");
  return data;
}

function priceOrder(menu, data, config, distance, now = Date.now()) {
  if (data.people < menu.minimum_people) fail(`Ce menu exige au moins ${menu.minimum_people} personnes.`);
  if (menu.notice_hours === null || !Number.isInteger(menu.notice_hours)) fail("Le délai de commande de ce menu doit être configuré.", 409);
  if (Date.parse(data.deliveryAt) <= now || Date.parse(data.deliveryAt) < now + menu.notice_hours * 3600000) fail(`Respectez le délai de commande de ${menu.notice_hours} heures avant la livraison.`);
  if (menu.stock_available < 1) fail("Ce menu est épuisé.", 409);
  if (!config.termsVersion) fail("Les conditions contractuelles ne sont pas configurées.", 503);
  if (data.people > menu.minimum_people && config.pricing !== "prorata") fail("Le tarif des personnes supplémentaires attend une validation. Choisissez le minimum du menu.", 409);
  const gross = Number((BigInt(menu.base_price_cents) * BigInt(data.people) * 2n + BigInt(menu.minimum_people)) / (2n * BigInt(menu.minimum_people)));
  const discountPercent = data.people >= menu.minimum_people + 5 ? 10 : 0;
  const discount = Number((BigInt(gross) * BigInt(discountPercent) + 50n) / 100n);
  const inBordeaux = data.countryCode === "FR" && normalize(data.city) === "bordeaux" && ["33000", "33100", "33200", "33300", "33800"].includes(data.postalCode);
  let delivery = 0;
  if (!inBordeaux) {
    if (!distance || !Number.isSafeInteger(distance.milliKm) || distance.milliKm < 0 || !distance.source || !Number.isFinite(Date.parse(distance.expiresAt)) || Date.parse(distance.expiresAt) <= now) fail("Une distance routière vérifiée est nécessaire pour cette adresse hors Bordeaux. Contactez l’équipe.", 422);
    delivery = 500 + Number((BigInt(distance.milliKm) * 59n + 500n) / 1000n);
  }
  const total = gross - discount + delivery;
  if (![gross, discount, delivery, total].every((value) => Number.isSafeInteger(value) && value >= 0 && value <= 2147483647)) fail("Montant hors limite.");
  return { grossCents: gross, discountPercent, discountCents: discount, menuCents: gross - discount, deliveryCents: delivery, totalCents: total,
    pricingPolicy: data.people === menu.minimum_people ? "prix_minimum" : "prorata_arrondi_centime_v1", inBordeaux,
    distanceKm: inBordeaux ? null : (distance.milliKm / 1000).toFixed(3), distanceSource: inBordeaux ? null : distance.source, termsVersion: config.termsVersion };
}
const menuFingerprint = (menu) => hash([menu.id, menu.minimum_people, menu.base_price_cents, menu.notice_hours, menu.order_conditions, menu.storage_conditions]);
module.exports = { OrderError, fail, hash, addressKey, readOrderConfig, validateOrder, priceOrder, menuFingerprint, parisDelivery };

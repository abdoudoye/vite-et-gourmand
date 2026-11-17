"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validateOrder, priceOrder, parisDelivery, addressKey } = require("./order-rules.js");
const { returnToOrder } = require("../frontend/order-checkout.js");
const { orderDestination } = require("../frontend/auth-navigation.js");
const now = Date.parse("2026-11-16T10:00:00Z");
const input = { menuId: 1, people: 6, serviceDate: "2026-12-20", deliveryDate: "2026-12-20", deliveryTime: "10:00", street: "1 voie Fictive", additionalLine: "", postalCode: "33000", city: "Bordeaux", countryCode: "FR", conditionsAccepted: true };
const menu = { minimum_people: 6, base_price_cents: 18000, notice_hours: 72, stock_available: 2 };
const config = { pricing: "prorata", termsVersion: "DEMO-v1" };

test("prix minimum, prorata validé, seuil exact minimum + 5 et remise sur le menu seulement", () => {
  const data = validateOrder(input);
  assert.equal(priceOrder(menu, data, config, null, now).totalCents, 18000);
  assert.equal(priceOrder(menu, { ...data, people: 10 }, config, null, now).discountPercent, 0);
  const result = priceOrder(menu, { ...data, people: 11 }, config, null, now);
  assert.equal(result.grossCents, 33000); assert.equal(result.discountCents, 3300); assert.equal(result.totalCents, 29700);
  const outside = priceOrder(menu, { ...data, city: "Ville fictive", people: 11 }, config,
    { milliKm: 12345, source: "SOURCE FICTIVE DE TEST", expiresAt: "2027-01-01" }, now);
  assert.equal(outside.deliveryCents, 1228); assert.equal(outside.totalCents, 30928);
});
test("arrondis monétaires entiers conformes au SQL et minimum de personnes respecté", () => {
  const data = validateOrder(input);
  const result = priceOrder({ ...menu, minimum_people: 3, base_price_cents: 1000 }, { ...data, people: 4 }, config, null, now);
  assert.equal(result.grossCents, 1333);
  assert.throws(() => priceOrder(menu, { ...data, people: 5 }, config, null, now), /au moins/);
  assert.throws(() => priceOrder(menu, { ...data, people: 7 }, { ...config, pricing: "disabled" }, null, now), /validation/);
});
test("délai, passé, stock épuisé, délai non configuré et conditions absentes refusés", () => {
  const data = validateOrder(input);
  assert.throws(() => priceOrder(menu, data, config, null, Date.parse(data.deliveryAt) - 71 * 3600000), /délai/);
  assert.doesNotThrow(() => priceOrder(menu, data, config, null, Date.parse(data.deliveryAt) - 72 * 3600000));
  assert.throws(() => priceOrder(menu, data, config, null, Date.parse(data.deliveryAt)), /délai/);
  assert.throws(() => priceOrder({ ...menu, stock_available: 0 }, data, config, null, now), /épuisé/);
  assert.throws(() => priceOrder({ ...menu, notice_hours: null }, data, config, null, now), /configuré/);
  assert.throws(() => validateOrder({ ...input, conditionsAccepted: false }), /accepter/);
});
test("Paris : dates impossibles, heures inexistantes/ambiguës et livraison après prestation refusées", () => {
  assert.equal(parisDelivery("2026-12-20", "10:00"), "2026-12-20T09:00:00.000Z");
  assert.equal(parisDelivery("2027-07-20", "10:00"), "2027-07-20T08:00:00.000Z");
  for (const [date, time] of [["2027-02-30", "10:00"], ["2027-03-28", "02:30"], ["2027-10-31", "02:30"], ["2027-01-01", "25:00"]]) assert.throws(() => parisDelivery(date, time));
  assert.throws(() => validateOrder({ ...input, deliveryDate: "2026-12-21" }), /précéder/);
});
test("hors Bordeaux : aucune distance client acceptée et provenance vérifiée obligatoire", () => {
  const data = validateOrder({ ...input, city: "Ville fictive", distanceKm: 0, deliveryFee: 0 });
  assert.ok(!("distanceKm" in data));
  for (const distance of [null, { milliKm: 1000, source: "x" }, { milliKm: -1, source: "x", expiresAt: "2027-01-01" }, { milliKm: 1000, source: "x", expiresAt: "2026-01-01" }]) {
    assert.throws(() => priceOrder(menu, data, config, distance, now), /distance routière/);
  }
  assert.throws(() => priceOrder(menu, validateOrder({ ...input, postalCode: "99999" }), config, null, now), /distance routière/);
  assert.equal(addressKey(validateOrder(input)), addressKey(validateOrder({ ...input, city: " BORDEAUX ", street: "1 VOIE  Fictive" })));
});
test("types invalides, balises, quantités déraisonnables et montants hors limites refusés", () => {
  for (const change of [{ people: 1.5 }, { people: "6" }, { menuId: -1 }, { people: 10001 }, { street: "<script>" }, { city: {} }, { countryCode: "France" }]) assert.throws(() => validateOrder({ ...input, ...change }));
  assert.throws(() => priceOrder({ ...menu, base_price_cents: 2147483647 }, { ...validateOrder(input), people: 10000 }, config, null, now), /limite/);
});
test("menu conservé pendant connexion/inscription sans redirection externe", () => {
  assert.equal(returnToOrder("?menu=12"), "commande.html?menu=12");
  assert.equal(returnToOrder("?menu=12&order=7"), "commande.html?menu=12&order=7");
  for (const search of ["", "?menu=1&menu=2", "?menu=javascript:x", "?menu=9007199254740993"]) assert.equal(returnToOrder(search), null);
  assert.equal(orderDestination("?next=" + encodeURIComponent("commande.html?menu=12")), "commande.html?menu=12");
  for (const next of ["https://evil.test", "//evil.test", "commande.html?menu=1&next=evil", "commande.html?menu=1#x"]) assert.equal(orderDestination("?next=" + encodeURIComponent(next)), null);
});

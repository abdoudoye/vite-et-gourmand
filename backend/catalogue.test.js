const { test } = require("node:test");
const assert = require("node:assert/strict");
const menus = require("../frontend/data/menus.json");
const { filterMenus } = require("../frontend/menu-filters.js");

const defaults = { maxPrice: null, priceFrom: null, priceTo: null, theme: "", diet: "", people: null };
const ids = (filters) => filterMenus(menus, { ...defaults, ...filters }).map((menu) => menu.id);

test("sans filtre : tous les menus ; données non modifiées", () => {
  const before = JSON.stringify(menus);
  assert.equal(ids({}).length, 6);
  ids({ theme: "Fête" });
  assert.equal(JSON.stringify(menus), before);
});
test("prix maximum et bornes inclusives de fourchette", () => {
  assert.deepEqual(ids({ maxPrice: 180 }), [1, 2, 6]);
  assert.deepEqual(ids({ priceFrom: 180, priceTo: 240 }), [1, 4, 6]);
  assert.deepEqual(ids({ maxPrice: 179.99 }), [2]);
  assert.deepEqual(ids({ maxPrice: 0 }), []);
});
test("thème, régime et minimum de personnes", () => {
  assert.deepEqual(ids({ theme: "Fête" }), [3, 5]);
  assert.deepEqual(ids({ diet: "Végétalien" }), [2, 5]);
  assert.deepEqual(ids({ people: 6 }), [1, 2, 6]);
  assert.deepEqual(ids({ people: 1 }), []);
});
test("tous les filtres se combinent avec ET", () => {
  assert.deepEqual(ids({ maxPrice: 200, priceFrom: 150, priceTo: 190, theme: "Nature", diet: "Végétarien", people: 6 }), [6]);
  assert.deepEqual(ids({ theme: "Fête", diet: "Végétarien" }), []);
});

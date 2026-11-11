const { test } = require("node:test");
const assert = require("node:assert/strict");
const menus = require("../frontend/data/menus.json");
const { filterMenus } = require("../frontend/menu-filters.js");
const { isValidMenu, createMenuDetails } = require("../frontend/menu-details.js");
const { selectedMenuFromSearch, showSelectedMenu } = require("../frontend/commande.js");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

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

test("les six fiches possèdent des données complètes et une galerie locale", () => {
  assert.equal(new Set(menus.map((menu) => menu.id)).size, menus.length);
  for (const menu of menus) {
    assert.equal(isValidMenu(menu), true, menu.title);
    assert.ok(menu.images.length >= 2);
    assert.equal(new Set(menu.images.map((image) => image.src)).size, menu.images.length);
    for (const image of menu.images) assert.ok(fs.existsSync(path.join(__dirname, "../frontend", image.src)));
  }
  assert.ok(menus.some((menu) => menu.stock === 0), "cas de stock épuisé présent");
});

test("les données incomplètes, stocks invalides et images externes sont refusés", () => {
  for (const changes of [
    { stock: -1 }, { stock: 1.5 }, { stock: "3" }, { images: [{ src: "https://example.org/image.jpg", alt: "Test", caption: "Test" }, menus[0].images[1]] },
    { dishes: { starters: [], mains: ["Plat"], desserts: ["Dessert"] } },
    { dishes: { ...menus[0].dishes, starters: [{ name: "Entrée", allergens: "Lait" }] } },
    { conditions: { order: ["Test"], storage: [] } }, { images: [] }, { title: "" },
    { images: [{ ...menus[0].images[0], src: "images/../secret.svg" }, menus[0].images[1]] },
    { images: [{ ...menus[0].images[0], alt: " " }, menus[0].images[1]] }
  ]) assert.equal(isValidMenu({ ...menus[0], ...changes }), false);
  assert.equal(isValidMenu(null), false);
});

// Petit document en mémoire : vérifie la construction du contenu sans dépendance DOM.
function memoryDocument() {
  const doc = { createElement(tag) {
    return { tag, children: [], attributes: {}, textContent: "", listeners: {}, hidden: false,
      append(...nodes) { this.children.push(...nodes); },
      replaceChildren(...nodes) { this.children = nodes; },
      setAttribute(name, value) { this.attributes[name] = value; },
      removeAttribute(name) { delete this.attributes[name]; },
      addEventListener(name, listener) { this.listeners[name] = listener; },
      querySelector(tag) { return nodesOf(this).find((node) => node.tag === tag); },
      focus() { doc.activeElement = this; }
    };
  } };
  return doc;
}
function nodesOf(node) { return [node, ...node.children.flatMap(nodesOf)]; }

test("chaque fiche affiche tous ses champs, un texte alternatif et un titre associé", () => {
  for (const menu of menus) {
    const detail = createMenuDetails(menu, memoryDocument());
    const nodes = nodesOf(detail);
    const texts = nodes.map((node) => node.textContent);
    for (const text of [menu.title, menu.description, menu.theme, menu.diet,
      ...Object.values(menu.dishes).flat().map((dish) => dish.name), ...menu.conditions.order, ...menu.conditions.storage,
      String(menu.minimumPeople), menu.stock === 0 ? "Indisponible — stock épuisé" : String(menu.stock),
      new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(menu.basePriceCents / 100)
    ]) assert.ok(texts.includes(text), text);
    assert.equal(detail.hidden, true);
    const title = nodes.find((node) => node.tag === "h4");
    assert.equal(detail.attributes["aria-labelledby"], title.id);
    assert.equal(title.tabIndex, -1);
    assert.deepEqual(nodes.filter((node) => node.tag === "img").map((node) => node.alt), menu.images.map((image) => image.alt));
    assert.ok(texts.some((text) => text.includes("stock fictifs")));
  }
});

test("les chaînes HTML des données restent du texte", () => {
  const title = '<img src=x onerror=alert(1)>';
  const detail = createMenuDetails({ ...menus[0], title }, memoryDocument());
  assert.equal(nodesOf(detail).find((node) => node.tag === "h4").textContent, title);
  assert.equal(nodesOf(detail).filter((node) => node.tag === "img").length, menus[0].images.length);
});

async function cataloguePage(response = { ok: true, json: async () => menus }) {
  const doc = memoryDocument();
  const selectors = {};
  for (const id of ["filters", "menu-list", "result-count", "filter-error", "empty", "load-error", "results"]) {
    selectors[`#${id}`] = doc.createElement("div");
  }
  selectors["#load-error"].hidden = true;
  const fields = {};
  for (const name of ["maxPrice", "priceFrom", "priceTo", "people", "theme", "diet"]) {
    fields[name] = doc.createElement("input");
    fields[name].value = "";
    fields[name].validity = { valid: true };
  }
  const controls = Object.assign(Object.values(fields), fields);
  controls.namedItem = (name) => fields[name];
  selectors["#filters"].elements = controls;
  doc.querySelector = (selector) => selectors[selector];
  const context = vm.createContext({ document: doc, Intl, fetch: async () => response, setTimeout });
  for (const file of ["menu-filters.js", "menu-details.js", "menus.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../frontend", file), "utf8"), context);
  }
  // Laisse l'initialisation asynchrone du vrai script terminer son chargement.
  await new Promise(setImmediate);
  return { doc, selectors, fields };
}

test("ouvrir, revenir et utiliser Échap préserve le filtre et restitue le focus", async () => {
  const { doc, selectors, fields } = await cataloguePage();
  const form = selectors["#filters"];
  assert.equal(selectors["#menu-list"].children.length, 6);
  fields.theme.value = "Nature";
  form.listeners.input();
  const cards = selectors["#menu-list"].children;
  assert.equal(cards.length, 2);
  for (const card of cards) {
    const nodes = nodesOf(card);
    const toggle = nodes.find((node) => node.tag === "button");
    const detail = nodes.find((node) => node.tag === "section");
    const close = nodes.find((node) => node.textContent === "Retour au catalogue");
    assert.equal(toggle.attributes["aria-controls"], detail.id);
    toggle.listeners.click();
    assert.equal(detail.hidden, false);
    assert.equal(toggle.attributes["aria-expanded"], "true");
    assert.equal(doc.activeElement.tag, "h4");
    close.listeners.click();
    assert.equal(detail.hidden, true);
    assert.equal(doc.activeElement, toggle);
    toggle.listeners.click();
    let prevented = false;
    detail.listeners.keydown({ key: "Escape", preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(toggle.attributes["aria-expanded"], "false");
    assert.equal(doc.activeElement, toggle);
    assert.equal(fields.theme.value, "Nature");
    assert.equal(selectors["#menu-list"].children.length, 2);
  }
  // Simule les valeurs par défaut restaurées par le navigateur lors du reset.
  fields.theme.value = "";
  form.listeners.reset();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(selectors["#menu-list"].children.length, 6);
});

test("une erreur réseau ou des données de fiche invalides affichent une erreur accessible", async () => {
  for (const response of [{ ok: false }, { ok: true, json: async () => [{ ...menus[0], stock: -1 }] }]) {
    const { selectors } = await cataloguePage(response);
    assert.equal(selectors["#load-error"].hidden, false);
    assert.equal(selectors["#result-count"].textContent, "Catalogue indisponible.");
    assert.equal(selectors["#results"].attributes["aria-busy"], "false");
    assert.ok([...selectors["#filters"].elements].every((control) => control.disabled));
  }
});

test("les allergènes sont affichés auprès de chaque plat, y compris les listes vides", () => {
  for (const menu of menus) {
    const detail = createMenuDetails(menu, memoryDocument());
    for (const dish of Object.values(menu.dishes).flat()) {
      const li = nodesOf(detail).find((node) => node.tag === "li" && node.children.some((child) => child.textContent === dish.name));
      assert.ok(li, dish.name);
      assert.equal(li.children[1].textContent, dish.allergens.length
        ? `Allergènes : ${dish.allergens.join(", ")}` : "Allergènes : aucun déclaré dans cet exemple fictif.");
    }
    assert.equal(nodesOf(detail).filter((node) => node.tag === "figure").length, menu.images.length);
    assert.equal(nodesOf(detail).filter((node) => node.tag === "figcaption").length, menu.images.length);
    const gallery = nodesOf(detail).find((node) => node.className === "menu-gallery");
    assert.ok(nodesOf(detail).some((node) => node.id === gallery.attributes["aria-labelledby"]));
  }
});

test("Commander conserve le bon menu et suit les conditions ; stock nul bloqué", () => {
  for (const menu of menus) {
    const detail = createMenuDetails(menu, memoryDocument());
    const order = detail.children.find((node) => node.textContent === "Commander");
    const conditions = detail.children.find((node) => node.className === "order-conditions");
    assert.ok(detail.children.indexOf(conditions) < detail.children.indexOf(order));
    assert.deepEqual(nodesOf(conditions).filter((node) => node.tag === "h6").map((node) => node.textContent), ["Commande", "Conservation"]);
    if (menu.stock === 0) {
      assert.equal(order.disabled, true);
      assert.equal(order.href, undefined);
      assert.ok(detail.children.some((node) => node.id === order.attributes["aria-describedby"]));
    } else {
      assert.equal(order.href, `commande.html?menu=${menu.id}`);
      assert.equal(selectedMenuFromSearch(menus, order.href.split("?")[1]), menu);
    }
  }
});

test("la sélection refuse les identifiants absents, ambigus, inconnus ou mal formés", () => {
  for (const search of ["", "?menu=", "?menu=999", "?menu=-1", "?menu=1.5", "?menu=1e0", "?menu=01", "?menu=1&menu=2", "?menu=<script>", "?menu=9007199254740992"]) {
    assert.equal(selectedMenuFromSearch(menus, search), null, search);
  }
});

async function orderPage(search, request = async () => ({ ok: true, json: async () => menus })) {
  const doc = memoryDocument();
  const selectors = {};
  for (const id of ["selection-status", "selection-title", "selection-id", "selection-description", "selected-menu"]) selectors[`#${id}`] = doc.createElement("div");
  selectors["#selected-menu"].hidden = true;
  doc.querySelector = (selector) => selectors[selector];
  await showSelectedMenu(doc, search, request);
  return selectors;
}

test("la page de commande retrouve le menu après rechargement sans créer de commande", async () => {
  for (const menu of menus) {
    const before = JSON.stringify(menus);
    const requests = [];
    const request = async (...args) => { requests.push(args); return { ok: true, json: async () => menus }; };
    for (let reload = 0; reload < 2; reload++) {
      const selectors = await orderPage(`?menu=${menu.id}`, request);
      assert.equal(selectors["#selection-title"].textContent, menu.title);
      assert.equal(selectors["#selected-menu"].hidden, false);
      assert.match(selectors["#selection-status"].textContent, /Aucune réservation effectuée/);
      assert.match(selectors["#selection-status"].textContent, menu.stock ? /connexion/ : /stock fictif épuisé/);
    }
    assert.deepEqual(requests, [["data/menus.json"], ["data/menus.json"]]);
    assert.equal(JSON.stringify(menus), before);
  }
});

test("la page de commande gère un menu inconnu et les erreurs de chargement", async () => {
  const unknown = await orderPage("?menu=999");
  assert.equal(unknown["#selected-menu"].hidden, true);
  assert.match(unknown["#selection-status"].textContent, /introuvable/);
  for (const request of [async () => { throw new Error("Réseau"); }, async () => ({ ok: false }), async () => ({ ok: true, json: async () => [{}] })]) {
    const selectors = await orderPage("?menu=1", request);
    assert.equal(selectors["#selected-menu"].hidden, true);
    assert.equal(selectors["#selection-status"].attributes.role, "alert");
  }
});

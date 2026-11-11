"use strict";

// Validation commune au chargement du catalogue et aux tests.
function isValidMenu(menu) {
  const text = (value) => typeof value === "string" && value.trim().length > 0;
  const texts = (values) => Array.isArray(values) && values.length > 0 && values.every(text);
  const dishes = (values) => Array.isArray(values) && values.length > 0 && values.every((dish) =>
    dish && text(dish.name) && Array.isArray(dish.allergens) && dish.allergens.every(text));
  return Boolean(menu && Number.isSafeInteger(menu.id) && menu.id > 0 &&
    Number.isSafeInteger(menu.basePriceCents) && menu.basePriceCents >= 0 &&
    Number.isSafeInteger(menu.minimumPeople) && menu.minimumPeople > 0 &&
    [menu.title, menu.description, menu.theme, menu.diet].every(text) &&
    Array.isArray(menu.images) && menu.images.length >= 2 && menu.images.every((image) => image &&
      /^images\/[a-z0-9-]+\.svg$/.test(image.src) && text(image.alt) && text(image.caption)) &&
    menu.dishes && [menu.dishes.starters, menu.dishes.mains, menu.dishes.desserts].every(dishes) &&
    menu.conditions && texts(menu.conditions.order) && texts(menu.conditions.storage) &&
    Number.isSafeInteger(menu.stock) && menu.stock >= 0);
}

function createMenuDetails(menu, doc = document) {
  const section = doc.createElement("section");
  section.id = `menu-detail-${menu.id}`;
  section.className = "menu-detail";
  section.hidden = true;
  section.setAttribute("aria-labelledby", `menu-detail-title-${menu.id}`);
  const add = (parent, tag, text) => {
    const node = doc.createElement(tag);
    node.textContent = text;
    parent.append(node);
    return node;
  };
  const title = add(section, "h4", menu.title);
  title.id = `menu-detail-title-${menu.id}`;
  title.tabIndex = -1;
  add(section, "p", "Démonstration : illustration, plats, allergènes, conditions et stock fictifs. Aucune commande réelle n’est proposée.");
  const galleryTitle = add(section, "h5", "Galerie de démonstration — illustrations fictives");
  galleryTitle.id = `gallery-title-${menu.id}`;
  const gallery = doc.createElement("div");
  gallery.className = "menu-gallery";
  gallery.setAttribute("role", "group");
  gallery.setAttribute("aria-labelledby", galleryTitle.id);
  for (const visual of menu.images) {
    const figure = doc.createElement("figure");
    const image = doc.createElement("img");
    image.src = visual.src;
    image.alt = visual.alt;
    image.width = 640;
    image.height = 400;
    image.loading = "lazy";
    figure.append(image);
    add(figure, "figcaption", visual.caption);
    gallery.append(figure);
  }
  section.append(gallery);
  add(section, "p", menu.description);
  const info = doc.createElement("dl");
  for (const [label, value] of [
    ["Thème", menu.theme], ["Régime alimentaire", menu.diet],
    ["Prix total pour le minimum de personnes, hors livraison", new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(menu.basePriceCents / 100)],
    ["Nombre minimum de personnes", String(menu.minimumPeople)],
    ["Stock disponible (nombre de commandes possibles, fictif)", menu.stock === 0 ? "Indisponible — stock épuisé" : String(menu.stock)]
  ]) {
    add(info, "dt", label);
    add(info, "dd", value);
  }
  section.append(info);
  for (const [label, values] of [
    ["Entrées", menu.dishes.starters], ["Plats", menu.dishes.mains],
    ["Desserts", menu.dishes.desserts]
  ]) {
    add(section, "h5", label);
    const ul = doc.createElement("ul");
    values.forEach((dish) => {
      const li = doc.createElement("li");
      add(li, "strong", dish.name);
      add(li, "p", dish.allergens.length ? `Allergènes : ${dish.allergens.join(", ")}` : "Allergènes : aucun déclaré dans cet exemple fictif.");
      ul.append(li);
    });
    section.append(ul);
  }
  const conditions = doc.createElement("section");
  conditions.className = "order-conditions";
  conditions.setAttribute("aria-labelledby", `conditions-title-${menu.id}`);
  add(conditions, "h5", "À lire avant de commander — conditions fictives").id = `conditions-title-${menu.id}`;
  for (const [label, values] of [["Commande", menu.conditions.order], ["Conservation", menu.conditions.storage]]) {
    add(conditions, "h6", label);
    const ul = doc.createElement("ul");
    values.forEach((value) => add(ul, "li", value));
    conditions.append(ul);
  }
  section.append(conditions);
  const order = add(section, menu.stock === 0 ? "button" : "a", "Commander");
  order.className = "action-link";
  order.setAttribute("aria-label", `Commander : ${menu.title}`);
  if (menu.stock === 0) {
    order.type = "button";
    order.disabled = true;
    const reason = add(section, "p", "Commande indisponible : le stock fictif est épuisé.");
    reason.id = `stock-reason-${menu.id}`;
    order.setAttribute("aria-describedby", reason.id);
  } else {
    order.href = `commande.html?menu=${encodeURIComponent(menu.id)}`;
  }
  return section;
}

if (typeof module !== "undefined") module.exports = { isValidMenu, createMenuDetails };

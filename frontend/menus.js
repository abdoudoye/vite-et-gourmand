"use strict";

const form = document.querySelector("#filters");
const list = document.querySelector("#menu-list");
const count = document.querySelector("#result-count");
const error = document.querySelector("#filter-error");
const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
let menus = [];

// Source unique : API Express reliée à PostgreSQL, sans repli sur le JSON fictif.
async function loadMenus() {
  const response = await fetch("/api/menus");
  if (!response.ok) throw new Error("Chargement indisponible");
  const data = await response.json();
  if (!Array.isArray(data) || !data.every(isValidMenu) ||
    new Set(data.map((menu) => menu.id)).size !== data.length) throw new Error("Format de données invalide");
  return data;
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  node.textContent = text; // Affiche du texte, jamais du HTML provenant des données.
  if (className) node.className = className;
  return node;
}

function render() {
  const filters = {};
  let valid = true;
  for (const name of ["maxPrice", "priceFrom", "priceTo", "people"]) {
    const input = form.elements.namedItem(name);
    filters[name] = input.value === "" ? null : input.valueAsNumber;
    input.removeAttribute("aria-invalid");
    if (!input.validity.valid) {
      valid = false;
      input.setAttribute("aria-invalid", "true");
    }
  }
  filters.theme = form.elements.theme.value;
  filters.diet = form.elements.diet.value;
  const reversed = filters.priceFrom !== null && filters.priceTo !== null && filters.priceFrom > filters.priceTo;
  if (reversed) {
    form.elements.priceFrom.setAttribute("aria-invalid", "true");
    form.elements.priceTo.setAttribute("aria-invalid", "true");
  }
  error.textContent = !valid ? "Saisissez des prix positifs ou nuls et un nombre entier de personnes supérieur à zéro." : reversed ? "La borne « De » doit être inférieure ou égale à la borne « À »." : "";
  const matches = valid && !reversed ? filterMenus(menus, filters) : [];
  count.textContent = error.textContent ? "Filtres à corriger." : `${matches.length} menu${matches.length > 1 ? "s" : ""} disponible${matches.length > 1 ? "s" : ""} · exemples fictifs`;
  document.querySelector("#empty").hidden = matches.length !== 0 || Boolean(error.textContent);
  list.replaceChildren();
  for (const menu of matches) {
    const card = element("article", "", "menu-card");
    const body = element("div", "", "card-body");
    body.append(element("h3", menu.title), element("p", menu.description), element("span", menu.diet, "tag"), element("p", currency.format(menu.basePriceCents / 100), "price"), element("p", `Pour ${menu.minimumPeople} personnes minimum · hors livraison`, "price-note"));
    const detail = createMenuDetails(menu);
    const toggle = element("button", "Voir le détail");
    toggle.type = "button";
    toggle.setAttribute("aria-label", `Voir le détail : ${menu.title}`);
    toggle.setAttribute("aria-controls", detail.id);
    toggle.setAttribute("aria-expanded", "false");
    const close = element("button", "Retour au catalogue");
    close.type = "button";
    const setOpen = (open) => {
      detail.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
      toggle.textContent = open ? "Masquer le détail" : "Voir le détail";
      toggle.setAttribute("aria-label", `${toggle.textContent} : ${menu.title}`);
      (open ? detail.querySelector("h4") : toggle).focus();
    };
    toggle.addEventListener("click", () => setOpen(detail.hidden));
    close.addEventListener("click", () => setOpen(false));
    detail.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
    });
    detail.append(close);
    body.append(toggle, detail);
    card.append(element("div", `Exemple fictif · ${menu.theme}`, "card-top"), body);
    list.append(card);
  }
}

form.addEventListener("submit", (event) => event.preventDefault());
form.addEventListener("input", render);
// Le navigateur restaure les valeurs après l'événement reset.
form.addEventListener("reset", () => setTimeout(render, 0));

async function init() {
  try {
    menus = await loadMenus();
    for (const field of ["theme", "diet"]) {
      for (const value of [...new Set(menus.map((menu) => menu[field]))].sort((a, b) => a.localeCompare(b, "fr"))) {
        const option = element("option", value);
        option.value = value;
        form.elements.namedItem(field).append(option);
      }
    }
    render();
  } catch {
    count.textContent = "Catalogue indisponible.";
    document.querySelector("#load-error").hidden = false;
    for (const control of form.elements) control.disabled = true;
  } finally {
    document.querySelector("#results").setAttribute("aria-busy", "false");
  }
}
init();

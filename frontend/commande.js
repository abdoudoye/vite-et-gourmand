"use strict";

const validateOrderMenu = typeof module !== "undefined" ? require("./menu-details.js").isValidMenu : isValidMenu;

function selectedMenuFromSearch(menus, search) {
  const values = new URLSearchParams(search).getAll("menu");
  if (values.length !== 1 || !/^[1-9]\d*$/.test(values[0])) return null;
  const id = Number(values[0]);
  return Number.isSafeInteger(id) ? menus.find((menu) => menu.id === id) || null : null;
}

async function showSelectedMenu(doc = document, search = window.location.search, request = fetch) {
  const status = doc.querySelector("#selection-status");
  try {
    const response = await request("data/menus.json");
    if (!response.ok) throw new Error("Chargement indisponible");
    const menus = await response.json();
    if (!Array.isArray(menus) || !menus.every(validateOrderMenu) ||
      new Set(menus.map((menu) => menu.id)).size !== menus.length) throw new Error("Données invalides");
    const menu = selectedMenuFromSearch(menus, search);
    if (!menu) {
      status.textContent = "Menu absent ou introuvable. Choisissez un menu depuis le catalogue.";
      return;
    }
    doc.querySelector("#selection-title").textContent = menu.title;
    doc.querySelector("#selection-id").textContent = `Menu choisi : n° ${menu.id} · Données fictives`;
    doc.querySelector("#selection-description").textContent = menu.description;
    doc.querySelector("#selected-menu").hidden = false;
    status.textContent = menu.stock === 0
      ? "Ce menu est indisponible : stock fictif épuisé. Aucune réservation effectuée."
      : "Menu sélectionné. Une connexion sera nécessaire avant toute commande. Aucune réservation effectuée.";
  } catch {
    status.setAttribute("role", "alert");
    status.textContent = "Impossible de charger le menu. Rechargez la page ou revenez au catalogue.";
  }
}

if (typeof module !== "undefined") module.exports = { selectedMenuFromSearch, showSelectedMenu };
if (typeof document !== "undefined") showSelectedMenu();

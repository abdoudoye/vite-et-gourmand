/* Fonction pure : même entrée, même résultat, sans modifier les données. */
function filterMenus(menus, filters) {
  return menus.filter((menu) =>
    (filters.maxPrice === null || menu.basePriceCents <= Math.round(filters.maxPrice * 100)) &&
    (filters.priceFrom === null || menu.basePriceCents >= Math.round(filters.priceFrom * 100)) &&
    (filters.priceTo === null || menu.basePriceCents <= Math.round(filters.priceTo * 100)) &&
    (!filters.theme || menu.theme === filters.theme) &&
    (!filters.diet || menu.diet === filters.diet) &&
    (filters.people === null || menu.minimumPeople <= filters.people)
  );
}

if (typeof module !== "undefined") module.exports = { filterMenus };

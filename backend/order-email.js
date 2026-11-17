"use strict";
function orderConfirmationText(order) {
  const total = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(order.totalCents / 100);
  return `Votre commande ${order.reference} est enregistrée.\nMenu : ${order.menuTitle}\nPersonnes : ${order.people}\nPrestation : ${order.serviceDate}\nLivraison : ${new Date(order.deliveryAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })} (Paris)\nTotal : ${total}\nStatut : ${order.statusLabel}\nConsultez votre espace client pour le suivi.\nProjet pédagogique : menus et prestations fictifs.`;
}
module.exports = { orderConfirmationText };

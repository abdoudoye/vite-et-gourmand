"use strict";
async function loadOrders(doc = document, request = fetch, location = window.location, offset = 0) {
  const status = doc.getElementById("orders-status");
  const error = doc.getElementById("orders-error");
  const list = doc.getElementById("orders-list");
  const money = (cents) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
  const add = (parent, tag, text) => { const node = doc.createElement(tag); node.textContent = text; parent.append(node); return node; };
  try {
    const response = await request(`/api/orders?offset=${offset}`, { credentials: "same-origin", cache: "no-store" });
    if (response.status === 401) { location.assign("connexion.html"); return; }
    if (!response.ok) throw new Error();
    const orders = await response.json();
    if (!Array.isArray(orders)) throw new Error();
    list.replaceChildren();
    status.textContent = orders.length ? `${orders.length} commande(s).` : "Vous n’avez pas encore de commande.";
    const previous = doc.getElementById("previous-page"); const next = doc.getElementById("next-page");
    if (previous) { previous.disabled = offset === 0; previous.onclick = () => loadOrders(doc,request,location,Math.max(0,offset-50)); }
    if (next) { next.disabled = orders.length < 50; next.onclick = () => loadOrders(doc,request,location,offset+50); }
    for (const order of orders) {
      const article = doc.createElement("article"); article.className = "order-conditions";
      add(article, "h2", order.menuTitle); add(article, "p", `Référence : ${order.reference}`);
      add(article, "p", `${order.people} personnes · Total : ${money(order.totalCents)} · ${order.statusLabel}`);
      add(article, "p", `Prestation : ${order.serviceDate}. Livraison : ${new Date(order.deliveryAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })} (Paris).`);
      const detail = doc.createElement("details"); add(detail, "summary", "Détail et suivi");
      add(detail, "p", `Livraison : ${order.street}, ${order.additionalLine || ""} ${order.postalCode} ${order.city}, ${order.countryCode}`);
      add(detail, "p", `Menu : ${money(order.grossCents)} · Remise : ${money(order.discountCents)} · Livraison : ${money(order.deliveryCents)}`);
      const history = doc.createElement("ul");
      for (const event of order.history) add(history, "li", `${event.status} · ${new Date(event.date).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}`);
      detail.append(history); article.append(detail); list.append(article);
      if (order.status === "terminee") {
        const review = doc.createElement("form");review.method="post";review.action=`/api/orders/${order.id}/review`;
        add(review,"h3","Donner mon avis après cette commande terminée");
        const ratingLabel=add(review,"label","Note (1 à 5)");ratingLabel.htmlFor=`rating-${order.id}`;
        const rating=doc.createElement("input");rating.id=`rating-${order.id}`;rating.type="number";rating.min="1";rating.max="5";rating.step="1";rating.required=true;review.append(rating);
        const commentLabel=add(review,"label","Commentaire (2 000 caractères maximum)");commentLabel.htmlFor=`review-${order.id}`;
        const comment=doc.createElement("textarea");comment.id=`review-${order.id}`;comment.maxLength=2000;comment.required=true;review.append(comment);
        const button=add(review,"button","Envoyer mon avis pour validation");button.type="submit";
        const message=add(review,"p","");message.setAttribute("role","status");
        review.addEventListener("submit",async event=>{
          event.preventDefault();if (button.disabled || !review.reportValidity()) return;
          button.disabled=true;message.textContent="Envoi en cours…";
          try {
            const response=await request(review.action,{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json","X-Requested-With":"ViteGourmand"},body:JSON.stringify({rating:Number(rating.value),comment:comment.value})});
            if (response.status===401) {location.assign("connexion.html");return;}
            const result=await response.json();if (!response.ok) throw new Error(result.error||"Envoi impossible.");
            message.textContent=result.message;rating.disabled=true;comment.disabled=true;
          } catch(failure){message.textContent=failure.message||"Serveur indisponible.";button.disabled=false;}
        });
        article.append(review);
      }
      if (order.status === "en_attente") {
        const edit = add(article, "a", "Modifier cette commande"); edit.href = `commande.html?menu=${order.menuId}&order=${order.id}`;
        const cancel = doc.createElement("form");
        cancel.method = "post"; cancel.action = `/api/orders/${order.id}/cancel`;
        const label = add(cancel, "label", "Motif d’annulation"); label.htmlFor = `cancel-${order.id}`;
        const reason = doc.createElement("input"); reason.id = `cancel-${order.id}`; reason.required = true; reason.maxLength = 500; cancel.append(reason);
        const button = add(cancel, "button", "Annuler cette commande"); button.type = "submit";
        const message = add(cancel, "p", ""); message.setAttribute("role", "alert");
        cancel.addEventListener("submit", async (event) => {
          event.preventDefault(); if (button.disabled || !cancel.reportValidity()) return;
          button.disabled = true; message.textContent = "";
          try {
            const response = await request(`/api/orders/${order.id}/cancel`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-Requested-With": "ViteGourmand" }, body: JSON.stringify({ reason: reason.value }) });
            if (!response.ok) { const data = await response.json(); throw new Error(data.error || "Annulation impossible."); }
            await loadOrders(doc, request, location, offset);
          } catch (failure) { message.textContent = failure.message || "Annulation impossible. Rechargez vos commandes avant de réessayer."; button.disabled = false; }
        });
        article.append(cancel);
      }
    }
  } catch { status.textContent = ""; error.textContent = "Impossible de charger vos commandes. Rechargez la page pour réessayer."; }
}
if (typeof module !== "undefined") module.exports = { loadOrders };
if (typeof window !== "undefined") loadOrders();

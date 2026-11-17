"use strict";

async function initEmployee(doc = document, request = fetch, location = window.location) {
  const el = (id) => doc.getElementById(id);
  const content=el("employee-content"), status=el("employee-status"), error=el("employee-error");
  const detail=el("employee-detail"), decisionForm=el("decision-form"), fields=el("decision-fields");
  let selected=null, offset=0, deciding=false, listVersion=0, detailVersion=0;
  const money=(value)=>new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR"}).format(value/100);
  const date=(value)=>new Date(value).toLocaleString("fr-FR",{timeZone:"Europe/Paris"});
  const add=(parent,tag,text)=>{const node=doc.createElement(tag);node.textContent=text;parent.append(node);return node;};
  const fail=(message)=>{error.textContent=message;error.focus();};
  function clearProtected() { content.hidden=true;detail.hidden=true;decisionForm.hidden=true;decisionForm.reset();el("employee-orders").replaceChildren();el("detail-summary").replaceChildren();el("employee-history").replaceChildren();el("employee-contacts").replaceChildren();selected=null; }
  if(typeof window!=="undefined")window.addEventListener("pagehide",clearProtected);
  async function api(url,body) {
    const response=await request(url,body===undefined?{credentials:"same-origin",cache:"no-store"}:{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json","X-Requested-With":"ViteGourmand"},body:JSON.stringify(body)});
    if(response.status===401){clearProtected();location.assign("connexion.html");throw new Error("Reconnectez-vous pour continuer.");}
    if(response.status===403){clearProtected();throw new Error("Accès réservé aux employés et administrateurs.");}
    const data=await response.json();if(!response.ok)throw new Error(data.error||"Service indisponible.");return data;
  }
  function renderDetail(order) {
    selected=order.id;detail.hidden=false;
    const summary=el("detail-summary");summary.replaceChildren();
    for(const text of [`Référence : ${order.reference}${order.isDemo?" · Démonstration fictive":""}`,`${order.menuTitle} · ${order.people} personnes · ${money(order.totalCents)} · ${order.statusLabel}`,
      `Client n° ${order.clientId} : ${order.firstName} ${order.lastName}`,`Contact : ${order.email} · ${order.phone}`,
      `Prestation : ${order.serviceDate} · Livraison : ${date(order.deliveryAt)} (Paris)`,
      `Adresse : ${order.street}, ${order.additionalLine||""} ${order.postalCode} ${order.city}, ${order.countryCode}`,
      `Menu brut : ${money(order.grossCents)} · Remise : ${money(order.discountCents)} · Livraison : ${money(order.totalCents-order.menuCents)}`,
      `Conditions de commande : ${order.orderConditions}`,`Conservation : ${order.storageConditions}`])add(summary,"p",text);
    const history=el("employee-history");history.replaceChildren();
    for(const event of order.history)add(history,"li",`${event.statusLabel} · ${date(event.date)} (Paris) · Compte n° ${event.actorId} · ${event.reason}`);
    const contacts=el("employee-contacts");contacts.replaceChildren();
    if(!order.contacts.length)add(contacts,"li","Aucun contact déclaré.");
    for(const contact of order.contacts)add(contacts,"li",`${contact.method==="telephone"?"Téléphone":"Email"} · ${date(contact.date)} (Paris) · ${contact.reason}`);
    decisionForm.hidden=order.status!=="en_attente";
    decisionForm.action=`/api/employee/orders/${order.id}/decision`;
    decisionForm.reset();el("detail-title").focus();
  }
  async function showDetail(id) {
    if(deciding)return;
    const version=++detailVersion;error.textContent="";detail.hidden=true;selected=null;
    try{const order=await api(`/api/employee/orders/${id}`);if(version===detailVersion)renderDetail(order);}
    catch(failure){fail(failure.message);}
  }
  async function loadList() {
    const version=++listVersion;
    const params=new URLSearchParams({offset:String(offset)});
    if(el("status-filter").value)params.set("status",el("status-filter").value);
    if(el("client-filter").value.trim())params.set("clientId",el("client-filter").value.trim());
    status.textContent="Chargement des commandes…";content.setAttribute("aria-busy","true");
    try {
      const orders=await api(`/api/employee/orders?${params}`);if(version!==listVersion)return;
      const rows=el("employee-orders");rows.replaceChildren();
      for(const order of orders){const row=doc.createElement("tr");for(const value of [order.reference,order.menuTitle,order.serviceDate,order.people,money(order.totalCents),order.statusLabel])add(row,"td",String(value));const action=add(row,"td","");const button=add(action,"button","Détail");button.type="button";button.setAttribute("aria-label",`Consulter ${order.reference}`);button.addEventListener("click",()=>showDetail(order.id));rows.append(row);}
      status.textContent=orders.length?`${orders.length} commande(s) affichée(s), page ${offset/50+1}.`:"Aucune commande pour ces filtres.";
      el("employee-previous").disabled=offset===0;el("employee-next").disabled=orders.length<50;
    }catch(failure){if(version===listVersion){status.textContent="";fail(failure.message);}}
    finally{if(version===listVersion)content.setAttribute("aria-busy","false");}
  }
  async function decide(target) {
    if(deciding||!selected)return;
    const id=selected;const body={status:target};
    if(target==="refusee"){
      if(!decisionForm.reportValidity())return;
      const contactDate=new Date(el("contact-at").value);if(!Number.isFinite(contactDate.getTime())){fail("Date de contact invalide.");return;}
      body.reason=el("refusal-reason").value;body.contact={method:el("contact-method").value,at:contactDate.toISOString()};
    }
    deciding=true;fields.disabled=true;error.textContent="";decisionForm.setAttribute("aria-busy","true");
    try{const result=await api(`/api/employee/orders/${id}/decision`,body);renderDetail(result.order);await loadList();if(!content.hidden)status.textContent=`Commande ${result.order.reference} : ${result.order.statusLabel}${result.replayed?" (décision déjà enregistrée)":""}.`;}
    catch(failure){fail(`${failure.message} Actualisez le détail avant de réessayer si la réponse a été interrompue.`);}
    finally{deciding=false;fields.disabled=false;decisionForm.setAttribute("aria-busy","false");}
  }
  el("employee-filters").addEventListener("submit",async(event)=>{event.preventDefault();if(deciding)return;offset=0;error.textContent="";await loadList();});
  el("employee-previous").addEventListener("click",async()=>{if(deciding)return;offset=Math.max(0,offset-50);await loadList();});
  el("employee-next").addEventListener("click",async()=>{if(deciding)return;offset+=50;await loadList();});
  el("accept-order").addEventListener("click",()=>decide("accepte"));
  decisionForm.addEventListener("submit",async(event)=>{event.preventDefault();await decide("refusee");});
  try {
    const me=await api("/api/auth/me");
    if(!["employe","administrateur"].includes(me.user.role)){clearProtected();status.textContent="";fail("Accès réservé aux employés et administrateurs.");return;}
    content.hidden=false;await loadList();
  }catch(failure){status.textContent="";fail(failure.message);}
}
if(typeof module!=="undefined")module.exports={initEmployee};
if(typeof window!=="undefined"){
  window.addEventListener("pageshow",event=>{if(event.persisted)window.location.reload();});
  initEmployee();
}

"use strict";

async function initAdmin(doc = document, request = fetch, location = window.location, confirmAction = message => window.confirm(message)) {
  const el=id=>doc.getElementById(id), content=el("admin-content"), status=el("admin-status"), error=el("admin-error");
  const offsets={orders:0,employees:0,menus:0,reviews:0};
  const lengths={orders:0,employees:0,menus:0,reviews:0};
  let authorized=false, selectedMenu=null, busy=false;
  const menuKeys=["title","description","themeId","dietId","minimumPeople","basePriceCents","stock","noticeHours","orderConditions","storageConditions"];
  const numericKeys=["minimumPeople","basePriceCents","stock","noticeHours"];
  const add=(parent,tag,value)=>{const node=doc.createElement(tag);node.textContent=String(value);parent.append(node);return node;};
  const money=cents=>new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR"}).format(cents/100);
  const fail=message=>{error.textContent=message;error.focus();};
  function clearProtected() {
    authorized=false;content.hidden=true;selectedMenu=null;el("menu-form").hidden=true;
    el("menu-form").reset();el("employee-form").reset();el("statistics-status").textContent="";
    for (const name of Object.keys(offsets)) el(`${name}-list`).replaceChildren();
  }
  if (typeof window!=="undefined") window.addEventListener("pagehide",clearProtected);
  async function api(url,body) {
    const response=await request(url,{credentials:"same-origin",cache:"no-store",...(body===undefined?{}:{method:"POST",headers:{"Content-Type":"application/json","X-Requested-With":"ViteGourmand"},body:JSON.stringify(body)})});
    if (response.status===401 || response.status===403) {
      clearProtected();
      if (response.status===401) location.assign("connexion.html");
      throw new Error(response.status===401?"Reconnectez-vous pour continuer.":"Accès réservé aux administrateurs actifs.");
    }
    const data=await response.json();
    if (!response.ok) throw new Error(data.error||"Service indisponible.");
    if (!authorized && url!=="/api/auth/me") throw new Error("Session interrompue. Rechargez la page.");
    return data;
  }
  function selectMenu(menu) {
    selectedMenu=menu;el("menu-form").hidden=false;
    el("menu-form").action=`/api/admin/menus/${menu.id}`;
    for (const key of menuKeys) el(`menu-${key}`).value=menu[key]??"";
    el("menu-editor-title").textContent=`Modifier : ${menu.title}`;el("menu-editor-title").focus();
  }
  function action(parent,label,work) {const button=add(parent,"button",label);button.type="button";button.addEventListener("click",()=>run(work));return button;}
  async function load(name) {
    let url=name==="orders"?"/api/employee/orders":`/api/admin/${name}`;
    const params=new URLSearchParams({offset:String(offsets[name])});
    if (name==="orders" && el("order-status").value) params.set("status",el("order-status").value);
    if (name==="orders" && el("order-client").value.trim()) params.set("clientId",el("order-client").value.trim());
    if (name==="reviews") params.set("status",el("review-status").value);
    const rows=await api(`${url}?${params}`), list=el(`${name}-list`);lengths[name]=rows.length;list.replaceChildren();
    if (!rows.length) add(list,"p","Aucun résultat.");
    for (const row of rows) {
      const card=doc.createElement("article");list.append(card);
      if (name==="orders") {
        add(card,"h3",row.reference);add(card,"p",`${row.menuTitle} · ${row.people} personnes · ${money(row.totalCents)}`);
        add(card,"p",`${row.statusLabel} · Prestation : ${row.serviceDate}`);
      } else if (name==="employees") {
        add(card,"h3",`${row.firstName} ${row.lastName}`);add(card,"p",`${row.email} · ${row.phone}`);
        add(card,"p",row.isActive?"Compte actif":"Compte désactivé");
        if (row.isActive) action(card,"Désactiver cet employé",async()=>{
          if (!confirmAction(`Désactiver le compte de ${row.firstName} ${row.lastName} ? Ses accès seront refusés dès la prochaine requête.`)) return;
          await api(`/api/admin/employees/${row.id}/deactivate`,{});await load("employees");status.textContent="Compte employé désactivé.";
        });
      } else if (name==="menus") {
        add(card,"h3",row.title);add(card,"p",`${money(row.basePriceCents)} pour ${row.minimumPeople} personnes minimum · Stock : ${row.stock}`);
        if (row.archivedAt) add(card,"p","Menu archivé, absent du catalogue public.");
        action(card,"Modifier ce menu",()=>selectMenu(row));
      } else {
        add(card,"h3",`Commande ${row.reference} · ${row.rating}/5`);add(card,"p",row.comment);add(card,"p",`Modération : ${row.status} · Commande : ${row.orderStatus}`);
        if (row.status==="en_attente" && row.orderStatus==="terminee") for (const [decision,label] of [["valide","Valider cet avis"],["refuse","Refuser cet avis"]]) action(card,label,async()=>{
          await api(`/api/admin/reviews/${row.id}/moderate`,{status:decision});await load("reviews");status.textContent="Décision de modération enregistrée.";
        });
        if (row.orderStatus!=="terminee") add(card,"p","Modération bloquée : commande non terminée.");
      }
      if (row.isDemo) add(card,"p","Démonstration fictive");
    }
    el(`${name}-previous`).disabled=offsets[name]===0;el(`${name}-next`).disabled=rows.length<50;
  }
  async function run(work) {
    if (busy || !authorized) return;
    busy=true;content.setAttribute("aria-busy","true");error.textContent="";status.textContent="Opération en cours…";
    // Bloquer les changements de sélection et les doubles envois pendant une écriture.
    const controls=[...content.querySelectorAll("button,input,select,textarea")];
    const states=controls.map(node=>node.disabled);controls.forEach(node=>{node.disabled=true;});
    try {await work();if (authorized && status.textContent==="Opération en cours…") status.textContent="Données actualisées.";}
    catch(failure){status.textContent="";fail(failure.message||"Opération impossible. Actualisez les données avant de réessayer.");}
    finally {
      // Les boutons de pagination peuvent avoir été recalculés par load().
      controls.forEach((node,index)=>{if (!/-previous$|-next$/.test(node.id)) node.disabled=states[index];});
      if (authorized) for (const name of Object.keys(offsets)) {el(`${name}-previous`).disabled=offsets[name]===0;el(`${name}-next`).disabled=lengths[name]<50;}
      busy=false;content.setAttribute("aria-busy","false");
    }
  }
  for (const name of Object.keys(offsets)) {
    el(`${name}-previous`).addEventListener("click",()=>run(async()=>{offsets[name]=Math.max(0,offsets[name]-50);await load(name);}));
    el(`${name}-next`).addEventListener("click",()=>run(async()=>{offsets[name]+=50;await load(name);}));
  }
  for (const name of ["orders","reviews"]) el(`${name}-filter`).addEventListener("submit",event=>{event.preventDefault();return run(async()=>{offsets[name]=0;await load(name);});});
  el("menus-refresh").addEventListener("click",()=>run(async()=>{selectedMenu=null;el("menu-form").hidden=true;await load("menus");}));
  el("menu-cancel").addEventListener("click",()=>{if (!busy) {selectedMenu=null;el("menu-form").hidden=true;}});
  el("employee-form").addEventListener("submit",event=>{
    event.preventDefault();if (!el("employee-form").reportValidity()) return;
    const body={};for (const key of ["firstName","lastName","email","phone","password","passwordConfirmation"]) body[key]=el(key).value;
    body.isDemo=el("isDemo").checked;
    return run(async()=>{
      try {
        const result=await api("/api/admin/employees",body);el("employee-form").reset();offsets.employees=0;
        try {await load("employees");} catch {throw new Error("Compte employé créé, mais la liste n’a pas pu être actualisée. Actualisez la page sans recréer le compte.");}
        status.textContent=result.notification==="sent"?"Compte employé créé. Notification envoyée sans mot de passe.":"Compte employé créé. Notification enregistrée en attente ; aucun email envoyé confirmé.";
      } finally {el("password").value="";el("passwordConfirmation").value="";body.password="";body.passwordConfirmation="";}
    });
  });
  el("menu-form").addEventListener("submit",event=>{
    event.preventDefault();if (!selectedMenu || !el("menu-form").reportValidity()) return;
    const body={version:selectedMenu.version};for (const key of menuKeys) body[key]=numericKeys.includes(key)?Number(el(`menu-${key}`).value):el(`menu-${key}`).value;
    return run(async()=>{
      try {await api(`/api/admin/menus/${selectedMenu.id}`,body);selectedMenu=null;el("menu-form").hidden=true;
        try {await load("menus");} catch {throw new Error("Menu et stock enregistrés, mais la liste n’a pas pu être actualisée. Rechargez la page.");}
        status.textContent="Menu et stock enregistrés.";}
      catch(failure){selectedMenu=null;el("menu-form").hidden=true;throw failure;}
    });
  });
  try {
    const {user}=await api("/api/auth/me");
    if (user.role!=="administrateur") throw new Error("Accès réservé aux administrateurs actifs.");
    authorized=true;
    const dashboard=await api("/api/admin/dashboard");el("statistics-status").textContent=dashboard.statistics.reason;
    const references=await api("/api/admin/references");
    for (const [name,rows] of [["themeId",references.themes],["dietId",references.diets]]) {
      const select=el(`menu-${name}`);select.replaceChildren();for (const row of rows) {const option=add(select,"option",row.name);option.value=row.id;}
    }
    // Chaque rubrique possède sa pagination ; aucun chargement global illimité.
    for (const name of Object.keys(offsets)) await load(name);
    content.hidden=false;status.textContent="Administration prête. Les listes sont affichées par pages de 50.";
  } catch(failure){clearProtected();status.textContent="";fail(failure.message);}
}
if (typeof module!=="undefined") module.exports={initAdmin};
if (typeof window!=="undefined") {window.addEventListener("pageshow",event=>{if (event.persisted) window.location.reload();});initAdmin();}

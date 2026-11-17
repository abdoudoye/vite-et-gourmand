"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { initCheckout } = require("../frontend/order-checkout");
const { loadOrders } = require("../frontend/mes-commandes");
const response = (status, data) => ({ status, ok: status >= 200 && status < 300, json: async () => data });
const context = { customer: { firstName: "Client", lastName: "Fictif", email: "ui@example.test", phone: "0600000000" },
  menu: { id:1,title:"Menu fictif",minimumPeople:6,basePriceCents:18000,stock:2,orderConditions:"Conditions fictives",storageConditions:"Conservation fictive",noticeHours:72 },
  address:{street:"1 voie Fictive",postalCode:"33000",city:"Bordeaux",countryCode:"FR"},pricing:"prorata",termsVersion:"DEMO-v1" };
function page() {
  const elements = new Map();
  const document = { focused:"", getElementById:(id)=>elements.get(id),createElement:(tag)=>node(tag) };
  const node = (id) => ({ id,value:"",textContent:"",checked:true,hidden:true,disabled:false,children:[],listeners:{},
    append(...nodes){this.children.push(...nodes);},replaceChildren(){this.children=[];},setAttribute(){},
    addEventListener(event,handler){this.listeners[event]=handler;},reportValidity(){return true;},focus(){document.focused=id;}
  });
  for(const id of ["selection-status","checkout-error","checkout-form","quote","confirm","calculate","selection-title","selection-id","selection-description","selected-menu","customer","people","pricing-rule","order-conditions","storage-conditions","terms-version","street","additionalLine","postalCode","city","countryCode","serviceDate","deliveryDate","deliveryTime","conditionsAccepted","price-breakdown","quote-expiry","quote-title","confirmation","orders-status","orders-error","orders-list"]) elements.set(id,node(id));
  const location={search:"?menu=1",assigned:"",assign(url){this.assigned=url;}};
  return {document,elements,location,submit:()=>elements.get("checkout-form").listeners.submit({preventDefault(){}}),confirm:()=>elements.get("confirm").listeners.click()};
}
const quotation = () => ({quoteId:"devis-fictif",expiresAt:new Date(Date.now()+900000).toISOString(),grossCents:33000,discountPercent:10,discountCents:3300,menuCents:29700,deliveryCents:0,totalCents:29700,distanceKm:null});

test("commande : client non connecté redirigé en conservant le menu",async()=>{
  const ui=page(); await initCheckout(ui.document,ui.location,async()=>response(401,{}));
  assert.equal(ui.location.assigned,"connexion.html?next=commande.html%3Fmenu%3D1");
  assert.equal(ui.elements.get("checkout-form").hidden,true);
});
test("commande : coordonnées préremplies, devis affiché avant validation, clé conservée après coupure réseau",async()=>{
  const ui=page();const requests=[];let failures=0;
  await initCheckout(ui.document,ui.location,async(url,options)=>{
    if(url.includes("checkout?"))return response(200,context);
    requests.push([url,JSON.parse(options.body)]);
    assert.equal(options.headers["X-Requested-With"],"ViteGourmand");
    if(url.endsWith("/quote"))return response(200,quotation());
    if(failures++===0)throw new Error("Réseau");
    return response(201,{order:{reference:"TEST-FICTIF",statusLabel:"En attente",totalCents:29700},confirmationEmail:"pending"});
  });
  assert.equal(ui.elements.get("street").value,"1 voie Fictive");assert.equal(ui.elements.get("people").min,6);
  assert.match(ui.elements.get("customer").textContent,/ui@example.test/);
  await ui.submit();assert.equal(requests.length,1);assert.equal(ui.elements.get("quote").hidden,false);
  assert.equal(ui.document.focused,"quote-title");
  await ui.confirm();await ui.confirm();
  assert.equal(requests[1][1].idempotencyKey,requests[2][1].idempotencyKey);
  assert.deepEqual(Object.keys(requests[1][1]).sort(),["idempotencyKey","quoteId"]);
  assert.match(ui.elements.get("confirmation").textContent,/TEST-FICTIF/);
  await ui.confirm();assert.equal(requests.length,3);
});
test("commande : modification du formulaire pendant le calcul invalide la réponse tardive",async()=>{
  const ui=page();let resolve;
  await initCheckout(ui.document,ui.location,async(url)=>url.includes("checkout?")?response(200,context):new Promise(done=>{resolve=done;}));
  const pending=ui.submit();ui.elements.get("checkout-form").listeners.input();resolve(response(200,quotation()));await pending;
  assert.equal(ui.elements.get("quote").hidden,true);assert.equal(ui.elements.get("confirm").disabled,true);
});
test("liste : état vide, refus d'accès et erreur réseau accessibles",async()=>{
  const ui=page();await loadOrders(ui.document,async()=>response(200,[]),ui.location);
  assert.match(ui.elements.get("orders-status").textContent,/pas encore/);
  await loadOrders(ui.document,async()=>response(401,{}),ui.location);assert.equal(ui.location.assigned,"connexion.html");
  await loadOrders(ui.document,async()=>{throw new Error();},ui.location);assert.match(ui.elements.get("orders-error").textContent,/Impossible/);
});

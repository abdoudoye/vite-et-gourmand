"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const {initEmployee}=require("../frontend/employe");
const response=(status,data)=>({status,ok:status>=200&&status<300,json:async()=>data});
const sample={id:"1",reference:"TEST-FICTIF",clientId:"7",serviceDate:"2030-01-01",deliveryAt:"2030-01-01T10:00:00Z",status:"en_attente",statusLabel:"En attente",isDemo:true,menuTitle:"Menu fictif",people:6,totalCents:18000,
  firstName:"Client",lastName:"Fictif",email:"client@example.test",phone:"0600000000",street:"1 voie Fictive",additionalLine:null,postalCode:"33000",city:"Bordeaux",countryCode:"FR",
  grossCents:18000,discountCents:0,menuCents:18000,orderConditions:"Conditions fictives",storageConditions:"Conservation fictive",history:[{statusLabel:"En attente",date:"2026-01-01T10:00:00Z",actorId:"7",reason:"Création"}],contacts:[]};
function page(){
  const elements=new Map();const doc={focused:"",getElementById:id=>elements.get(id),createElement:tag=>node(tag)};
  function node(id){return{id,value:"",hidden:true,disabled:false,textContent:"",children:[],listeners:{},attributes:{},
    append(...nodes){this.children.push(...nodes);},replaceChildren(){this.children=[];},setAttribute(k,v){this.attributes[k]=v;},addEventListener(e,fn){this.listeners[e]=fn;},focus(){doc.focused=id;},reset(){},reportValidity(){return true;}};}
  for(const id of ["employee-content","employee-status","employee-error","employee-detail","decision-form","decision-fields","employee-orders","detail-summary","employee-history","employee-contacts","detail-title","employee-filters","status-filter","client-filter","employee-previous","employee-next","accept-order","refuse-order","refusal-reason","contact-method","contact-at"])elements.set(id,node(id));
  const location={assigned:"",assign(url){this.assigned=url;}};return{doc,elements,location};
}
test("interface employé : aucun chargement de commandes pour un client ou une session absente",async()=>{
  for(const authenticated of [false,true]){const ui=page();let calls=0;
    await initEmployee(ui.doc,async()=>{calls++;return authenticated?response(200,{user:{role:"utilisateur"}}):response(401,{});},ui.location);
    assert.equal(calls,1);assert.equal(ui.elements.get("employee-content").hidden,true);
    if(authenticated)assert.match(ui.elements.get("employee-error").textContent,/réservé/);else assert.equal(ui.location.assigned,"connexion.html");
  }
});
test("interface employé : liste, détail, historique, acceptation avec CSRF et double clic bloqué",async()=>{
  const ui=page();let decisions=0,resolve;
  await initEmployee(ui.doc,async(url,options)=>{
    if(url==="/api/auth/me")return response(200,{user:{role:"employe"}});
    if(url.endsWith("/decision")){decisions++;assert.equal(options.headers["X-Requested-With"],"ViteGourmand");assert.deepEqual(JSON.parse(options.body),{status:"accepte"});return new Promise(done=>{resolve=done;});}
    if(url.endsWith("/1"))return response(200,sample);
    return response(200,[sample]);
  },ui.location);
  assert.equal(ui.elements.get("employee-content").hidden,false);
  const row=ui.elements.get("employee-orders").children[0];assert.equal(row.children[0].textContent,"TEST-FICTIF");
  await row.children[6].children[0].listeners.click();
  assert.equal(ui.elements.get("employee-detail").hidden,false);assert.equal(ui.elements.get("decision-form").hidden,false);
  assert.equal(ui.doc.focused,"detail-title");assert.equal(ui.elements.get("employee-history").children.length,1);
  const pending=ui.elements.get("accept-order").listeners.click();await ui.elements.get("accept-order").listeners.click();assert.equal(decisions,1);
  assert.equal(ui.elements.get("decision-fields").disabled,true);
  resolve(response(200,{order:{...sample,status:"accepte",statusLabel:"Accepté"},replayed:false}));await pending;
  assert.equal(ui.elements.get("decision-form").hidden,true);assert.match(ui.elements.get("employee-status").textContent,/Accepté/);
});
test("interface employé : refus transmet le contact déclaré et conserve l'erreur réseau pour réessayer",async()=>{
  const ui=page();let body;
  await initEmployee(ui.doc,async(url,options)=>{
    if(url==="/api/auth/me")return response(200,{user:{role:"administrateur"}});
    if(url.endsWith("/decision")){body=JSON.parse(options.body);throw new Error("Réseau");}
    if(url.endsWith("/1"))return response(200,sample);return response(200,[sample]);
  },ui.location);
  await ui.elements.get("employee-orders").children[0].children[6].children[0].listeners.click();
  ui.elements.get("refusal-reason").value="Motif fictif";ui.elements.get("contact-method").value="email";ui.elements.get("contact-at").value="2026-01-01T10:00";
  await ui.elements.get("decision-form").listeners.submit({preventDefault(){}});
  assert.equal(body.status,"refusee");assert.equal(body.reason,"Motif fictif");assert.equal(body.contact.method,"email");assert.match(body.contact.at,/Z$/);
  assert.match(ui.elements.get("employee-error").textContent,/Actualisez/);assert.equal(ui.elements.get("decision-fields").disabled,false);
});

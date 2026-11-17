"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {initAdmin}=require("../frontend/administrateur");
const {loadOrders}=require("../frontend/mes-commandes");
const response=(status,data)=>({status,ok:status>=200&&status<300,json:async()=>data});
const menu={id:"1",title:"Menu fictif",description:"Description fictive",themeId:"1",dietId:"1",minimumPeople:6,basePriceCents:18000,stock:7,noticeHours:72,orderConditions:"Commander avant",storageConditions:"Conserver au frais",version:"a".repeat(64),isDemo:true};
function page() {
  const elements=new Map();
  const doc={focused:"",getElementById:id=>elements.get(id),createElement:tag=>node(tag)};
  function node(id) {return{id,hidden:true,value:"",checked:true,disabled:false,textContent:"",children:[],listeners:{},attributes:{},
    append(...children){this.children.push(...children);},replaceChildren(){this.children=[];},setAttribute(key,value){this.attributes[key]=value;},
    addEventListener(event,fn){this.listeners[event]=fn;},focus(){doc.focused=id;},reportValidity(){return true;},reset(){},querySelectorAll(){return [...elements.values()].filter(n=>n.tag&&/button|input|select|textarea/.test(n.tag));}};}
  const html=fs.readFileSync(path.join(__dirname,"../frontend/administrateur.html"),"utf8");
  for(const match of html.matchAll(/<([a-z0-9-]+)[^>]*\bid="([^"]+)"/g)) {const n=node(match[2]);n.tag=match[1];elements.set(match[2],n);}
  elements.set("orders-status",node("orders-status"));elements.set("orders-error",node("orders-error"));
  elements.get("review-status").value="en_attente";
  const location={assigned:"",assign(value){this.assigned=value;}};
  return{doc,elements,location};
}
const event=()=>({preventDefault(){}});
const button=(node,label)=>node.children.find(child=>child.textContent===label);
function defaults(url) {
  if(url==="/api/auth/me") return response(200,{user:{role:"administrateur"}});
  if(url==="/api/admin/dashboard")return response(200,{statistics:{available:false,reason:"MongoDB non configuré"}});
  if(url==="/api/admin/references")return response(200,{themes:[{id:"1",name:"Classique"}],diets:[{id:"1",name:"Végétarien"}]});
  if(url.startsWith("/api/admin/menus?"))return response(200,[menu]);
  return response(200,[]);
}
test("interface admin : aucun chargement protégé pour anonyme, client ou employé",async()=>{
  for(const role of [null,"utilisateur","employe"]) {
    const ui=page();let calls=0;
    await initAdmin(ui.doc,async()=>{calls++;return role?response(200,{user:{role}}):response(401,{});},ui.location);
    assert.equal(calls,1);assert.equal(ui.elements.get("admin-content").hidden,true);assert.ok(ui.elements.get("admin-error").textContent);
    if(!role)assert.equal(ui.location.assigned,"connexion.html");
  }
});
test("interface admin : chargement, états vides, formulaires labels et liens de commandes existants",async()=>{
  const ui=page();await initAdmin(ui.doc,async url=>defaults(url),ui.location);
  assert.equal(ui.elements.get("admin-content").hidden,false);assert.match(ui.elements.get("statistics-status").textContent,/MongoDB/);
  assert.equal(ui.elements.get("employees-list").children[0].textContent,"Aucun résultat.");
  assert.equal(ui.elements.get("menus-next").disabled,true);
  const html=fs.readFileSync(path.join(__dirname,"../frontend/administrateur.html"),"utf8");
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
  for(const match of html.matchAll(/<(?:input|textarea|select)[^>]*\bid="([^"]+)"/g))assert.ok(html.includes(`for="${match[1]}"`),match[1]);
  assert.match(html,/href="employe.html"/);assert.match(html,/role="alert"/);
});
test("interface admin : menu en centimes, version transmise, double envoi bloqué et conflit oblige à recharger",async()=>{
  const ui=page();let writes=0,resolve,sent;
  await initAdmin(ui.doc,async(url,options)=>{
    if(url==="/api/admin/menus/1") {writes++;sent=JSON.parse(options.body);assert.equal(options.headers["X-Requested-With"],"ViteGourmand");return new Promise(done=>{resolve=done;});}
    return defaults(url);
  },ui.location);
  await button(ui.elements.get("menus-list").children[0],"Modifier ce menu").listeners.click();
  assert.equal(ui.elements.get("menu-form").hidden,false);assert.equal(ui.elements.get("menu-stock").value,7);
  const pending=ui.elements.get("menu-form").listeners.submit(event());
  await ui.elements.get("menu-form").listeners.submit(event());assert.equal(writes,1);
  assert.equal(sent.version,menu.version);assert.equal(sent.basePriceCents,18000);assert.equal(sent.stock,7);
  resolve(response(409,{error:"Le menu ou son stock a changé. Rechargez-le."}));await pending;
  assert.equal(ui.elements.get("menu-form").hidden,true);assert.match(ui.elements.get("admin-error").textContent,/stock a changé/);
});
test("interface admin : création sans rôle fourni et effacement des mots de passe après panne",async()=>{
  const ui=page();let sent;
  await initAdmin(ui.doc,async(url,options)=>{if(url==="/api/admin/employees") {sent=JSON.parse(options.body);return response(503,{error:"Panne simulée"});}return defaults(url);},ui.location);
  for(const key of ["firstName","lastName","email","phone"])ui.elements.get(key).value="Fictif";
  ui.elements.get("password").value="ExempleFictif42!";ui.elements.get("passwordConfirmation").value="ExempleFictif42!";
  await ui.elements.get("employee-form").listeners.submit(event());
  assert.equal(sent.isDemo,true);assert.ok(!("role" in sent));assert.ok(!("role_code" in sent));
  assert.equal(ui.elements.get("password").value,"");assert.equal(ui.elements.get("passwordConfirmation").value,"");
  assert.match(ui.elements.get("admin-error").textContent,/Panne/);
});
test("interface admin : désactivation annulable et purge des informations sur droits révoqués",async()=>{
  for(const confirmed of [false,true]) {
    const ui=page();let writes=0;
    await initAdmin(ui.doc,async(url)=>{
      if(url.includes("deactivate")) {writes++;return response(403,{});}
      if(url.startsWith("/api/admin/employees?"))return response(200,[{id:"8",firstName:"Compte",lastName:"Fictif",email:"test@example.test",phone:"0600000000",isActive:true}]);
      return defaults(url);
    },ui.location,()=>confirmed);
    await button(ui.elements.get("employees-list").children[0],"Désactiver cet employé").listeners.click();
    assert.equal(writes,confirmed?1:0);
    if(confirmed){assert.equal(ui.elements.get("admin-content").hidden,true);assert.equal(ui.elements.get("employees-list").children.length,0);}
  }
});
test("interface admin : création confirmée puis panne de liste ne doit pas inviter à recréer le compte",async()=>{
  const ui=page();let created=false;
  await initAdmin(ui.doc,async(url,options)=>{
    if(url==="/api/admin/employees" && options.method==="POST"){created=true;return response(201,{employee:{id:"10"},notification:"pending"});}
    if(created && url.startsWith("/api/admin/employees?"))return response(503,{error:"Panne de liste"});
    return defaults(url);
  },ui.location);
  await ui.elements.get("employee-form").listeners.submit(event());
  assert.match(ui.elements.get("admin-error").textContent,/Compte employé créé/);
  assert.match(ui.elements.get("admin-error").textContent,/sans recréer/);
});
test("interface client : avis proposé après commande terminée, envoi protégé et message de modération",async()=>{
  const ui=page();let submitted;
  const order={id:"9",menuTitle:"Fictif",reference:"TEST-AVIS",status:"terminee",statusLabel:"Terminée",totalCents:18000,grossCents:18000,discountCents:0,deliveryCents:0,history:[],deliveryAt:"2030-01-01T10:00:00Z"};
  await loadOrders(ui.doc,async(url,options)=>{
    if(options.method==="POST"){submitted=JSON.parse(options.body);assert.equal(options.headers["X-Requested-With"],"ViteGourmand");return response(201,{message:"Avis enregistré, en attente de validation."});}
    return response(200,[order]);
  },ui.location);
  const review=ui.elements.get("orders-list").children[0].children.find(child=>child.action==="/api/orders/9/review");assert.ok(review);
  const rating=review.children.find(n=>n.id==="rating-9"),comment=review.children.find(n=>n.id==="review-9");rating.value="4";comment.value="Avis fictif";
  await review.listeners.submit(event());assert.deepEqual(submitted,{rating:4,comment:"Avis fictif"});assert.equal(rating.disabled,true);assert.equal(comment.disabled,true);
  assert.match(review.children.at(-1).textContent,/attente de validation/);
});

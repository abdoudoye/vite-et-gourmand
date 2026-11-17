"use strict";
const { test,before,after }=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {once}=require("node:events");
const {randomUUID}=require("node:crypto");
const argon2=require("argon2");
const {PGlite}=require("@electric-sql/pglite");
const {createApp}=require("./app");
const {readSessionConfig}=require("./auth-session");
const {validateDecision}=require("./employee-orders");
let db,server,base,clientCookie,employeeCookie,adminCookie,employeeId;
const password="ExempleFictif42!";
const database={query:(...args)=>db.query(...args),transaction:(work)=>db.transaction(tx=>work({query:(...args)=>tx.query(...args)}))};
const input={menuId:1,people:6,serviceDate:"2035-12-20",deliveryDate:"2035-12-20",deliveryTime:"12:00",street:"1 voie Fictive",additionalLine:"",postalCode:"33000",city:"Bordeaux",countryCode:"FR",conditionsAccepted:true};
async function call(route,method="GET",body,cookie=employeeCookie,extraHeaders={}){
  return fetch(base+route,{method,headers:{"Content-Type":"application/json","X-Requested-With":"ViteGourmand",...(cookie?{Cookie:cookie}:{}),...extraHeaders},...(body===undefined?{}:{body:JSON.stringify(body)})});
}
async function json(route,method,body,expected=200,cookie){const response=await call(route,method,body,cookie);const data=await response.json();assert.equal(response.status,expected,JSON.stringify(data));return data;}
const stock=async()=>(await db.query("SELECT stock_available n FROM vg.menus WHERE id=1")).rows[0].n;
const refuse=()=>({status:"refusee",reason:"Refus fictif après contact du client",contact:{method:"telephone",at:new Date().toISOString()}});
async function createOrder(){
  // Les commandes de test passent par le parcours client : elles ont réellement
  // réservé une unité dans le moteur mémoire avant la décision employé.
  const q=await json("/api/orders/quote","POST",input,200,clientCookie);
  return (await json("/api/orders","POST",{quoteId:q.quoteId,idempotencyKey:randomUUID()},201,clientCookie)).order;
}
async function inspect(sql,values=[]){await db.exec("RESET ROLE;");try{return await db.query(sql,values);}finally{await db.exec("SET ROLE vg_app;");}}
before(async()=>{
  db=new PGlite();await db.exec("CREATE ROLE vg_owner; CREATE ROLE vg_app LOGIN; ALTER DATABASE postgres OWNER TO vg_owner;");
  for(const name of ["001_schema.sql","002_demo_data.sql","003_app_privileges.sql","004_registration_privileges.sql","007_login_privileges.sql","009_order_checkout.sql","010_employee_privileges.sql"]){await db.exec(fs.readFileSync(path.join(__dirname,"../database",name),"utf8"));}
  const hash=await argon2.hash(password,{type:argon2.argon2id});
  const users={};
  for(const role of ["utilisateur","employe","administrateur"]){
    const {rows}=await db.query("INSERT INTO vg.users(first_name,last_name,email,phone,password_hash,is_active,role_code) VALUES('Compte','Fictif',$1,'0600000000',$2,true,$3) RETURNING id::text",[role+".stafftest@example.test",hash,role]);users[role]=rows[0].id;
  }
  employeeId=users.employe;
  await db.query("UPDATE vg.menus SET stock_available=30 WHERE id=1");
  await db.exec("SET ROLE vg_app;");
  server=createApp({database,sessionConfig:readSessionConfig({SESSION_SECRET:"secret-fictif-espace-employe-1234567890"})}).listen(0,"127.0.0.1");await once(server,"listening");base=`http://127.0.0.1:${server.address().port}`;
  for(const [role,setter]of [["utilisateur",c=>{clientCookie=c;}],["employe",c=>{employeeCookie=c;}],["administrateur",c=>{adminCookie=c;}]]){
    const response=await call("/api/auth/login","POST",{email:role+".stafftest@example.test",password},"");assert.equal(response.status,200);setter(response.headers.get("set-cookie").split(";")[0]);
    const result=await response.json();assert.equal(result.user.role,role);assert.ok(!JSON.stringify(result).includes(hash));
  }
});
after(async()=>{if(server)await new Promise(resolve=>server.close(resolve));if(db)await db.close();});

test("anonyme refusé (401), client refusé (403), employés et administrateurs autorisés sans divulgation de hachage",async()=>{
  for(const [route,method,body]of [["/api/employee/orders","GET"],["/api/employee/orders/1","GET"],["/api/employee/orders/1/decision","POST",{status:"accepte"}]]){
    assert.equal((await call(route,method,body,"")).status,401);
    assert.equal((await call(route,method,body,clientCookie)).status,403);
  }
  for(const cookie of [employeeCookie,adminCookie]){
    const me=await json("/api/auth/me","GET",undefined,200,cookie);assert.ok(["employe","administrateur"].includes(me.user.role));
    const list=await json("/api/employee/orders","GET",undefined,200,cookie);assert.ok(list.length>=2);
    assert.ok(list.every(order=>!("email"in order)&&!("phone"in order)));
    assert.ok(!JSON.stringify(list).includes("password"));
  }
  assert.equal((await call("/api/orders/checkout?menu=1","GET",undefined,employeeCookie)).status,401);
  const spoof=await call("/api/auth/login","POST",{email:"utilisateur.stafftest@example.test",password,role:"administrateur"},"");
  assert.equal(spoof.status,200);assert.equal((await spoof.json()).user.role,"utilisateur");
  assert.equal((await call("/api/employee/orders","GET",undefined,spoof.headers.get("set-cookie").split(";")[0])).status,403);
});
test("liste, filtres, détail et historique réutilisent les données existantes",async()=>{
  const order=await createOrder();
  const list=await json(`/api/employee/orders?status=en_attente&clientId=${order.history[0]? (await json("/api/auth/me","GET",undefined,200,clientCookie)).user.id:"0"}`);
  assert.ok(list.some(row=>row.id===order.id));
  const detail=await json(`/api/employee/orders/${order.id}`);
  assert.equal(detail.reference,order.reference);assert.equal(detail.totalCents,18000);assert.equal(detail.people,6);
  assert.equal(detail.firstName,"Compte");assert.equal(detail.history.length,1);assert.equal(detail.history[0].status,"en_attente");
  assert.deepEqual(detail.contacts,[]);assert.ok(!JSON.stringify(detail).includes("password"));
  assert.equal((await call("/api/employee/orders?status=nouveau_statut")).status,400);
  assert.equal((await call("/api/employee/orders?clientId=1;DROP")).status,400);
  assert.equal((await call("/api/employee/orders?offset=-1")).status,400);
  assert.equal((await call("/api/employee/orders/999999999")).status,404);
});
test("acceptation : statut daté, acteur, historique et stock inchangé ; double clic sans nouvel événement",async()=>{
  const order=await createOrder(),before=await stock();
  const responses=await Promise.all([call(`/api/employee/orders/${order.id}/decision`,"POST",{status:"accepte"}),call(`/api/employee/orders/${order.id}/decision`,"POST",{status:"accepte"},adminCookie)]);
  assert.ok(responses.every(response=>response.status===200));
  const results=await Promise.all(responses.map(response=>response.json()));assert.deepEqual(results.map(r=>r.replayed).sort(),[false,true]);
  const result=results[0].order;assert.equal(result.status,"accepte");assert.ok(result.acceptedAt);assert.equal(result.history.length,2);
  assert.deepEqual(result.history.map(e=>e.status),["en_attente","accepte"]);assert.ok(result.history[1].actorId);assert.equal(await stock(),before);
  assert.equal((await call(`/api/orders/${order.id}/cancel`,"POST",{reason:"Test"},clientCookie)).status,409);
  assert.equal((await call(`/api/orders/${order.id}/quote`,"POST",input,clientCookie)).status,409);
});
test("refus : contact et motif obligatoires ; restitution unique même avec deux employés concurrents",async()=>{
  const order=await createOrder(),before=await stock();
  assert.equal((await call(`/api/employee/orders/${order.id}/decision`,"POST",{status:"refusee"})).status,400);
  assert.equal((await call(`/api/employee/orders/${order.id}/decision`,"POST",{...refuse(),contact:{method:"fax",at:new Date().toISOString()}})).status,400);
  const body=refuse();
  const responses=await Promise.all([call(`/api/employee/orders/${order.id}/decision`,"POST",body),call(`/api/employee/orders/${order.id}/decision`,"POST",body,adminCookie)]);
  assert.ok(responses.every(r=>r.status===200));const results=await Promise.all(responses.map(r=>r.json()));assert.deepEqual(results.map(r=>r.replayed).sort(),[false,true]);
  assert.equal(await stock(),before+1);
  const detail=await json(`/api/employee/orders/${order.id}`);assert.equal(detail.status,"refusee");assert.equal(detail.contacts.length,1);assert.equal(detail.contacts[0].method,"telephone");assert.equal(detail.contacts[0].action,"annulation");
  assert.deepEqual(detail.history.map(e=>e.status),["en_attente","refusee"]);assert.equal(detail.history[1].reason,body.reason);
  assert.equal((await call(`/api/employee/orders/${order.id}/decision`,"POST",{status:"accepte"})).status,409);
});
test("acceptation et refus concurrents : une seule décision gagne et stock cohérent",async()=>{
  const order=await createOrder(),before=await stock();
  const responses=await Promise.all([call(`/api/employee/orders/${order.id}/decision`,"POST",{status:"accepte"}),call(`/api/employee/orders/${order.id}/decision`,"POST",refuse(),adminCookie)]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
  const detail=await json(`/api/employee/orders/${order.id}`);assert.equal(detail.history.length,2);
  assert.equal(await stock(),before+(detail.status==="refusee"?1:0));assert.equal(detail.contacts.length,detail.status==="refusee"?1:0);
});
test("refus employé et annulation client concurrents : une seule restitution et un seul état terminal",async()=>{
  const order=await createOrder(),before=await stock();
  const responses=await Promise.all([call(`/api/employee/orders/${order.id}/decision`,"POST",refuse()),call(`/api/orders/${order.id}/cancel`,"POST",{reason:"Test fictif"},clientCookie)]);
  assert.equal(responses.filter(r=>r.status===409).length,1);assert.equal(responses.filter(r=>[200,204].includes(r.status)).length,1);
  const detail=await json(`/api/employee/orders/${order.id}`);assert.ok(["refusee","annulee"].includes(detail.status));assert.equal(detail.history.length,2);assert.equal(await stock(),before+1);
});
test("acceptation employé et annulation client concurrentes : pas d'annulation après acceptation",async()=>{
  const order=await createOrder(),before=await stock();
  const responses=await Promise.all([call(`/api/employee/orders/${order.id}/decision`,"POST",{status:"accepte"}),call(`/api/orders/${order.id}/cancel`,"POST",{reason:"Test fictif"},clientCookie)]);
  assert.equal(responses.filter(r=>r.status===409).length,1);
  const detail=await json(`/api/employee/orders/${order.id}`);assert.ok(["accepte","annulee"].includes(detail.status));assert.equal(detail.history.length,2);assert.equal(await stock(),before+(detail.status==="annulee"?1:0));
});
test("échec de mise à jour du statut : rollback du contact, du stock et de l'historique",async()=>{
  const order=await createOrder(),before=await stock();
  await db.exec("RESET ROLE; REVOKE UPDATE (accepted_at) ON vg.orders FROM vg_app; SET ROLE vg_app;");
  assert.equal((await call(`/api/employee/orders/${order.id}/decision`,"POST",refuse())).status,503);
  await db.exec("RESET ROLE; GRANT UPDATE (accepted_at) ON vg.orders TO vg_app; SET ROLE vg_app;");
  const detail=await json(`/api/employee/orders/${order.id}`);assert.equal(detail.status,"en_attente");assert.equal(detail.history.length,1);assert.equal(detail.contacts.length,0);assert.equal(await stock(),before);
});
test("transitions hors périmètre et requêtes CSRF refusées sans changement d'état",async()=>{
  const order=await createOrder(),before=await stock();
  for(const status of ["terminee","en_preparation","en_livraison","livre","attente_retour_materiel","annulee","administrateur"]){assert.equal((await call(`/api/employee/orders/${order.id}/decision`,"POST",{status})).status,400);}
  assert.equal((await call(`/api/employee/orders/${order.id}/decision`,"POST",{status:"accepte"},employeeCookie,{"X-Requested-With":""})).status,403);
  assert.equal((await call(`/api/employee/orders/${order.id}/decision`,"POST",{status:"accepte"},employeeCookie,{Origin:"https://evil.example.test"})).status,403);
  assert.equal(await stock(),before);assert.equal((await json(`/api/employee/orders/${order.id}`)).history.length,1);
});
test("rôle et activation relus en base : droits révoqués sur une session déjà ouverte",async()=>{
  await inspect("UPDATE vg.users SET role_code='utilisateur' WHERE id=$1",[employeeId]);
  assert.equal((await call("/api/employee/orders")).status,403);
  await inspect("UPDATE vg.users SET role_code='employe',is_active=false WHERE id=$1",[employeeId]);
  assert.equal((await call("/api/employee/orders")).status,401);
  const inactive=await call("/api/auth/login","POST",{email:"employe.stafftest@example.test",password},"");
  assert.equal(inactive.status,401);assert.deepEqual(await inactive.json(),{error:"Email ou mot de passe incorrect."});
  await inspect("UPDATE vg.users SET is_active=true WHERE id=$1",[employeeId]);
  assert.equal((await call("/api/employee/orders")).status,200);
});
test("privilèges ciblés : aucun droit sur les totaux, l'historique direct ou customer_* ; page et ressources accessibles",async()=>{
  const rights=(await db.query(`SELECT has_column_privilege(current_user,'vg.orders','accepted_at','UPDATE') accept,
    has_column_privilege(current_user,'vg.orders','customer_email','UPDATE') customer,
    has_table_privilege(current_user,'vg.order_status_history','INSERT') history,
    has_table_privilege(current_user,'vg.order_totals','UPDATE') totals`)).rows[0];
  assert.deepEqual(rights,{accept:true,customer:false,history:false,totals:false});
  for(const file of ["employe.html","employe.js","employe.css"]){const response=await fetch(base+"/"+file);assert.equal(response.status,200);}
});
test("contact refusé si date future/impossible, texte dangereux ou méthode non autorisée",()=>{
  const now=Date.now();
  for(const change of [{reason:"<script>"},{reason:"x".repeat(501)},{contact:{method:"email",at:new Date(now+60000).toISOString()}},{contact:{method:"email",at:"2026-02-30T10:00:00Z"}},{contact:{method:"fax",at:new Date(now).toISOString()}}])assert.throws(()=>validateDecision({...refuse(),...change},now));
});

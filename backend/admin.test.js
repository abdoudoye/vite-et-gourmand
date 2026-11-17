"use strict";
const {test,before,after}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {once}=require("node:events");
const argon2=require("argon2");
const {PGlite}=require("@electric-sql/pglite");
const {createApp}=require("./app");
const {readSessionConfig}=require("./auth-session");
const {validateMenu,validateEmployee}=require("./admin");
const {createWelcomeMailer}=require("./welcome-email");
let db,server,base,adminCookie,employeeCookie,clientCookie,adminId,clientId,employeeId,failNotification=false,beforeTransaction=null;
const password="ExempleFictif42!";
const input={firstName:"Employé",lastName:"Fictif",email:"nouvel.employe@example.test",phone:"0600000000",password,passwordConfirmation:password,isDemo:true};
const database={query:(...args)=>db.query(...args),transaction:async work=>{if(beforeTransaction)await beforeTransaction();return db.transaction(tx=>work({query:(sql,values)=>{
  if (failNotification && sql.startsWith("INSERT INTO vg.email_outbox")) throw new Error("Panne simulée en mémoire");
  return tx.query(sql,values);
}}));}};
let sent=0,mailFails=false;
const mailer={sendEmployeeCreated:async recipient=>{assert.match(recipient,/@example\.test$/);if(mailFails)throw new Error("Panne SMTP fictive");sent++;}};
async function inspect(sql,values=[]) {await db.exec("RESET ROLE");try{return await db.query(sql,values);}finally{await db.exec("SET ROLE vg_app");}}
async function call(route,method="GET",body,cookie=adminCookie,headers={}) {
  return fetch(base+route,{method,headers:{"Content-Type":"application/json","X-Requested-With":"ViteGourmand",...(cookie?{Cookie:cookie}:{}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
}
async function json(route,method="GET",body,expected=200,cookie=adminCookie) {const response=await call(route,method,body,cookie);const result=await response.json();assert.equal(response.status,expected,JSON.stringify(result));return result;}
async function login(email) {const response=await call("/api/auth/login","POST",{email,password},"");assert.equal(response.status,200);return response.headers.get("set-cookie").split(";")[0];}
before(async()=>{
  // Base WASM neuve, exclusivement en mémoire : aucun .env ni client pg chargé.
  db=new PGlite();await db.exec("CREATE ROLE vg_owner; CREATE ROLE vg_app LOGIN; ALTER DATABASE postgres OWNER TO vg_owner;");
  for(const file of ["001_schema.sql","002_demo_data.sql","003_app_privileges.sql","004_registration_privileges.sql","007_login_privileges.sql","009_order_checkout.sql","010_employee_privileges.sql","011_admin_privileges.sql"]) await db.exec(fs.readFileSync(path.join(__dirname,"../database",file),"utf8"));
  const hash=await argon2.hash(password,{type:argon2.argon2id});
  const ids={};for(const role of ["administrateur","employe","utilisateur"]) ids[role]=(await db.query("INSERT INTO vg.users(role_code,first_name,last_name,email,phone,password_hash,is_active,is_demo) VALUES($1,'Compte','Fictif',$2,'0600000000',$3,true,true) RETURNING id::text",[role,role+".admin.test@example.test",hash])).rows[0].id;
  adminId=ids.administrateur;employeeId=ids.employe;clientId=ids.utilisateur;
  // Les commandes de démonstration restent uniquement dans cette base isolée.
  await db.query("UPDATE vg.orders SET user_id=$1 WHERE reference='DEMO-001'",[clientId]);
  await db.exec("SET ROLE vg_app");
  server=createApp({database,mailer,sessionConfig:readSessionConfig({SESSION_SECRET:"secret-fictif-tests-administrateur-123456"})}).listen(0,"127.0.0.1");await once(server,"listening");base=`http://127.0.0.1:${server.address().port}`;
  adminCookie=await login("administrateur.admin.test@example.test");employeeCookie=await login("employe.admin.test@example.test");clientCookie=await login("utilisateur.admin.test@example.test");
});
after(async()=>{if(server)await new Promise(resolve=>server.close(resolve));if(db)await db.close();});

test("toutes les routes admin refusent anonymes, clients et employés",async()=>{
  const routes=[["/api/admin/dashboard"],["/api/admin/employees"],["/api/admin/employees","POST",input],[`/api/admin/employees/${employeeId}/deactivate`,"POST",{}],["/api/admin/menus"],["/api/admin/references"],["/api/admin/menus/1","POST",{}],["/api/admin/reviews"],["/api/admin/reviews/1/moderate","POST",{status:"valide"}]];
  for(const [route,method="GET",body] of routes) for(const [cookie,expected] of [["",401],[clientCookie,403],[employeeCookie,403]]) assert.equal((await call(route,method,body,cookie)).status,expected,route);
});
test("dashboard, listes, pagination et réutilisation des commandes sans secrets",async()=>{
  assert.equal((await json("/api/admin/dashboard")).statistics.available,false);
  for(const route of ["/api/admin/employees","/api/admin/menus","/api/admin/reviews","/api/employee/orders"]) {
    const response=await call(route);assert.equal(response.headers.get("cache-control"),"no-store");const rows=await response.json();assert.ok(Array.isArray(rows));assert.ok(!JSON.stringify(rows).includes("password"));
  }
  assert.deepEqual(await json("/api/admin/employees?offset=99999"),[]);
  for(const route of ["/api/admin/employees?offset=-1","/api/admin/menus?offset=NaN","/api/admin/reviews?status=invalide"]) await json(route,"GET",undefined,400);
  for(const file of ["administrateur.html","administrateur.js","administrateur.css"]) assert.equal((await fetch(base+"/"+file)).status,200);
});
test("création employé : rôle imposé, Argon2id, auteur, notification atomique et aucun secret en réponse",async()=>{
  const result=await json("/api/admin/employees","POST",input,201);assert.equal(result.notification,"sent");assert.equal(sent,1);
  assert.ok(!JSON.stringify(result).includes(password));assert.ok(!JSON.stringify(result).includes("password_hash"));
  const user=(await inspect("SELECT * FROM vg.users WHERE id=$1",[result.employee.id])).rows[0];
  assert.equal(user.role_code,"employe");assert.equal(user.is_active,true);assert.equal(String(user.created_by_user_id),adminId);assert.equal(user.is_demo,true);
  assert.match(user.password_hash,/^\$argon2id\$v=19\$m=65536,t=3,p=1\$/);assert.ok(await argon2.verify(user.password_hash,password));
  const outbox=(await inspect("SELECT kind,status FROM vg.email_outbox WHERE user_id=$1",[user.id])).rows;assert.deepEqual(outbox,[{kind:"nouvel_employe",status:"envoye"}]);
  await json("/api/admin/employees","POST",{...input,email:input.email.toUpperCase()},409);
  for(const extra of [{role_code:"administrateur"},{role:"administrateur"},{isActive:false}]) await json("/api/admin/employees","POST",{...input,email:"autre@example.test",...extra},400);
  assert.equal((await inspect("SELECT count(*)::int AS n FROM vg.users WHERE role_code='administrateur'")).rows[0].n,1);
});
test("création : validations, panne outbox rollback et panne SMTP conserve compte + notification en attente",async()=>{
  for(const change of [{password:"faible"},{passwordConfirmation:"Différent42!"},{email:"invalide"},{phone:"bonjour"},{firstName:"<script>"},{isDemo:"true"}]) await json("/api/admin/employees","POST",{...input,...change},400);
  failNotification=true;try{await json("/api/admin/employees","POST",{...input,email:"rollback@example.test"},503);}finally{failNotification=false;}
  assert.equal((await inspect("SELECT count(*)::int n FROM vg.users WHERE email='rollback@example.test'")).rows[0].n,0);
  mailFails=true;let created;try{created=await json("/api/admin/employees","POST",{...input,email:"smtp.panne@example.test"},201);}finally{mailFails=false;}
  assert.equal(created.notification,"pending");assert.equal((await inspect("SELECT status FROM vg.email_outbox WHERE user_id=$1",[created.employee.id])).rows[0].status,"en_attente");
});
test("notification SMTP : contenu sans mot de passe ni hachage",async()=>{
  let mail;const service=createWelcomeMailer({from:"test@example.test",transport:{}},{createTransport:()=>({sendMail:async value=>{mail=value;return{accepted:["test@example.test"],rejected:[]};}})});
  await service.sendEmployeeCreated("test@example.test");assert.match(mail.text,/canal distinct/);assert.ok(!JSON.stringify(mail).includes(password));assert.ok(!JSON.stringify(mail).includes("argon2"));
});
test("désactivation : idempotence, refus immédiat des sessions existantes, protection des autres rôles",async()=>{
  const created=await json("/api/admin/employees","POST",{...input,email:"depart@example.test"},201);
  const cookie=await login("depart@example.test");assert.equal((await call("/api/employee/orders","GET",undefined,cookie)).status,200);
  assert.equal((await json(`/api/admin/employees/${created.employee.id}/deactivate`,"POST",{})).replayed,false);
  const at=(await inspect("SELECT deactivated_at FROM vg.users WHERE id=$1",[created.employee.id])).rows[0].deactivated_at;
  assert.equal((await json(`/api/admin/employees/${created.employee.id}/deactivate`,"POST",{})).replayed,true);
  assert.deepEqual((await inspect("SELECT deactivated_at FROM vg.users WHERE id=$1",[created.employee.id])).rows[0].deactivated_at,at);
  assert.equal((await call("/api/employee/orders","GET",undefined,cookie)).status,401);
  assert.equal((await call("/api/auth/login","POST",{email:"depart@example.test",password},"")).status,401);
  for(const id of [adminId,clientId,"999999"]) await json(`/api/admin/employees/${id}/deactivate`,"POST",{},404);
  await json(`/api/admin/employees/${employeeId}/deactivate`,"POST",{role:"administrateur"},400);
});
const editable=menu=>Object.fromEntries(["title","description","themeId","dietId","minimumPeople","basePriceCents","stock","orderConditions","storageConditions","noticeHours","version"].map(key=>[key,menu[key]]));
test("menus : modification validée, conservation des commandes historiques et conflit si stock changé",async()=>{
  const original=(await json("/api/admin/menus"))[0];
  const snapshots=await inspect("SELECT to_jsonb(i) AS item FROM vg.order_items i ORDER BY id");
  const updated=await json(`/api/admin/menus/${original.id}`,"POST",{...editable(original),title:"Table fictive modifiée",stock:12,basePriceCents:19000});
  assert.equal(updated.stock,12);assert.equal(updated.title,"Table fictive modifiée");assert.notEqual(updated.version,original.version);
  assert.deepEqual((await inspect("SELECT to_jsonb(i) AS item FROM vg.order_items i ORDER BY id")).rows,snapshots.rows);
  await json(`/api/admin/menus/${original.id}`,"POST",editable(original),409);
  // Réservation concurrente simulée uniquement en mémoire.
  await db.query("UPDATE vg.menus SET stock_available=stock_available-1 WHERE id=$1",[original.id]);
  await json(`/api/admin/menus/${original.id}`,"POST",editable(updated),409);
  assert.equal((await json("/api/admin/menus"))[0].stock,11);
});
test("menus : types, bornes, XSS, références et champs interdits validés sans écriture",async()=>{
  const menu=(await json("/api/admin/menus"))[0],body=editable(menu);
  for(const change of [{stock:-1},{stock:1.5},{stock:"7"},{basePriceCents:2147483648},{minimumPeople:0},{noticeHours:null},{title:"<script>"},{description:""},{themeId:"1;DROP"},{dietId:"999999"},{version:""},{isDemo:false}]) await json(`/api/admin/menus/${menu.id}`,"POST",{...body,...change},400);
  assert.deepEqual((await json("/api/admin/menus"))[0],menu);
});
test("avis : commande terminée, propriétaire, note/commentaire, doublon et publication après validation uniquement",async()=>{
  const order=(await inspect("SELECT id::text FROM vg.orders WHERE reference='DEMO-001'")).rows[0];
  const body={rating:5,comment:"Exemple fictif pour la modération"};
  await json(`/api/orders/${order.id}/review`,"POST",body,401,"");
  await json(`/api/orders/${order.id}/review`,"POST",body,403,employeeCookie);
  await json(`/api/orders/${order.id}/review`,"POST",body,409,clientCookie);
  await inspect("UPDATE vg.orders SET status_code='terminee' WHERE id=$1",[order.id]);
  for(const change of [{rating:0},{rating:6},{rating:2.5},{rating:"5"},{comment:"<script>"},{comment:""},{moderation_status:"valide"}]) await json(`/api/orders/${order.id}/review`,"POST",{...body,...change},400,clientCookie);
  const other=(await inspect("SELECT id::text FROM vg.orders WHERE reference<>'DEMO-001' LIMIT 1")).rows[0];
  await json(`/api/orders/${other.id}/review`,"POST",body,404,clientCookie);
  await json(`/api/orders/${order.id}/review`,"POST",body,201,clientCookie);
  await json(`/api/orders/${order.id}/review`,"POST",body,409,clientCookie);
  const review=(await json("/api/admin/reviews")).find(row=>row.reference==="DEMO-001");assert.ok(review.isDemo);
  assert.ok(!(await json("/api/reviews")).some(row=>row.id===review.id));
  await json(`/api/admin/reviews/${review.id}/moderate`,"POST",{status:"en_attente"},400);
  assert.equal((await json(`/api/admin/reviews/${review.id}/moderate`,"POST",{status:"valide"})).replayed,false);
  assert.equal((await json(`/api/admin/reviews/${review.id}/moderate`,"POST",{status:"valide"})).replayed,true);
  await json(`/api/admin/reviews/${review.id}/moderate`,"POST",{status:"refuse"},409);
  const published=(await json("/api/reviews")).find(row=>row.id===review.id);assert.equal(published.comment,body.comment);assert.ok(published.isDemo);assert.ok(!("email" in published));
  const audit=(await inspect("SELECT moderated_by_user_id::text,moderated_at FROM vg.reviews WHERE id=$1",[review.id])).rows[0];assert.equal(audit.moderated_by_user_id,adminId);assert.ok(audit.moderated_at);
});
test("avis : refus invisible publiquement et blocage des avis historiques sur commandes non terminées",async()=>{
  const order=(await inspect("SELECT id::text FROM vg.orders WHERE reference<>'DEMO-001' LIMIT 1")).rows[0];
  await inspect("DELETE FROM vg.reviews WHERE order_id=$1",[order.id]);
  await inspect("UPDATE vg.orders SET status_code='en_attente' WHERE id=$1",[order.id]);
  const review=(await inspect("INSERT INTO vg.reviews(order_id,rating,comment,is_demo) VALUES($1,3,'Avis fictif historique',true) RETURNING id::text",[order.id])).rows[0];
  await json(`/api/admin/reviews/${review.id}/moderate`,"POST",{status:"valide"},409);
  await inspect("UPDATE vg.orders SET status_code='terminee' WHERE id=$1",[order.id]);
  await json(`/api/admin/reviews/${review.id}/moderate`,"POST",{status:"refuse"});
  assert.ok(!(await json("/api/reviews")).some(row=>row.id===review.id));
});
test("CSRF : mutations sans en-tête attendu ou depuis une origine externe bloquées",async()=>{
  for(const headers of [{"X-Requested-With":""},{Origin:"https://autre.example.test"}]) {
    assert.equal((await call("/api/admin/employees","POST",input,adminCookie,headers)).status,403);
    assert.equal((await call(`/api/admin/employees/${employeeId}/deactivate`,"POST",{},adminCookie,headers)).status,403);
    assert.equal((await call("/api/admin/menus/1","POST",{},adminCookie,headers)).status,403);
    assert.equal((await call("/api/admin/reviews/1/moderate","POST",{status:"valide"},adminCookie,headers)).status,403);
  }
});
test("administrateur désactivé ou rétrogradé : droits relus pour une session déjà ouverte",async()=>{
  await inspect("UPDATE vg.users SET is_active=false,deactivated_at=now() WHERE id=$1",[adminId]);
  await json("/api/admin/dashboard","GET",undefined,401);
  await inspect("UPDATE vg.users SET is_active=true,deactivated_at=null,role_code='employe' WHERE id=$1",[adminId]);
  await json("/api/admin/dashboard","GET",undefined,403);
  await inspect("UPDATE vg.users SET role_code='administrateur' WHERE id=$1",[adminId]);
  await json("/api/admin/dashboard");
});
test("une révocation entre le contrôle initial et la transaction bloque aussi l’écriture sensible",async()=>{
  beforeTransaction=async()=>{await inspect("UPDATE vg.users SET role_code='employe' WHERE id=$1",[adminId]);};
  try {await json(`/api/admin/employees/${employeeId}/deactivate`,"POST",{},403);}
  finally {beforeTransaction=null;await inspect("UPDATE vg.users SET role_code='administrateur' WHERE id=$1",[adminId]);}
  assert.equal((await inspect("SELECT is_active FROM vg.users WHERE id=$1",[employeeId])).rows[0].is_active,true);
});
test("validateurs : objets requis et aucun champ permettant de créer un administrateur",()=>{
  for(const value of [null,[],"x"]) {assert.throws(()=>validateEmployee(value));assert.throws(()=>validateMenu(value));}
});

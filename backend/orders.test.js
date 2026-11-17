"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const argon2 = require("argon2");
const { PGlite } = require("@electric-sql/pglite");
const { createApp } = require("./app");
const { readSessionConfig } = require("./auth-session");
const { addressKey, validateOrder } = require("./order-rules");
let db, server, base, firstCookie, secondCookie, firstUser, secondUser;
let clock = Date.now();
const password = "ExempleFictif42!";
const testMailer = {};
const input = { menuId: 1, people: 11, serviceDate: "2030-12-20", deliveryDate: "2030-12-20", deliveryTime: "10:00", street: "1 voie Fictive", additionalLine: "", postalCode: "33000", city: "Bordeaux", countryCode: "FR", conditionsAccepted: true };
const database = {
  query: (...args) => db.query(...args),
  transaction: (work) => db.transaction((tx) => work({ query: (...args) => tx.query(...args) }))
};
async function call(route, method = "GET", body, cookie = firstCookie) {
  return fetch(base + route, { method, headers: { "Content-Type": "application/json", "X-Requested-With": "ViteGourmand", ...(cookie ? { Cookie: cookie } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function json(route, method, body, expected = 200, cookie) {
  const response = await call(route, method, body, cookie);
  const data = await response.json(); assert.equal(response.status, expected, JSON.stringify(data)); return data;
}
const quote = (change = {}, cookie) => json("/api/orders/quote", "POST", { ...input, ...change }, 200, cookie);
const confirm = (q, key = randomUUID(), expected = 201, cookie) => json("/api/orders", "POST", { quoteId: q.quoteId, idempotencyKey: key }, expected, cookie);
const stock = async () => (await db.query("SELECT stock_available n FROM vg.menus WHERE id=1")).rows[0].n;
async function inspect(sql, values = []) {
  await db.exec("RESET ROLE;");
  try { return await db.query(sql, values); }
  finally { await db.exec("SET ROLE vg_app;"); }
}
before(async () => {
  db = new PGlite();
  await db.exec("CREATE ROLE vg_owner; CREATE ROLE vg_app LOGIN; ALTER DATABASE postgres OWNER TO vg_owner;");
  for (const name of ["001_schema.sql","002_demo_data.sql","003_app_privileges.sql","004_registration_privileges.sql","007_login_privileges.sql","009_order_checkout.sql"]) {
    await db.exec(fs.readFileSync(path.join(__dirname, "../database", name), "utf8"));
  }
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  for (const [email, setter] of [["commande.un@example.test", (id) => { firstUser = id; }],["commande.deux@example.test", (id) => { secondUser = id; }]]) {
    const result = await db.query("INSERT INTO vg.users(first_name,last_name,email,phone,password_hash,is_active) VALUES('Client','Fictif',$1,'0600000000',$2,true) RETURNING id::text", [email,hash]); setter(result.rows[0].id);
  }
  await db.query("INSERT INTO vg.addresses(user_id,street,postal_code,city,is_default) VALUES($1,'Adresse fictive','33000','Bordeaux',true)", [firstUser]);
  const address = validateOrder({ ...input, city: "Ville Fictive", postalCode: "99999" });
  await db.query(`INSERT INTO vg.delivery_distances(address_key,distance_km,source_reference,verified_by_user_id,expires_at)
    VALUES($1,12.345,'DISTANCE ET SOURCE FICTIVES - TEST MEMOIRE UNIQUEMENT',$2,'2031-01-01')`, [addressKey(address),firstUser]);
  await db.exec("SET ROLE vg_app;");
  server = createApp({ database, mailer: testMailer, now: () => clock, orderConfig: { pricing: "prorata", termsVersion: "DEMO-TEST-v1" }, sessionConfig: readSessionConfig({ SESSION_SECRET: "secret-fictif-tests-commandes-1234567890" }) }).listen(0, "127.0.0.1");
  await once(server, "listening"); base = `http://127.0.0.1:${server.address().port}`;
  for (const [email, setter] of [["commande.un@example.test", (cookie) => { firstCookie = cookie; }],["commande.deux@example.test", (cookie) => { secondCookie = cookie; }]]) {
    const response = await call("/api/auth/login", "POST", { email,password }, ""); assert.equal(response.status, 200); setter(response.headers.get("set-cookie").split(";")[0]);
  }
});
after(async () => { if (server) await new Promise((resolve) => server.close(resolve)); if (db) await db.close(); });

test("session obligatoire sur contexte, devis, confirmation, liste, détail et annulation", async () => {
  for (const [route, method, body] of [["/api/orders/checkout?menu=1","GET"],["/api/orders/quote","POST",input],["/api/orders","POST",{}],["/api/orders","GET"],["/api/orders/1","GET"],["/api/orders/1/cancel","POST",{ reason: "Test" }]]) {
    assert.equal((await call(route,method,body,"")).status, 401, route);
  }
});
test("contexte prérempli depuis le compte, sans mot de passe, et devis détaillé sans réservation", async () => {
  const context = await json("/api/orders/checkout?menu=1");
  assert.equal(context.customer.email, "commande.un@example.test"); assert.equal(context.address.street, "Adresse fictive");
  assert.ok(!JSON.stringify(context).includes("password"));
  const before = await stock(); const q = await quote();
  assert.equal(q.grossCents,33000); assert.equal(q.discountCents,3300); assert.equal(q.totalCents,29700);
  assert.equal(await stock(),before);
});
test("commande atomique : stock décrémenté, total SQL cohérent, statut initial daté et email en attente", async () => {
  const before = await stock(); const result = await confirm(await quote());
  assert.equal(result.order.status,"en_attente"); assert.equal(result.order.totalCents,29700);
  assert.equal(result.order.history[0].status,"en_attente"); assert.ok(result.order.history[0].date);
  assert.equal(await stock(),before-1);
  const event = (await inspect("SELECT status,sent_at FROM vg.email_outbox WHERE order_id=$1", [result.order.id])).rows;
  assert.deepEqual(event.map((row) => row.status),["en_attente"]); assert.equal(event[0].sent_at,null);
  assert.equal((await json(`/api/orders/${result.order.id}`)).totalCents,result.order.totalCents);
});
test("double clic et nouvelle tentative réseau : une seule commande, une seule réservation et un email", async () => {
  const q = await quote(); const key = randomUUID(); const before = await stock();
  const responses = await Promise.all([call("/api/orders","POST",{ quoteId:q.quoteId,idempotencyKey:key }),call("/api/orders","POST",{ quoteId:q.quoteId,idempotencyKey:key })]);
  assert.deepEqual(responses.map((r) => r.status).sort(),[200,201]);
  const results = await Promise.all(responses.map((r) => r.json())); assert.equal(results[0].order.id,results[1].order.id);
  assert.equal(await stock(),before-1);
  const replay = await confirm(q,key,200); assert.equal(replay.order.id,results[0].order.id);
  const rejected = await json("/api/orders","POST",{quoteId:q.quoteId,idempotencyKey:randomUUID()},409);
  assert.equal(rejected.error,"Ce devis a déjà été confirmé avec une autre clé d’idempotence.");
  const count = (await inspect("SELECT count(*)::int n FROM vg.email_outbox WHERE order_id=$1", [replay.order.id])).rows[0].n; assert.equal(count,1);
  const other = await quote(); assert.equal((await call("/api/orders","POST",{ quoteId:other.quoteId,idempotencyKey:key })).status,409);
  const uppercase = await confirm({ quoteId:q.quoteId.toUpperCase() },key.toUpperCase(),200);
  assert.equal(uppercase.order.id,replay.order.id);
  assert.equal(await stock(),before-1);
  assert.equal((await db.query("SELECT count(*)::int n FROM vg.order_receipts WHERE quote_id=$1",[q.quoteId])).rows[0].n,1);
  assert.equal((await db.query("SELECT count(*)::int n FROM vg.order_status_history WHERE order_id=$1",[replay.order.id])).rows[0].n,1);
});

test("devis concurrent avec deux clés différentes : un seul gagnant et un refus explicite sans effet supplémentaire", async () => {
  const q=await quote();const before=await stock();
  const firstKey=randomUUID(),secondKey=randomUUID();
  const responses=await Promise.all([call("/api/orders","POST",{quoteId:q.quoteId,idempotencyKey:firstKey}),call("/api/orders","POST",{quoteId:q.quoteId,idempotencyKey:secondKey})]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[201,409]);
  const results=await Promise.all(responses.map(r=>r.json()));
  const winner=responses.findIndex(r=>r.status===201);const loser=1-winner;
  assert.equal(results[loser].error,"Ce devis a déjà été confirmé avec une autre clé d’idempotence.");
  assert.equal(await stock(),before-1);
  const receipts=(await db.query("SELECT idempotency_key::text,order_id::text FROM vg.order_receipts WHERE quote_id=$1",[q.quoteId])).rows;
  assert.equal(receipts.length,1);assert.equal(receipts[0].idempotency_key,winner===0?firstKey:secondKey);
  const replay=await confirm(q,receipts[0].idempotency_key,200);assert.equal(replay.order.id,results[winner].order.id);
  assert.equal((await inspect("SELECT count(*)::int n FROM vg.email_outbox WHERE order_id=$1",[replay.order.id])).rows[0].n,1);
});

test("clé concurrente avec deux devis différents : une création puis refus ; nouvelle paire autorisée", async () => {
  const a=await quote();const b=await quote();const key=randomUUID();const before=await stock();
  const responses=await Promise.all([call("/api/orders","POST",{quoteId:a.quoteId,idempotencyKey:key}),call("/api/orders","POST",{quoteId:b.quoteId,idempotencyKey:key})]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[201,409]);
  const results=await Promise.all(responses.map(r=>r.json()));const loser=responses.findIndex(r=>r.status===409);
  assert.equal(results[loser].error,"Cette clé a déjà été utilisée pour une autre confirmation.");
  assert.equal(await stock(),before-1);
  const receipts=(await db.query("SELECT quote_id::text FROM vg.order_receipts WHERE user_id=$1 AND idempotency_key=$2",[firstUser,key])).rows;
  assert.equal(receipts.length,1);
  const unused=loser===0?a:b;
  const next=await confirm(unused,randomUUID());assert.equal(next.replayed,false);
  assert.equal(await stock(),before-2);
  assert.notEqual(next.order.id,results[1-loser].order.id);
});

test("009 n'accorde aucun UPDATE customer_* et conserve les droits requis par commandes et historique", async () => {
  for(const column of ["customer_first_name","customer_last_name","customer_email","customer_phone"]){
    const result=await db.query("SELECT has_column_privilege(current_user,'vg.orders',$1,'UPDATE') allowed",[column]);
    assert.equal(result.rows[0].allowed,false,column);
  }
  const rights=(await db.query(`SELECT has_column_privilege(current_user,'vg.orders','status_code','UPDATE') status,
    has_column_privilege(current_user,'vg.orders','delivery_street','UPDATE') delivery,
    has_column_privilege(current_user,'vg.menus','stock_available','UPDATE') stock,
    has_table_privilege(current_user,'vg.order_status_history','INSERT') history_write,
    has_table_privilege(current_user,'vg.order_totals','UPDATE') total_write`)).rows[0];
  assert.deepEqual(rights,{status:true,delivery:true,stock:true,history_write:false,total_write:false});
});
test("droits : devis, commandes et modifications d'un autre client ne sont pas accessibles", async () => {
  const q = await quote(); const made = await confirm(q);
  assert.equal((await call("/api/orders","POST",{ quoteId:(await quote()).quoteId,idempotencyKey:randomUUID() },secondCookie)).status,404);
  for (const [route,method,body] of [[`/api/orders/${made.order.id}`,"GET"],[`/api/orders/${made.order.id}/cancel`,"POST",{ reason:"Test" }],[`/api/orders/${made.order.id}/quote`,"POST",input],[`/api/orders/checkout?menu=1&order=${made.order.id}`,"GET"]]) {
    assert.equal((await call(route,method,body,secondCookie)).status,404,route);
  }
  assert.deepEqual(await json("/api/orders","GET",undefined,200,secondCookie),[]);
});
test("hors Bordeaux : absence de distance refusée ; seule la distance du serveur est facturée", async () => {
  assert.equal((await call("/api/orders/quote","POST",{ ...input,city:"Autre ville",distanceKm:0 })).status,422);
  const q = await quote({ city:"Ville Fictive",postalCode:"99999",distanceKm:0,totalCents:1 });
  assert.equal(q.deliveryCents,1228); assert.equal(q.totalCents,30928);
  const result = await confirm(q); assert.equal(result.order.totalCents,30928);
});
test("devis expiré, prix changé et conditions non acceptées refusés sans réserver de stock", async () => {
  const before = await stock(); const q = await quote(); const originalClock = clock; clock += 16 * 60000;
  assert.equal((await call("/api/orders","POST",{quoteId:q.quoteId,idempotencyKey:randomUUID()})).status,409); clock = originalClock;
  const next = await quote();
  await db.exec("RESET ROLE;"); await db.query("UPDATE vg.menus SET base_price_cents=18001 WHERE id=1"); await db.exec("SET ROLE vg_app;");
  assert.equal((await call("/api/orders","POST",{quoteId:next.quoteId,idempotencyKey:randomUUID()})).status,409);
  await db.exec("RESET ROLE;"); await db.query("UPDATE vg.menus SET base_price_cents=18000 WHERE id=1"); await db.exec("SET ROLE vg_app;");
  assert.equal((await call("/api/orders/quote","POST",{...input,conditionsAccepted:false})).status,400);
  assert.equal(await stock(),before);
});
test("dernier stock : deux devis concurrents ne peuvent créer qu'une commande", async () => {
  await db.query("UPDATE vg.menus SET stock_available=1 WHERE id=1");
  const [a,b] = await Promise.all([quote(),quote({},secondCookie)]);
  const responses = await Promise.all([call("/api/orders","POST",{quoteId:a.quoteId,idempotencyKey:randomUUID()}),call("/api/orders","POST",{quoteId:b.quoteId,idempotencyKey:randomUUID()},secondCookie)]);
  assert.deepEqual(responses.map((r) => r.status).sort(),[201,409]); assert.equal(await stock(),0);
  assert.equal((await call("/api/orders/quote","POST",input)).status,409);
  await db.query("UPDATE vg.menus SET stock_available=5 WHERE id=1");
});
test("échec d'email_outbox : commande, ligne, historique, réservation et reçu sont tous annulés", async () => {
  const q = await quote(); const before = await stock();
  const countBefore = (await db.query("SELECT count(*)::int n FROM vg.orders")).rows[0].n;
  await db.exec("RESET ROLE; REVOKE INSERT ON vg.email_outbox FROM vg_app; REVOKE INSERT (user_id,kind,recipient,order_id) ON vg.email_outbox FROM vg_app; SET ROLE vg_app;");
  assert.equal((await call("/api/orders","POST",{quoteId:q.quoteId,idempotencyKey:randomUUID()})).status,503);
  assert.equal(await stock(),before); assert.equal((await db.query("SELECT count(*)::int n FROM vg.orders")).rows[0].n,countBefore);
  assert.equal((await db.query("SELECT count(*)::int n FROM vg.order_receipts WHERE quote_id=$1", [q.quoteId])).rows[0].n,0);
  await db.exec("RESET ROLE; GRANT INSERT (user_id,kind,recipient,order_id) ON vg.email_outbox TO vg_app; SET ROLE vg_app;");
});
test("modification avant acceptation : menu immuable, nouveau total, réservation inchangée ; annulation libère une seule fois", async () => {
  const made = await confirm(await quote()); const id = made.order.id; const before = await stock();
  assert.equal((await call(`/api/orders/${id}/quote`,"POST",{...input,menuId:2})).status,409);
  const q = await json(`/api/orders/${id}/quote`,"POST",{...input,people:6});
  const stale = await json(`/api/orders/${id}/quote`,"POST",{...input,people:10});
  const result = await confirm(q); assert.equal(result.order.id,id); assert.equal(result.order.people,6); assert.equal(result.order.totalCents,18000);
  assert.equal((await call("/api/orders","POST",{quoteId:stale.quoteId,idempotencyKey:randomUUID()})).status,409);
  assert.equal(await stock(),before);
  for (let i=0;i<2;i++) assert.equal((await call(`/api/orders/${id}/cancel`,"POST",{ reason:"Motif fictif de test" })).status,204);
  assert.equal(await stock(),before+1);
  const order = await json(`/api/orders/${id}`); assert.equal(order.status,"annulee"); assert.equal(order.history.at(-1).status,"annulee");
});

test("pagination et erreurs de formulaire : paramètres validés sans SQL arbitraire", async () => {
  assert.deepEqual(await json("/api/orders?offset=50"),[]);
  assert.equal((await call("/api/orders?offset=-1")).status,400);
  assert.equal((await call("/api/orders?offset=0;DROP")).status,400);
  assert.equal((await call("/api/orders/checkout?menu=1&menu=2")).status,400);
  assert.equal((await call("/api/orders/quote","POST",{...input,people:5})).status,400);
  assert.equal((await call("/api/orders/quote","POST",{...input,deliveryDate:"2000-01-01",serviceDate:"2000-01-01"})).status,400);
});
test("après acceptation, modification et annulation refusées ; client désactivé et CSRF refusés", async () => {
  const made = await confirm(await quote());
  await db.exec("RESET ROLE;"); await db.query("UPDATE vg.orders SET status_code='accepte',change_reason='TEST FICTIF' WHERE id=$1", [made.order.id]); await db.exec("SET ROLE vg_app;");
  assert.equal((await call(`/api/orders/${made.order.id}/quote`,"POST",input)).status,409);
  assert.equal((await call(`/api/orders/${made.order.id}/cancel`,"POST",{reason:"Test"})).status,409);
  const csrf = await fetch(base+"/api/orders/quote", { method:"POST",headers:{"Content-Type":"application/json",Cookie:firstCookie},body:JSON.stringify(input) }); assert.equal(csrf.status,403);
  await db.exec("RESET ROLE;"); await db.query("UPDATE vg.users SET is_active=false WHERE id=$1", [secondUser]); await db.exec("SET ROLE vg_app;");
  assert.equal((await call("/api/orders","GET",undefined,secondCookie)).status,401);
});

test("confirmation email : transport simulé après commit, aucun doublon sur rejeu ; panne sans perte de commande", async () => {
  let sent=0;
  testMailer.sendOrderConfirmation=async (recipient,order)=>{
    assert.equal(recipient,"commande.un@example.test");
    assert.equal((await db.query("SELECT id FROM vg.orders WHERE id=$1",[order.id])).rows.length,1);
    sent++;
  };
  const q=await quote();const key=randomUUID();const made=await confirm(q,key);assert.equal(made.confirmationEmail,"sent");
  await confirm(q,key,200);assert.equal(sent,1);
  testMailer.sendOrderConfirmation=async()=>{throw new Error("SMTP FICTIF EN PANNE");};
  const pending=await confirm(await quote());assert.equal(pending.confirmationEmail,"pending");
  assert.equal((await inspect("SELECT status FROM vg.email_outbox WHERE order_id=$1",[pending.order.id])).rows[0].status,"en_attente");
  delete testMailer.sendOrderConfirmation;
});

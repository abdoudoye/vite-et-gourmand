const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { PGlite } = require("@electric-sql/pglite");
const fs = require("node:fs");
const path = require("node:path");
const { getMenus } = require("./menus-repository.js");
const { isValidMenu } = require("../frontend/menu-details.js");
const { filterMenus } = require("../frontend/menu-filters.js");
const { ACCOUNT_CHECK_SQL } = require("./database.js");
let db;
const script = (name) => fs.readFileSync(path.join(__dirname, "../database", name), "utf8");
const query = (sql, params = []) => db.query(sql, params);

async function createDatabase() {
  const instance = new PGlite(); // PostgreSQL WASM en mémoire : aucun réseau, aucun mot de passe.
  await instance.exec("CREATE ROLE vg_owner; CREATE ROLE vg_app LOGIN; ALTER DATABASE postgres OWNER TO vg_owner;");
  await instance.exec(script("001_schema.sql"));
  await instance.exec(script("002_demo_data.sql"));
  await instance.exec(script("003_app_privileges.sql"));
  return instance;
}
before(async () => { db = await createDatabase(); });
after(async () => { if (db) await db.close(); });

test("la requête SQL de l'API restitue le contrat du catalogue sans doublon ni régression des filtres", async () => {
  const menus = await getMenus({ query });
  assert.equal(menus.length, 6);
  assert.equal(new Set(menus.map((menu) => menu.id)).size, 6);
  for (const menu of menus) {
    assert.equal(isValidMenu(menu), true, menu.title);
    assert.equal(menu.images.length, 3);
    assert.equal(menu.isDemo, true);
    assert.ok(menu.conditions.order.length > 1);
    assert.ok(!Object.keys(menu).some((key) => /password|email|user/i.test(key)));
  }
  assert.deepEqual(menus[0].dishes.starters, [{ name: "Salade de tomates au basilic", allergens: [] }]);
  assert.deepEqual(menus[0].dishes.mains, [{ name: "Gratin de légumes et feta", allergens: ["Lait"] }]);
  const filters = { maxPrice: 200, priceFrom: 150, priceTo: 190, theme: "Nature", diet: "Végétarien", people: 6 };
  assert.deepEqual(filterMenus(menus, filters).map((menu) => menu.id), [6]);
  await query("UPDATE vg.menus SET archived_at=now() WHERE id=1");
  assert.equal((await getMenus({ query })).length, 5);
  await query("UPDATE vg.menus SET archived_at=NULL,is_demo=false WHERE id=1");
  assert.equal((await getMenus({ query })).length, 5);
  await query("UPDATE vg.menus SET is_demo=true WHERE id=1");
});

test("les scripts créent six menus, leurs galeries, des plats partagés et des comptes inactifs", async () => {
  assert.equal((await query("SELECT count(*)::int AS n FROM vg.menus WHERE is_demo")).rows[0].n, 6);
  assert.equal((await query("SELECT count(*)::int AS n FROM vg.menu_images")).rows[0].n, 18);
  assert.ok((await query("SELECT dish_id FROM vg.menu_dishes GROUP BY dish_id HAVING count(*) > 1")).rows.length);
  assert.equal((await query("SELECT count(*)::int AS n FROM vg.users WHERE is_active OR password_hash IS NOT NULL")).rows[0].n, 0);
});
test("intégrité référentielle, unicité email insensible à la casse et stock non négatif", async () => {
  await assert.rejects(query("UPDATE vg.menus SET stock_available=-1 WHERE id=1"), /check constraint/);
  await assert.rejects(query("INSERT INTO vg.menu_dishes(menu_id,dish_id) VALUES(99999,1)"), /foreign key/);
  await assert.rejects(query("UPDATE vg.users SET email='CLIENT.DEMO@EXAMPLE.TEST' WHERE role_code='employe'"), /unique constraint/);
  await assert.rejects(query("UPDATE vg.users SET is_active=true WHERE role_code='utilisateur'"), /check constraint/);
});
test("minimum et remise de 10 % à partir de cinq personnes supplémentaires", async () => {
  await assert.rejects(query("UPDATE vg.order_items SET people_count=1 WHERE order_id=1"), /check constraint/);
  await assert.rejects(query("UPDATE vg.order_items SET people_count=11,discount_percent=0 WHERE order_id=1"), /check constraint/);
  await query("UPDATE vg.order_items SET people_count=11,gross_amount_cents=30000,discount_percent=10,discount_cents=3000,pricing_policy='HYPOTHESE DE TEST UNIQUEMENT' WHERE order_id=1");
  assert.equal((await query("SELECT total_cents FROM vg.order_totals WHERE order_id=1")).rows[0].total_cents, 27000);
  await query("UPDATE vg.order_items SET people_count=6,gross_amount_cents=18000,discount_percent=0,discount_cents=0 WHERE order_id=1");
});
test("le menu historique reste immuable et les statuts sont historisés automatiquement", async () => {
  await assert.rejects(query("UPDATE vg.order_items SET menu_id=2 WHERE order_id=1"), /ne peuvent pas/);
  const beforeCount = (await query("SELECT count(*)::int AS n FROM vg.order_status_history WHERE order_id=1")).rows[0].n;
  await query("UPDATE vg.orders SET status_code='accepte',change_reason='Test du suivi',accepted_at=now() WHERE id=1");
  const history = (await query("SELECT * FROM vg.order_status_history WHERE order_id=1 ORDER BY id")).rows;
  assert.equal(history.length, beforeCount + 1);
  assert.equal(history.at(-1).status_code, "accepte");
  assert.ok(history.at(-1).changed_at);
  await query("UPDATE vg.orders SET change_reason='Sans changement de statut' WHERE id=1");
  assert.equal((await query("SELECT count(*)::int AS n FROM vg.order_status_history WHERE order_id=1")).rows[0].n, history.length);
});
test("la livraison hors Bordeaux exige une distance sourcée et le montant réglementé", async () => {
  await assert.rejects(query("UPDATE vg.orders SET delivery_in_bordeaux=false WHERE id=1"), /check constraint/);
  await query("UPDATE vg.orders SET delivery_in_bordeaux=false,distance_km=10,distance_source='DISTANCE FICTIVE DE TEST',delivery_fee_cents=1090 WHERE id=1");
  await assert.rejects(query("UPDATE vg.orders SET delivery_fee_cents=1000 WHERE id=1"), /check constraint/);
  await query("UPDATE vg.orders SET delivery_in_bordeaux=true,distance_km=NULL,distance_source=NULL,delivery_fee_cents=0 WHERE id=1");
});
test("le compte applicatif ne possède ni schéma, ni rôle propriétaire, ni droits sur l'historique", async () => {
  // Instance séparée : on abandonne définitivement les droits du propriétaire.
  const appDb = await createDatabase();
  const query = (sql, values = []) => appDb.query(sql, values);
  await appDb.exec("SET SESSION AUTHORIZATION vg_app;");
  try {
    const account = (await query(ACCOUNT_CHECK_SQL)).rows[0];
    assert.equal(account.username, "vg_app");
    for (const [key, value] of Object.entries(account)) {
      if (key !== "username") assert.equal(value, false, key);
    }
    assert.equal((await getMenus({ query })).length, 6);
    assert.equal((await query("SELECT count(*)::int AS n FROM vg.menus")).rows[0].n, 6);
    await assert.rejects(query("CREATE TABLE vg.interdit(id integer)"), /permission denied/);
    await assert.rejects(query("SET ROLE vg_owner"), /permission denied/);
    await assert.rejects(query("UPDATE vg.order_status_history SET reason='Interdit'"), /permission denied/);
    await assert.rejects(query("DELETE FROM vg.orders WHERE id=1"), /permission denied/);
    await query("UPDATE vg.orders SET status_code='en_preparation',change_reason='Test via application' WHERE id=1");
    assert.equal((await query("SELECT status_code FROM vg.order_status_history WHERE order_id=1 ORDER BY id DESC LIMIT 1")).rows[0].status_code, "en_preparation");
  } finally { await appDb.close(); }
});

test("une commande conserve sa ligne et le prix du minimum ne peut pas être falsifié", async () => {
  await assert.rejects(query("DELETE FROM vg.order_items WHERE order_id=1"), /exactement une ligne/);
  await assert.rejects(query("UPDATE vg.order_items SET gross_amount_cents=1 WHERE order_id=1"), /check constraint/);
  assert.equal((await query("SELECT count(*)::int AS n FROM vg.order_items WHERE order_id=1")).rows[0].n, 1);
});
test("l'historique des prix résiste aux modifications du catalogue et de sa date de statut", async () => {
  const before = (await query("SELECT base_price_cents_snapshot FROM vg.order_items WHERE order_id=1")).rows[0].base_price_cents_snapshot;
  await query("UPDATE vg.menus SET base_price_cents=19000 WHERE id=1");
  assert.equal((await query("SELECT base_price_cents_snapshot FROM vg.order_items WHERE order_id=1")).rows[0].base_price_cents_snapshot, before);
  await query("UPDATE vg.menus SET base_price_cents=18000 WHERE id=1");
  const date = (await query("SELECT status_changed_at FROM vg.orders WHERE id=1")).rows[0].status_changed_at;
  await query("UPDATE vg.orders SET status_changed_at='2000-01-01' WHERE id=1");
  assert.deepEqual((await query("SELECT status_changed_at FROM vg.orders WHERE id=1")).rows[0].status_changed_at, date);
});
test("les jetons expirables, avis et conditions de retour ont des contraintes", async () => {
  await assert.rejects(query("INSERT INTO vg.password_reset_tokens(user_id,token_digest,expires_at) VALUES(1,'jeton-brut',now())"), /check constraint/);
  await assert.rejects(query("INSERT INTO vg.password_reset_tokens(user_id,token_digest,expires_at) VALUES(1,$1,now()-interval '1 day')", ["a".repeat(64)]), /check constraint/);
  await assert.rejects(query("INSERT INTO vg.reviews(order_id,rating,comment) VALUES(1,6,'Exemple fictif')"), /check constraint/);
  await assert.rejects(query("UPDATE vg.orders SET status_code='attente_retour_materiel' WHERE id=1"), /check constraint/);
  await assert.rejects(query("UPDATE vg.orders SET status_code='annulee' WHERE id=1"), /check constraint/);
});

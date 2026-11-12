const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { once } = require("node:events");
const { PGlite } = require("@electric-sql/pglite");
const { createApp } = require("./app.js");
const { MENUS_SQL } = require("./menus-repository.js");
const root = path.join(__dirname, "..");
const menus = require("../frontend/data/menus.json");
const plan = require("../database/repairs/catalogue-utf8-plan.json").changes;
const suspect = /\ufffd|\u00c3[\u0080-\u00bf]|\u00c2[\u0080-\u00bf]|\u00e2\u20ac|\u00c5[\u2018\u2019]/;

function filesIn(folder) {
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    if (["node_modules", "repairs"].includes(entry.name)) return [];
    const file = path.join(folder, entry.name);
    return entry.isDirectory() ? filesIn(file) : [file];
  });
}

test("les sources et SQL sont du UTF-8 valide, sans remplacement ni mojibake", () => {
  const files = ["frontend", "backend", "database"].flatMap((folder) => filesIn(path.join(root, folder)));
  files.push(path.join(root, "README.md"));
  for (const file of files.filter((file) => /\.(html|css|js|svg|json|sql|md)$/.test(file))) {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(fs.readFileSync(file));
    assert.ok(!suspect.test(text), path.relative(root, file));
    if (file.endsWith(".html")) assert.match(text, /<meta\s+charset=["']utf-8["']\s*\/?\s*>/i);
  }
  assert.equal(menus[5].title, "Le Déjeuner champêtre");
  assert.ok(menus.some((menu) => menu.diet === "Végétarien"));
  assert.ok(menus.flatMap((menu) => Object.values(menu.dishes).flat()).some((dish) => dish.allergens.includes("Œufs")));
});

test("Express transporte les caractères français en UTF-8 sans les convertir", async () => {
  const database = { query: async (sql) => ({ rows: sql === MENUS_SQL ? menus : [{ ok: 1 }] }) };
  const server = createApp({ database }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const url of ["/menus.html", "/commande.html", "/menus.css", "/menus.js", "/menu-details.js", "/commande.js", "/api/menus"]) {
      const response = await fetch(base + url);
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type"), /charset=utf-8/i);
      const text = new TextDecoder("utf-8", { fatal: true }).decode(await response.arrayBuffer());
      assert.ok(!suspect.test(text), url);
      if (url === "/api/menus") {
        const data = JSON.parse(text);
        assert.equal(data[5].title, "Le Déjeuner champêtre");
        assert.equal(data[0].diet, "Végétarien");
        assert.ok(text.includes("Œufs"));
        assert.ok(text.includes("réfrigérateur après réception"));
        assert.ok(text.includes("Entrée — visuel"));
        assert.ok(text.includes("d’une"));
      } else {
        assert.equal(text, fs.readFileSync(path.join(root, "frontend", url.slice(1)), "utf8"));
      }
    }
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

test("le plan ne contient que des conversions certaines des textes publics", () => {
  assert.equal(plan.length, 78);
  const decoder = new TextDecoder("windows-1252");
  for (const entry of plan) {
    assert.notEqual(entry.before, entry.after);
    assert.equal(entry.before, decoder.decode(Buffer.from(entry.after, "utf8")));
    assert.ok(!suspect.test(entry.after));
    assert.ok(!["orders", "order_items", "users", "addresses", "order_status_history"].includes(entry.table));
    assert.ok(!/price|stock|people|password|phone|email/.test(entry.column));
  }
  for (const name of ["010_catalogue_utf8_apply.sql", "011_catalogue_utf8_undo.sql"]) {
    const sql = fs.readFileSync(path.join(root, "database/repairs", name), "utf8");
    assert.ok(/^[\x00-\x7f]*$/.test(sql), "Les scripts utilisent des échappements Unicode ASCII.");
  }
});

test("la réparation ciblée est atomique, réversible et préserve les données métier", async (t) => {
  const db = new PGlite(); // Exclusivement en mémoire, aucune connexion à PostgreSQL installé.
  const read = (name) => fs.readFileSync(path.join(root, "database", name), "utf8");
  const run = async (sql) => {
    try { await db.exec(sql); }
    catch (error) { await db.exec("ROLLBACK;"); throw error; }
  };
  const apply = read("repairs/010_catalogue_utf8_apply.sql");
  const undo = read("repairs/011_catalogue_utf8_undo.sql");
  const snapshot = async () => {
    const tables = (await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='vg' AND table_type='BASE TABLE' ORDER BY table_name")).rows;
    const result = {};
    for (const { table_name } of tables) result[table_name] = (await db.query(`SELECT to_jsonb(t) AS value FROM vg.${table_name} t ORDER BY to_jsonb(t)::text`)).rows;
    return result;
  };
  try {
    await db.exec("CREATE ROLE vg_owner; ALTER DATABASE postgres OWNER TO vg_owner;");
    await db.exec(read("001_schema.sql"));
    // Git peut convertir le fichier en CRLF sous Windows : les textes multilignes
    // du jeu de test doivent conserver les LF du plan JSON, indépendamment du checkout.
    await db.exec(read("002_demo_data.sql").replace(/\r\n/g, "\n"));
    const correct = await snapshot();
    await t.test("une base déjà correcte n'est pas réécrite", async () => {
      await assert.rejects(run(apply), /Unexpected value or scope/);
      assert.deepEqual(await snapshot(), correct);
    });
    // Reproduire uniquement dans le moteur de test les valeurs observées en lecture.
    for (const entry of plan) {
      const key = ["roles", "order_statuses"].includes(entry.table) ? "code" : "id";
      const result = await db.query(`UPDATE vg.${entry.table} SET ${entry.column}=$1 WHERE ${key}::text=$2 AND ${entry.column}=$3`, [entry.before, entry.id, entry.after]);
      assert.equal(result.affectedRows, 1);
    }
    const corrupted = await snapshot();
    await t.test("les 78 corrections restaurent les textes sans changer le reste", async () => {
      await run(apply);
      assert.deepEqual(await snapshot(), correct);
      await assert.rejects(run(apply), /Unexpected value or scope/);
      assert.deepEqual(await snapshot(), correct);
    });
    await t.test("le retour arrière restitue exactement les valeurs initiales", async () => {
      await run(undo);
      assert.deepEqual(await snapshot(), corrupted);
    });
    await t.test("un menu devenu non fictif empêche la réparation de ses données partagées", async () => {
      await db.query("UPDATE vg.menus SET is_demo=false WHERE id=1");
      const changed = await snapshot();
      await assert.rejects(run(apply), /Unexpected value or scope/);
      assert.deepEqual(await snapshot(), changed);
      await db.query("UPDATE vg.menus SET is_demo=true WHERE id=1");
    });
    await t.test("une modification intervenue entretemps annule toute la réparation", async () => {
      const entry = plan.find((item) => item.table === "themes");
      await db.query("UPDATE vg.themes SET name=$1 WHERE id::text=$2", ["Texte volontairement modifié", entry.id]);
      const changed = await snapshot();
      await assert.rejects(run(apply), /Unexpected value or scope/);
      assert.deepEqual(await snapshot(), changed);
    });
  } finally { await db.close(); }
});

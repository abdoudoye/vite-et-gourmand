const { test } = require("node:test");
const assert = require("node:assert/strict");
const { once, EventEmitter } = require("node:events");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { createApp } = require("./app.js");
const { createDatabase, ACCOUNT_CHECK_SQL } = require("./database.js");
const { MENUS_SQL } = require("./menus-repository.js");
const menus = require("../frontend/data/menus.json");

async function withServer(database, work) {
  const server = createApp({ database }).listen(0, "127.0.0.1");
  await once(server, "listening");
  try { await work(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

async function verifyCatalogueFiles(base) {
  const response = await fetch(`${base}/menus.html`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /^text\/html/);
  const html = await response.text();
  assert.equal(html, fs.readFileSync(path.join(__dirname, "../frontend/menus.html"), "utf8"));
  // Vérifier les URL réellement présentes dans le HTML, pas uniquement une liste figée.
  const resources = [...html.matchAll(/(?:src|href)="([^"#]+\.(?:js|css))"/g)].map((match) => match[1]);
  assert.equal(resources.length, 4);
  for (const resource of resources) {
    const asset = await fetch(new URL(resource, `${base}/menus.html`));
    assert.equal(asset.status, 200, resource);
    assert.match(asset.headers.get("content-type"), resource.endsWith(".css") ? /^text\/css/ : /javascript/);
  }
  for (const source of new Set(menus.flatMap((menu) => menu.images.map((image) => image.src)))) {
    const image = await fetch(new URL(source, `${base}/menus.html`));
    assert.equal(image.status, 200, source);
    assert.match(image.headers.get("content-type"), /^image\/svg\+xml/);
  }
}

test("GET /menus.html publie le véritable HTML, ses scripts, son style et toutes ses images", async () => {
  await withServer(null, verifyCatalogueFiles);
});

test("une instance à jour sert connexion et inscription tout en conservant les routes API et le catalogue", async () => {
  await withServer(null, async (base) => {
    for (const file of ["connexion.html", "connexion.js", "inscription.html", "inscription.js"]) {
      const response = await fetch(`${base}/${file}`);
      assert.equal(response.status, 200, file);
      assert.equal(await response.text(), fs.readFileSync(path.join(__dirname, "../frontend", file), "utf8"));
    }
    await verifyCatalogueFiles(base);
    const me = await fetch(`${base}/api/auth/me`);
    assert.equal(me.status, 401, "La route me existe, même sans session.");
    assert.deepEqual(await me.json(), { error: "Authentification requise." });
    for (const [route, expected] of [["register", 400], ["login", 401], ["logout", 204]]) {
      const response = await fetch(`${base}/api/auth/${route}`, {
        method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "ViteGourmand" }, body: "{}"
      });
      assert.equal(response.status, expected, route);
    }
    assert.equal((await fetch(`${base}/api/menus`)).status, 503, "Sans base, l'API reste présente.");
    const missingApi = await fetch(`${base}/api/inconnue`);
    assert.equal(missingApi.status, 404);
    assert.deepEqual(await missingApi.json(), { error: "Ressource introuvable." });
    const missingPage = await fetch(`${base}/page-inconnue.html`);
    assert.equal(missingPage.status, 404);
    assert.match(missingPage.headers.get("content-type"), /^text\/html/);
  });
});

test("le dossier statique reste accessible depuis un autre répertoire de lancement", async () => {
  const code = `
    const { createApp } = require(process.argv[1]);
    const server = createApp().listen(0, '127.0.0.1', () => process.send({ port: server.address().port }));
    process.on('message', () => server.close(() => process.exit(0)));
  `;
  const child = spawn(process.execPath, ["-e", code, path.join(__dirname, "app.js")], {
    cwd: os.tmpdir(), stdio: ["ignore", "ignore", "ignore", "ipc"]
  });
  let timeout;
  try {
    const ready = await new Promise((resolve, reject) => {
      timeout = setTimeout(() => reject(new Error("Le serveur statique de test n'a pas démarré.")), 5000);
      child.once("message", resolve);
      child.once("error", reject);
      child.once("exit", () => reject(new Error("Arrêt prématuré du serveur de test.")));
    });
    clearTimeout(timeout);
    await verifyCatalogueFiles(`http://127.0.0.1:${ready.port}`);
    const stopped = once(child, "exit");
    child.send("stop");
    await stopped;
  } finally {
    clearTimeout(timeout);
    if (child.exitCode === null) child.kill();
  }
});

test("health DB et catalogue répondent en JSON sans identifiants de connexion", async () => {
  const calls = [];
  const database = { query: async (sql, values) => {
    calls.push([sql, values]);
    return { rows: sql === MENUS_SQL ? menus.map((menu) => ({ ...menu, id: String(menu.id), isDemo: true })) : [{ ok: 1 }] };
  } };
  await withServer(database, async (base) => {
    const health = await fetch(`${base}/api/health/db`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: "ok" });
    const response = await fetch(`${base}/api/menus`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("x-powered-by"), null);
    const result = await response.json();
    assert.equal(result.length, 6);
    assert.equal(result[0].id, 1);
    assert.deepEqual(result[0].images, menus[0].images);
    assert.deepEqual(result[0].dishes, menus[0].dishes);
    assert.deepEqual(calls, [["SELECT 1 AS ok", undefined], [MENUS_SQL, [true]]]);
  });
});

test("une base absente ou en panne produit un 503 générique sans message SQL", async () => {
  for (const database of [null, { query: async () => { throw new Error("SENTINEL_SECRET host=internal SQL SELECT"); } }]) {
    await withServer(database, async (base) => {
      const health = await fetch(`${base}/api/health/db`);
      assert.equal(health.status, 503);
      assert.deepEqual(await health.json(), { status: "unavailable" });
      const menus = await fetch(`${base}/api/menus`);
      assert.equal(menus.status, 503);
      assert.deepEqual(await menus.json(), { error: "Catalogue indisponible. Réessayez plus tard." });
    });
  }
});

test("un catalogue vide est un résultat valide et les identifiants hors précision sont refusés", async () => {
  await withServer({ query: async () => ({ rows: [] }) }, async (base) => {
    const response = await fetch(`${base}/api/menus`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), []);
  });
  await withServer({ query: async () => ({ rows: [{ id: "9007199254740993" }] }) }, async (base) => {
    assert.equal((await fetch(`${base}/api/menus`)).status, 503);
  });
});

test("les pages existantes sont servies et les secrets/fichiers serveur ne le sont pas", async () => {
  await withServer(null, async (base) => {
    for (const url of ["/", "/menus.html", "/commande.html?menu=1", "/menus.js", "/commande.js", "/images/menu-demo.svg"]) {
      assert.equal((await fetch(base + url)).status, 200, url);
    }
    for (const url of ["/.env", "/.env.example", "/backend/config.js", "/database/001_schema.sql", "/api/inconnue"]) {
      assert.equal((await fetch(base + url)).status, 404, url);
    }
    for (const url of ["/menus.js", "/commande.js"]) {
      const script = await (await fetch(base + url)).text();
      assert.ok(script.includes('"/api/menus"'));
      assert.ok(!script.includes('"data/menus.json"'));
    }
  });
});

const allowedAccount = {
  username: "vg_app", rolsuper: false, rolcreatedb: false, rolcreaterole: false,
  rolreplication: false, rolbypassrls: false, member_of_owner: false,
  can_create_schema: false, can_create_objects: false
};

function fakePool({ account = allowedAccount, failConnect = false, failQuery = false } = {}) {
  let instance;
  class FakePool extends EventEmitter {
    constructor(options) { super(); this.options = options; this.calls = []; this.releases = []; instance = this; }
    async connect() {
      if (failConnect) throw new Error("SENTINEL_SECRET");
      return {
        query: async (sql, values) => {
          this.calls.push([sql, values]);
          if (sql === ACCOUNT_CHECK_SQL) return { rows: account ? [account] : [] };
          if (failQuery) throw new Error("SENTINEL_SECRET");
          return { rows: [{ ok: 1 }] };
        },
        release: (discard) => this.releases.push(discard)
      };
    }
    async end() { this.ended = true; }
  }
  const logs = [];
  const database = createDatabase({ user: "vg_app", password: "SENTINEL_SECRET" }, { PoolClass: FakePool, logger: { error: (...args) => logs.push(args) } });
  return { database, pool: instance, logs };
}

test("pool borné, libération des clients, paramètres et fermeture propre", async () => {
  const { database, pool, logs } = fakePool();
  assert.equal(pool.options.max, 5);
  assert.equal(pool.options.connectionTimeoutMillis, 5000);
  await database.query("SELECT $1::integer AS ok", [1]);
  assert.deepEqual(pool.calls, [[ACCOUNT_CHECK_SQL, undefined], ["SELECT $1::integer AS ok", [1]]]);
  assert.deepEqual(pool.releases, [false]);
  pool.emit("error", new Error("SENTINEL_SECRET"));
  assert.deepEqual(logs, [["Connexion PostgreSQL interrompue."]]);
  await database.close();
  assert.equal(pool.ended, true);
});

test("un compte effectif trop privilégié est refusé et sa connexion est détruite", async () => {
  const accounts = [null, { ...allowedAccount, username: "postgres" },
    ...Object.keys(allowedAccount).filter((key) => key !== "username").map((key) => ({ ...allowedAccount, [key]: true }))];
  for (const account of accounts) {
    const { database, pool } = fakePool({ account });
    await assert.rejects(database.query("SELECT 1"), { message: "PostgreSQL indisponible." });
    assert.equal(pool.calls.length, 1);
    assert.deepEqual(pool.releases, [true]);
  }
  assert.throws(() => createDatabase({ user: "postgres" }), /vg_app/);
  assert.equal(createDatabase(null), null);
});

test("les erreurs de connexion et de requête ne sortent pas du pool en clair", async () => {
  for (const options of [{ failConnect: true }, { failQuery: true }]) {
    const { database, pool } = fakePool(options);
    await assert.rejects(database.query("SELECT 1"), { message: "PostgreSQL indisponible." });
    assert.deepEqual(pool.releases, options.failConnect ? [] : [true]);
  }
});

test("transactions : même connexion vérifiée, COMMIT après succès et ROLLBACK sur erreur métier", async () => {
  const { database, pool } = fakePool();
  const value = await database.transaction(async (tx) => {
    await tx.query("SELECT $1::integer", [1]); return "ok";
  });
  assert.equal(value, "ok");
  assert.deepEqual(pool.calls.map(([sql]) => sql), [ACCOUNT_CHECK_SQL,"BEGIN ISOLATION LEVEL READ COMMITTED","SELECT $1::integer","COMMIT"]);
  assert.deepEqual(pool.releases,[false]);
  const error = new Error("Stock épuisé."); error.name = "OrderError";
  await assert.rejects(database.transaction(async (tx) => { await tx.query("SELECT 2"); throw error; }), { message: "Stock épuisé." });
  assert.deepEqual(pool.calls.slice(-4).map(([sql]) => sql), [ACCOUNT_CHECK_SQL,"BEGIN ISOLATION LEVEL READ COMMITTED","SELECT 2","ROLLBACK"]);
  const forbidden = fakePool({ account: { ...allowedAccount, rolsuper: true } });
  await assert.rejects(forbidden.database.transaction(async () => assert.fail("Ne doit pas commencer")), /indisponible/);
  assert.equal(forbidden.pool.calls.length,1);
});

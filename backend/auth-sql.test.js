"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { once } = require("node:events");
const { PGlite } = require("@electric-sql/pglite");
const argon2 = require("argon2");
const { createApp } = require("./app.js");
const { readSessionConfig, LocalSessionStore } = require("./auth-session.js");
const { LOGIN_SQL } = require("./auth.js");

test("connexion et sessions PostgreSQL : scripts 007/008, droits restreints, persistance, expiration et déconnexion (base mémoire)", async () => {
  const db = new PGlite();
  let server;
  const script = (name) => fs.readFileSync(path.join(__dirname, "../database", name), "utf8");
  const query = (sql, values = []) => db.query(sql, values);
  const password = "ExempleFictif42!";
  try {
    await db.exec("CREATE ROLE vg_owner; CREATE ROLE vg_app LOGIN; ALTER DATABASE postgres OWNER TO vg_owner;");
    for (const name of ["001_schema.sql", "002_demo_data.sql", "003_app_privileges.sql", "004_registration_privileges.sql"]) await db.exec(script(name));
    // Activation d'un compte de démonstration UNIQUEMENT dans le moteur WASM.
    const hash = await argon2.hash(password, { type: argon2.argon2id });
    await query("UPDATE vg.users SET is_active=true,password_hash=$1 WHERE email='client.demo@example.test'", [hash]);
    await db.exec("SET ROLE vg_app;");
    await assert.rejects(query(LOGIN_SQL, ["client.demo@example.test"]), /permission denied/);
    await db.exec("RESET ROLE;");
    await db.exec(script("007_login_privileges.sql"));
    await db.exec(script("008_web_sessions.sql"));
    await db.exec("SET ROLE vg_app;");
    const database = { query };
    const sessionConfig = readSessionConfig({ SESSION_STORE: "postgres", SESSION_SECRET: "secret-fictif-exclusivement-tests-1234567890" });
    server = createApp({ database, sessionConfig }).listen(0, "127.0.0.1");
    await once(server, "listening");
    const base = `http://127.0.0.1:${server.address().port}`;
    const response = await fetch(base + "/api/auth/login", { method: "POST", headers: {
      "Content-Type": "application/json", "X-Requested-With": "ViteGourmand"
    }, body: JSON.stringify({ email: "CLIENT.DEMO@EXAMPLE.TEST", password }) });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.user.role, "utilisateur");
    assert.ok(!JSON.stringify(body).includes(hash));
    const cookie = response.headers.get("set-cookie").split(";")[0];
    const saved = (await query("SELECT * FROM vg.web_sessions")).rows;
    assert.equal(saved.length, 1);
    assert.match(saved[0].sid_digest, /^[a-f0-9]{64}$/);
    assert.deepEqual(Object.keys(saved[0].session_data).sort(), ["cookie", "loggedAt", "userId"]);
    assert.ok(!JSON.stringify(saved).includes(password));
    assert.ok(!JSON.stringify(saved).includes(hash));
    // Une seconde application avec le même secret retrouve la session dans le store partagé.
    const second = createApp({ database, sessionConfig }).listen(0, "127.0.0.1");
    await once(second, "listening");
    try {
      const me = await fetch(`http://127.0.0.1:${second.address().port}/api/auth/me`, { headers: { Cookie: cookie } });
      assert.equal(me.status, 200);
    } finally { await new Promise((resolve) => second.close(resolve)); }
    const logout = await fetch(base + "/api/auth/logout", { method: "POST", headers: { "X-Requested-With": "ViteGourmand", Cookie: cookie } });
    assert.equal(logout.status, 204);
    assert.equal((await query("SELECT count(*)::int n FROM vg.web_sessions")).rows[0].n, 0);
    // Une session expirée en base n'est pas restituée, même avec une signature valide.
    await query("INSERT INTO vg.web_sessions VALUES($1,$2,now()-interval '1 second')", [saved[0].sid_digest, saved[0].session_data]);
    assert.equal((await fetch(base + "/api/auth/me", { headers: { Cookie: cookie } })).status, 401);
    await assert.rejects(query("UPDATE vg.users SET role_code='administrateur' WHERE false"), /permission denied/);
    await assert.rejects(query("CREATE TABLE vg.interdit(id int)"), /permission denied/);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await db.close();
  }
});

test("stockage local : borne du nombre de sessions et récupération de place après expiration", async () => {
  let clock = Date.now();
  const store = new LocalSessionStore({ maximum: 1, now: () => clock });
  const data = () => ({ userId: "1", loggedAt: clock, cookie: { expires: new Date(clock + 1000) } });
  const set = (sid) => new Promise((resolve, reject) => store.set(sid, data(), (error) => error ? reject(error) : resolve()));
  await set("premiere");
  await assert.rejects(set("seconde"));
  clock += 1001;
  await set("seconde");
  assert.equal(store.entries.size, 1);
  assert.ok(!store.entries.has("seconde")); // Seul un digest est utilisé comme clé.
});

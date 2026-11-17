"use strict";

const { test, before } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const argon2 = require("argon2");
const { createApp } = require("./app.js");
const { LOGIN_SQL, ME_SQL } = require("./auth.js");
const { readSessionConfig, LocalSessionStore, SESSION_DURATION } = require("./auth-session.js");
const config = readSessionConfig({ SESSION_SECRET: "fictif-pour-tests-uniquement-1234567890" });
const credentials = { email: "client@example.test", password: "ExempleFictif42!" };
let hash;
before(async () => { hash = await argon2.hash(credentials.password, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 }); });
const user = () => ({ id: "7", first_name: "Client", last_name: "Fictif", email: credentials.email,
  role_code: "utilisateur", is_active: true, deactivated_at: null, password_hash: hash });
function fakeDatabase(record = user()) {
  return { calls: [], async query(sql, values) {
    this.calls.push([sql, values]);
    assert.ok([LOGIN_SQL, ME_SQL].includes(sql));
    return { rows: record ? [{ ...record }] : [] };
  } };
}
async function withServer(options, work) {
  const server = createApp({ sessionConfig: config, ...options }).listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (route, body = credentials, cookie = "", headers = {}) => fetch(base + route, {
    method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "ViteGourmand", ...(cookie ? { Cookie: cookie } : {}), ...headers },
    body: JSON.stringify(body)
  });
  const me = (cookie = "") => fetch(base + "/api/auth/me", { headers: cookie ? { Cookie: cookie } : {} });
  try { await work({ post, me, base }); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}
const cookieOf = (response) => response.headers.get("set-cookie")?.split(";")[0];

test("connexion Argon2id : email normalisé, SQL paramétré, cookie HttpOnly/SameSite et profil sans hachage", async () => {
  const database = fakeDatabase();
  await withServer({ database }, async ({ post, me }) => {
    assert.equal((await me()).status, 401);
    const response = await post("/api/auth/login", { ...credentials, email: " CLIENT@EXAMPLE.TEST " });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.match(response.headers.get("set-cookie"), /HttpOnly/);
    assert.match(response.headers.get("set-cookie"), /SameSite=Lax/);
    assert.ok(!response.headers.get("set-cookie").includes("Secure"));
    const result = await response.json();
    assert.deepEqual(Object.keys(result.user).sort(), ["id", "firstName", "lastName", "email", "role"].sort());
    assert.ok(!JSON.stringify(result).includes(hash));
    assert.ok(!JSON.stringify(result).includes(credentials.password));
    assert.equal(result.user.role, "utilisateur");
    const profile = await me(cookieOf(response));
    assert.equal(profile.status, 200);
    assert.equal(profile.headers.get("set-cookie"), null);
    assert.deepEqual(await profile.json(), result);
    assert.deepEqual(database.calls, [[LOGIN_SQL, [credentials.email]], [ME_SQL, ["7"]]]);
    assert.ok(!ME_SQL.includes("password_hash"));
  });
});

test("email absent, mauvais mot de passe, compte inactif/désactivé, rôle inconnu, hash absent ou mal formé : même erreur", async () => {
  const scenarios = [
    [null, credentials], [user(), { ...credentials, password: "Incorrect42!" }],
    [{ ...user(), is_active: false }, credentials], [{ ...user(), deactivated_at: new Date() }, credentials],
    [{ ...user(), role_code: "inconnu" }, credentials], [{ ...user(), password_hash: null }, credentials],
    [{ ...user(), password_hash: "$argon2id$invalide" }, credentials]
  ];
  for (const [record, body] of scenarios) {
    await withServer({ database: fakeDatabase(record) }, async ({ post }) => {
      const response = await post("/api/auth/login", body);
      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { error: "Email ou mot de passe incorrect." });
      assert.equal(response.headers.get("set-cookie"), null);
    });
  }
});

test("entrées invalides et injection : aucune interpolation SQL ni information de compte", async () => {
  const database = fakeDatabase(null);
  await withServer({ database }, async ({ post }) => {
    for (const body of [{}, { email: {}, password: [] }, { ...credentials, password: "x".repeat(129) }]) {
      assert.equal((await post("/api/auth/login", body)).status, 401);
    }
    const malicious = "x'OR'1'='1@example.test";
    assert.equal((await post("/api/auth/login", { ...credentials, email: malicious })).status, 401);
    assert.deepEqual(database.calls, [[LOGIN_SQL, [malicious.toLowerCase()]]]);
  });
});

test("session : rotation à chaque connexion, ancienne session invalidée et cookie falsifié rejeté", async () => {
  await withServer({ database: fakeDatabase() }, async ({ post, me }) => {
    const first = cookieOf(await post("/api/auth/login"));
    const second = cookieOf(await post("/api/auth/login", credentials, first));
    assert.notEqual(first, second);
    assert.equal((await me(first)).status, 401);
    assert.equal((await me(second)).status, 200);
    assert.equal((await me(second + "falsifie")).status, 401);
    assert.equal((await me("vg.sid=fixation-imposee")).status, 401);
  });
});

test("déconnexion : cookie effacé, ancienne session inutilisable et répétition sans erreur", async () => {
  await withServer({ database: fakeDatabase() }, async ({ post, me }) => {
    const cookie = cookieOf(await post("/api/auth/login"));
    const response = await post("/api/auth/logout", {}, cookie);
    assert.equal(response.status, 204);
    assert.match(response.headers.get("set-cookie"), /Expires=Thu, 01 Jan 1970/);
    assert.equal((await me(cookie)).status, 401);
    assert.equal((await post("/api/auth/logout", {})).status, 204);
  });
});

test("session expirée après deux heures et compte désactivé après connexion refusé par me", async () => {
  let clock = Date.now();
  const record = user();
  await withServer({ database: fakeDatabase(record), now: () => clock, sessionStore: new LocalSessionStore({ now: () => clock }) }, async ({ post, me }) => {
    let cookie = cookieOf(await post("/api/auth/login"));
    clock += SESSION_DURATION + 1;
    assert.equal((await me(cookie)).status, 401);
    clock = Date.now();
    cookie = cookieOf(await post("/api/auth/login"));
    record.is_active = false;
    const response = await me(cookie);
    assert.equal(response.status, 401);
    assert.match(response.headers.get("set-cookie"), /Expires=Thu, 01 Jan 1970/);
  });
});

test("CSRF : en-tête dédié obligatoire, Origin étrangère et requête cross-site refusées pour login/logout", async () => {
  await withServer({ database: fakeDatabase() }, async ({ post }) => {
    for (const route of ["/api/auth/login", "/api/auth/logout"]) {
      for (const headers of [{ "X-Requested-With": "" }, { Origin: "https://evil.example.test" }, { "Sec-Fetch-Site": "cross-site" }]) {
        assert.equal((await post(route, credentials, "", headers)).status, 403);
      }
    }
  });
});

test("production : configuration stricte, HTTPS requis et cookie préfixé __Host- avec Secure", async () => {
  assert.throws(() => readSessionConfig({ NODE_ENV: "production" }));
  assert.throws(() => readSessionConfig({ NODE_ENV: "production", SESSION_STORE: "memory" }));
  assert.throws(() => readSessionConfig({ SESSION_SECRET: "court" }));
  assert.throws(() => readSessionConfig({ APP_ORIGIN: "https://site.test/" }));
  const production = readSessionConfig({ NODE_ENV: "production", SESSION_SECRET: "fictif-pour-tests-uniquement-1234567890", APP_ORIGIN: "https://site.example.test", TRUST_PROXY_HOPS: "1" });
  await withServer({ database: fakeDatabase(), sessionConfig: production, sessionStore: new LocalSessionStore() }, async ({ post }) => {
    assert.equal((await post("/api/auth/login")).status, 503);
    const response = await post("/api/auth/login", credentials, "", { "X-Forwarded-Proto": "https", Origin: production.origin });
    assert.equal(response.status, 200);
    const header = response.headers.get("set-cookie");
    assert.match(header, /^__Host-vg.sid=/);
    assert.match(header, /; Secure/);
    assert.match(header, /; HttpOnly/);
    assert.match(header, /; SameSite=Lax/);
    assert.match(header, /; Path=\//);
    assert.ok(!header.includes("Domain="));
  });
});

test("limitation des tentatives, JSON trop gros, contenu incorrect et panne générique", async () => {
  await withServer({}, async ({ post }) => {
    assert.equal((await post("/api/auth/login")).status, 503);
    assert.equal((await post("/api/auth/login", { ...credentials, email: "a".repeat(3000) })).status, 413);
    assert.equal((await post("/api/auth/login", credentials, "", { "Content-Type": "text/plain" })).status, 415);
    for (let index = 0; index < 9; index++) await post("/api/auth/login", {});
    assert.equal((await post("/api/auth/login", {})).status, 429);
  });
  await withServer({ database: { query: async () => { throw new Error("SENTINEL_SECRET SQL password_hash"); } } }, async ({ post }) => {
    const response = await post("/api/auth/login");
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "Authentification indisponible. Réessayez plus tard." });
  });
});

test("panne du stockage : erreur JSON générique et aucune pile exposée", async () => {
  const store = new LocalSessionStore();
  await withServer({ database: fakeDatabase(), sessionStore: store }, async ({ post, me }) => {
    const cookie = cookieOf(await post("/api/auth/login"));
    store.get = (_sid, callback) => callback(new Error("SENTINEL_SECRET"));
    const response = await me(cookie);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "Service indisponible. Réessayez plus tard." });
  });
});

test("échec de sauvegarde de session : connexion non confirmée, session détruite et cookie effacé", async () => {
  const store = new LocalSessionStore();
  store.set = (_sid, _data, callback) => callback(new Error("SECRET stockage"));
  await withServer({ database: fakeDatabase(), sessionStore: store }, async ({ post }) => {
    const response = await post("/api/auth/login");
    assert.equal(response.status, 503);
    assert.match(response.headers.get("set-cookie"), /Expires=Thu, 01 Jan 1970/);
    assert.equal(store.entries.size, 0);
  });
});

test("page connexion et ressources servies, aucune session anonyme ni stockage de jeton dans le navigateur", async () => {
  const fs = require("node:fs");
  const path = require("node:path");
  await withServer({}, async ({ base, me }) => {
    for (const file of ["connexion.html", "connexion.js", "inscription.css", "menus.css"]) {
      assert.equal((await fetch(`${base}/${file}`)).status, 200);
    }
    assert.equal((await me()).headers.get("set-cookie"), null);
  });
  const script = fs.readFileSync(path.join(__dirname, "../frontend/connexion.js"), "utf8");
  assert.ok(!/localStorage|sessionStorage|document\.cookie|innerHTML/.test(script));
});

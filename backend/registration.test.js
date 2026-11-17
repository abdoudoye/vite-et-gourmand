"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const fs = require("node:fs");
const path = require("node:path");
const argon2 = require("argon2");
const { PGlite } = require("@electric-sql/pglite");
const { createApp } = require("./app.js");
const { REGISTER_SQL } = require("./registration.js");
const { readEmailConfig, createWelcomeMailer } = require("./welcome-email.js");

const valid = { firstName: "Élodie", lastName: "Client fictif", email: "client.inscription@example.test",
  phone: "+33 6 12 34 56 78", street: "12 rue Fictive", additionalLine: "", postalCode: "33000", city: "Bordeaux",
  countryCode: "FR", password: "ExempleFictif42!", passwordConfirmation: "ExempleFictif42!" };
let db;
const database = { query: (sql, values) => db.query(sql, values) };
before(async () => {
  db = new PGlite();
  await db.exec("CREATE ROLE vg_owner; CREATE ROLE vg_app LOGIN; ALTER DATABASE postgres OWNER TO vg_owner;");
  for (const name of ["001_schema.sql", "002_demo_data.sql", "003_app_privileges.sql"]) {
    await db.exec(fs.readFileSync(path.join(__dirname, "../database", name), "utf8"));
  }
  await db.exec("SET SESSION AUTHORIZATION vg_app;");
});
after(async () => { if (db) await db.close(); });

async function withServer(options, work) {
  const server = createApp(options).listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (data = valid, headers = { "Content-Type": "application/json" }) => fetch(base + "/api/auth/register", {
    method: "POST", headers, body: typeof data === "string" ? data : JSON.stringify(data)
  });
  try { await work(post, base); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test("inscription valide avec les droits vg_app : client actif, adresse, email normalisé, outbox et hash Argon2id", async () => {
  await withServer({ database }, async (post) => {
    const response = await post({ ...valid, email: "  CLIENT.INSCRIPTION@EXAMPLE.TEST  ", role_code: "administrateur", is_demo: true });
    assert.equal(response.status, 201);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const result = await response.json();
    assert.equal(result.welcomeEmail, "disabled");
    assert.ok(!JSON.stringify(result).includes(valid.password));
    assert.ok(!JSON.stringify(result).includes("hash"));
  });
  const user = (await db.query("SELECT * FROM vg.users WHERE email=$1", [valid.email])).rows[0];
  assert.equal(user.role_code, "utilisateur");
  assert.equal(user.is_active, true);
  assert.equal(user.is_demo, false);
  assert.match(user.password_hash, /^\$argon2id\$v=19\$m=65536,t=3,p=1\$/);
  assert.notEqual(user.password_hash, valid.password);
  assert.equal(await argon2.verify(user.password_hash, valid.password), true);
  assert.equal(await argon2.verify(user.password_hash, "Incorrect1!"), false);
  const address = (await db.query("SELECT * FROM vg.addresses WHERE user_id=$1", [user.id])).rows[0];
  assert.equal(address.street, valid.street);
  assert.equal(address.is_default, true);
  assert.equal(address.additional_line, null);
  const outbox = (await db.query("SELECT * FROM vg.email_outbox WHERE user_id=$1", [user.id])).rows[0];
  assert.equal(outbox.kind, "bienvenue");
  assert.equal(outbox.status, "en_attente");
});

test("tous les champs requis sont validés côté serveur avant toute requête SQL", async () => {
  for (const field of Object.keys(valid).filter((name) => name !== "additionalLine")) {
    let called = false;
    await withServer({ database: { query: async () => { called = true; } } }, async (post) => {
      const data = { ...valid };
      delete data[field];
      const response = await post(data);
      assert.equal(response.status, 400, field);
      assert.ok((await response.json()).errors[field], field);
      assert.equal(called, false);
    });
  }
});

test("mots de passe faibles, trop longs, confirmation différente et types invalides refusés", async () => {
  const passwords = ["Court1!", "sansmajuscule42!", "SANS MINUSCULE42!", "SansChiffre!", "SansSpecial42", "SansSpecial42 ", "A".repeat(129) + "a1!", "Abcdefgh1!\n", 1234567890, null];
  for (const password of passwords) {
    await withServer({}, async (post) => {
      const response = await post({ ...valid, password, passwordConfirmation: password });
      assert.equal(response.status, 400);
      assert.ok((await response.json()).errors.password);
    });
  }
  await withServer({}, async (post) => {
    const response = await post({ ...valid, passwordConfirmation: "Different42!" });
    assert.equal(response.status, 400);
    assert.ok((await response.json()).errors.passwordConfirmation);
  });
});

test("email, téléphone, adresse, longueurs et objets malveillants invalides refusés", async () => {
  const cases = [{ email: "abc" }, { email: "a@b.test\r\nBcc:evil@test.fr" }, { phone: "abc" },
    { phone: "1" }, { street: " " }, { lastName: "<script>alert(1)</script>" }, { firstName: {} },
    { city: "a".repeat(101) }, { countryCode: "France" }, { postalCode: "!" }];
  for (const change of cases) {
    await withServer({}, async (post) => assert.equal((await post({ ...valid, ...change })).status, 400));
  }
  await withServer({}, async (post) => {
    assert.equal((await post([])).status, 400);
    assert.equal((await post("null")).status, 400);
  });
});

test("email déjà utilisé, même en majuscules : aucun compte, adresse ou email supplémentaire", async () => {
  const counts = async () => (await db.query("SELECT (SELECT count(*) FROM vg.users) u, (SELECT count(*) FROM vg.addresses) a, (SELECT count(*) FROM vg.email_outbox) e")).rows;
  const before = await counts();
  await withServer({ database }, async (post) => {
    const response = await post({ ...valid, email: valid.email.toUpperCase() });
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: "Inscription impossible avec ces informations." });
  });
  assert.deepEqual(await counts(), before);
});

test("injection SQL stockée comme texte par paramètres, sans exécuter de SQL", async () => {
  const injection = "Robert'); DROP TABLE vg.users; --";
  const calls = [];
  await withServer({ database: { query: async (sql, values) => { calls.push([sql, values]); return database.query(sql, values); } } }, async (post) => {
    assert.equal((await post({ ...valid, lastName: injection, email: "injection@example.test" })).status, 201);
  });
  assert.equal(calls[0][0], REGISTER_SQL);
  assert.ok(!calls[0][0].includes(injection));
  assert.equal(calls[0][1][1], injection);
  assert.ok(!calls[0][1].includes(valid.password));
  assert.equal((await db.query("SELECT last_name FROM vg.users WHERE email='injection@example.test'")).rows[0].last_name, injection);
});

test("deux inscriptions concurrentes : un seul compte et deux sels différents pour un même mot de passe", async () => {
  await withServer({ database }, async (post) => {
    const responses = await Promise.all([post({ ...valid, email: "race@example.test" }), post({ ...valid, email: "RACE@EXAMPLE.TEST" })]);
    assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
  });
  const hashes = (await db.query("SELECT password_hash FROM vg.users WHERE email IN ($1,$2)", [valid.email, "race@example.test"])).rows;
  assert.equal(hashes.length, 2);
  assert.notEqual(hashes[0].password_hash, hashes[1].password_hash);
});

test("échec d'insertion d'adresse : le compte et l'outbox sont annulés atomiquement", async () => {
  // Paramètre postal délibérément invalide pour provoquer une contrainte SQL, en mémoire uniquement.
  const broken = { query: (sql, values) => { const params = [...values]; params[7] = ""; return db.query(sql, params); } };
  await withServer({ database: broken }, async (post) => {
    assert.equal((await post({ ...valid, email: "rollback@example.test" })).status, 503);
  });
  assert.equal((await db.query("SELECT id FROM vg.users WHERE email='rollback@example.test'")).rows.length, 0);
  assert.equal((await db.query("SELECT id FROM vg.email_outbox WHERE recipient='rollback@example.test'")).rows.length, 0);
});

test("base absente ou en panne : erreur générique, sans SQL ni secret", async () => {
  for (const db of [null, { query: async () => { throw new Error("SENTINEL_SECRET SELECT password_hash"); } }]) {
    await withServer({ database: db }, async (post) => {
      const response = await post();
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { error: "Inscription indisponible. Réessayez plus tard." });
    });
  }
});

test("JSON invalide, trop volumineux et contenu non JSON refusés", async () => {
  await withServer({}, async (post) => {
    assert.equal((await post("{")).status, 400);
    assert.equal((await post({ ...valid, street: "a".repeat(17000) })).status, 413);
    assert.equal((await post(valid, { "Content-Type": "text/plain" })).status, 415);
  });
});

test("limitation des tentatives et absence de route de réinitialisation", async () => {
  await withServer({}, async (post, base) => {
    for (let index = 0; index < 10; index++) assert.equal((await post({})).status, 400);
    const blocked = await post({});
    assert.equal(blocked.status, 429);
    assert.equal(blocked.headers.get("retry-after"), "900");
    assert.equal((await fetch(`${base}/api/auth/reset-password`, { method: "POST" })).status, 404);
  });
});

test("configuration email : aucun transport par défaut, activation SMTP explicite avec TLS", async () => {
  assert.equal(readEmailConfig({}), null);
  assert.equal(readEmailConfig({ EMAIL_MODE: "disabled", SMTP_HOST: "unused" }), null);
  assert.equal(createWelcomeMailer(null, { createTransport: () => { throw new Error("Interdit"); } }), null);
  assert.throws(() => readEmailConfig({ EMAIL_MODE: "smtp" }));
  assert.throws(() => readEmailConfig({ EMAIL_MODE: "unknown" }));
  const env = { EMAIL_MODE: "smtp", SMTP_HOST: "smtp.example.test", SMTP_PORT: "587", SMTP_USER: "fictif", SMTP_PASSWORD: "secret-fictif", SMTP_FROM: "noreply@example.test" };
  for (const change of [{ SMTP_PORT: "0" }, { SMTP_SECURE: "oui" }, { SMTP_FROM: "bad\r\nBcc:test" }, { SMTP_PASSWORD: "" }]) {
    assert.throws(() => readEmailConfig({ ...env, ...change }));
  }
  const config = readEmailConfig(env);
  assert.equal(config.transport.requireTLS, true);
  assert.equal(config.transport.tls.rejectUnauthorized, true);
  let sent;
  const mailer = createWelcomeMailer(config, { createTransport: () => ({ sendMail: async (message) => { sent = message; return { accepted: [message.to], rejected: [] }; } }) });
  await mailer.sendWelcome(valid.email);
  assert.equal(sent.to, valid.email);
  assert.ok(!JSON.stringify(sent).includes(valid.password));
  assert.ok(!JSON.stringify(sent).includes(env.SMTP_PASSWORD));
});

test("email accepté : événement marqué envoyé ; panne SMTP : compte conservé et événement en attente", async () => {
  for (const fails of [false, true]) {
    const email = `smtp-${fails}@example.test`;
    const mailer = { sendWelcome: async (recipient) => { assert.equal(recipient, email); if (fails) throw new Error("SMTP SECRET"); } };
    await withServer({ database, mailer }, async (post) => {
      const response = await post({ ...valid, email });
      assert.equal(response.status, 201);
      assert.equal((await response.json()).welcomeEmail, fails ? "pending" : "sent");
    });
    const event = (await db.query("SELECT status, sent_at FROM vg.email_outbox WHERE recipient=$1", [email])).rows[0];
    assert.equal(event.status, fails ? "en_attente" : "envoye");
    assert.equal(Boolean(event.sent_at), !fails);
  }
});

test("page inscription, styles, script et navigation servis par Express", async () => {
  await withServer({}, async (_post, base) => {
    for (const resource of ["inscription.html", "inscription.css", "inscription.js", "menus.html", "commande.html"]) {
      const response = await fetch(`${base}/${resource}`);
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type"), /charset=utf-8/);
    }
    const html = await (await fetch(`${base}/inscription.html`)).text();
    for (const field of Object.keys(valid)) {
      assert.ok(html.includes(`for="${field}"`), field);
      assert.ok(html.includes(`id="${field}-error"`), field);
    }
    assert.ok(html.includes('role="alert"'));
    assert.ok(html.includes('autocomplete="new-password"'));
  });
});

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readConfig, loadEnvironment } = require("./config.js");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const databaseEnv = { DB_HOST: "127.0.0.1", DB_NAME: "test_demo", DB_USER: "vg_app", DB_PASSWORD: "SECRET-DE-TEST-UNIQUEMENT" };

test("le serveur statique peut démarrer sans configuration PostgreSQL", () => {
  assert.deepEqual(readConfig({}), { server: { host: "127.0.0.1", port: 3000 }, database: null });
  assert.equal(readConfig({ PORT: "3100", HOST: "0.0.0.0" }).server.port, 3100);
});
test("ports et configuration partielle refusés sans révéler le secret", () => {
  for (const PORT of ["0", "-1", "65536", "NaN", "3e3", ""]) assert.throws(() => readConfig({ PORT }));
  assert.throws(() => readConfig({ DB_HOST: "localhost" }), /DB_USER/);
  assert.throws(() => readConfig({ ...databaseEnv, DB_PASSWORD: "" }), /DB_PASSWORD/);
  assert.throws(() => readConfig({ ...databaseEnv, DB_PORT: "bad" }), /DB_PORT/);
  assert.throws(() => readConfig({ ...databaseEnv, DB_SSL: "off" }), /DB_SSL/);
  try { readConfig({ ...databaseEnv, DB_PORT: "bad" }); } catch (error) { assert.ok(!error.message.includes(databaseEnv.DB_PASSWORD)); }
});
test("les comptes d'administration ne peuvent pas être configurés comme application", () => {
  for (const DB_USER of ["postgres", "POSTGRES", "vg_owner", "vg_migrator", "root", "autre_compte"]) {
    assert.throws(() => readConfig({ ...databaseEnv, DB_USER }), /compte applicatif/);
  }
});
test("une connexion distante sans TLS est refusée", () => {
  assert.throws(() => readConfig({ ...databaseEnv, DB_HOST: "db.example.test" }), /DB_SSL=true/);
  assert.deepEqual(readConfig({ ...databaseEnv, DB_HOST: "db.example.test", DB_SSL: "true" }).database.ssl, { rejectUnauthorized: true });
});
test("TLS vérifie les certificats et les identifiants proviennent uniquement de l'environnement", () => {
  const { database } = readConfig({ ...databaseEnv, DB_SSL: "true" });
  assert.deepEqual(database.ssl, { rejectUnauthorized: true });
  assert.equal(database.password, databaseEnv.DB_PASSWORD);
  assert.equal(database.port, 5432);
  assert.equal(database.user, "vg_app");
});
test(".env facultatif et priorité aux variables déjà définies", () => {
  assert.doesNotThrow(() => loadEnvironment(path.join(__dirname, "fichier-inexistant.env")));
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "vg-config-"));
  const file = path.join(folder, ".env");
  try {
    fs.writeFileSync(file, "VG_TEST_PRIORITY=from-file\nVG_TEST_LOADED=yes\n");
    const run = spawnSync(process.execPath, ["-e", "require('./config.js').loadEnvironment(process.argv[1]); process.stdout.write(JSON.stringify([process.env.VG_TEST_PRIORITY,process.env.VG_TEST_LOADED]));", file], {
      cwd: __dirname, env: { ...process.env, VG_TEST_PRIORITY: "from-environment" }, encoding: "utf8"
    });
    assert.equal(run.status, 0, run.stderr);
    assert.deepEqual(JSON.parse(run.stdout), ["from-environment", "yes"]);
  } finally {
    fs.unlinkSync(file);
    fs.rmdirSync(folder);
  }
});

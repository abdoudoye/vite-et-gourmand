"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PGlite } = require("@electric-sql/pglite");
const { REGISTER_SQL } = require("./registration.js");
const { getMenus } = require("./menus-repository.js");
const { checks } = require("./audit-registration.js");
const sql = (name) => fs.readFileSync(path.join(__dirname, "../database", name), "utf8");

test("profil SQL restreint : inscription et catalogue autorisés, autres écritures et séquences directes refusées ; retour réversible", async () => {
  const db = new PGlite();
  const query = (text, values = []) => db.query(text, values);
  const snapshot = async () => {
    const tables = await query(checks.objects);
    const columns = await query(checks.column_privileges);
    const sequences = await query(checks.sequences);
    return { tables: tables.rows, columns: columns.rows, sequences: sequences.rows };
  };
  try {
    await db.exec("CREATE ROLE vg_owner; CREATE ROLE vg_app LOGIN; ALTER DATABASE postgres OWNER TO vg_owner;");
    for (const file of ["001_schema.sql", "002_demo_data.sql", "003_app_privileges.sql"]) await db.exec(sql(file));
    await db.exec("SET ROLE vg_app;");
    const original = await snapshot();
    await db.exec("RESET ROLE;");
    await db.exec(sql("004_registration_privileges.sql"));
    await db.exec("SET ROLE vg_app;");
    const parameters = ["Client", "Fictif", "inscription.audit@example.test", "0600000000",
      "$argon2id$hash-inerte-pour-test-de-privileges", "1 voie fictive", null, "33000", "Bordeaux", "FR"];
    // Le hash inerte teste uniquement les droits SQL, pas la cryptographie (testée ailleurs).
    assert.equal((await query(REGISTER_SQL, parameters)).rows.length, 1);
    assert.equal((await query(REGISTER_SQL, parameters)).rows.length, 0);
    assert.equal((await getMenus({ query })).length, 6);
    for (const statement of [
      "UPDATE vg.users SET role_code='administrateur' WHERE false",
      "UPDATE vg.menus SET stock_available=0 WHERE false",
      "SELECT password_hash FROM vg.users",
      "SELECT * FROM vg.addresses",
      "INSERT INTO vg.password_reset_tokens(user_id,token_digest,expires_at) VALUES(1,'x',now())",
      "SELECT nextval('vg.users_id_seq')",
      "SELECT setval('vg.users_id_seq',999)",
      "CREATE TABLE vg.interdit(id int)"
    ]) await assert.rejects(query(statement), /permission denied/);
    const { rows } = await query("SELECT id FROM vg.email_outbox WHERE recipient=$1", [parameters[2]]);
    await query("UPDATE vg.email_outbox SET status='envoye',sent_at=now(),attempts=attempts+1 WHERE id=$1", [rows[0].id]);
    // Préparer puis appliquer la vérification sous le propriétaire sans exposer de données.
    await db.exec("RESET ROLE;");
    const verification = await db.exec(sql("006_verify_registration.sql"));
    const booleans = verification.flatMap((result) => result.rows || []);
    assert.equal(booleans.length, 1);
    for (const [key, value] of Object.entries(booleans[0])) {
      assert.equal(value, key !== "email_en_attente", key);
    }
    await db.exec(sql("005_registration_privileges_undo.sql"));
    await db.exec("SET ROLE vg_app;");
    assert.deepEqual(await snapshot(), original);
  } finally { await db.close(); }
});

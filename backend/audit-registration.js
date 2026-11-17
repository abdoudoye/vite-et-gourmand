"use strict";

// Audit sans ecriture : aucune requete DML executee, aucun appel nextval/setval.
const { Client } = require("pg");
const { loadEnvironment, readConfig } = require("./config.js");
const { ACCOUNT_CHECK_SQL } = require("./database.js");
const { REGISTER_SQL } = require("./registration.js");

const checks = {
  server: "SELECT current_setting('server_version') AS version, current_setting('transaction_read_only') AS read_only",
  account: ACCOUNT_CHECK_SQL,
  memberships: "SELECT r.rolname FROM pg_roles r WHERE r.rolname<>current_user AND pg_has_role(current_user,r.oid,'MEMBER')",
  objects: `SELECT c.relname, pg_get_userbyid(c.relowner) AS owner, c.relrowsecurity AS rls,
    ARRAY(SELECT p FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p
      WHERE has_table_privilege(current_user,c.oid,p)) AS table_privileges
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='vg' AND c.relkind IN ('r','v') ORDER BY c.relname`,
  column_privileges: `SELECT table_name, column_name,
    has_column_privilege(current_user, format('%I.%I',table_schema,table_name),column_name,'SELECT') AS can_select,
    has_column_privilege(current_user, format('%I.%I',table_schema,table_name),column_name,'INSERT') AS can_insert,
    has_column_privilege(current_user, format('%I.%I',table_schema,table_name),column_name,'UPDATE') AS can_update
    FROM information_schema.columns WHERE table_schema='vg' AND table_name IN ('users','addresses','email_outbox')
    ORDER BY table_name, ordinal_position`,
  client_role: "SELECT EXISTS(SELECT 1 FROM vg.roles WHERE code='utilisateur') AS present",
  indexes: `SELECT c.relname AS table_name, i.relname AS index_name, x.indisunique, x.indisvalid, x.indisready,
    pg_get_indexdef(x.indexrelid) AS definition FROM pg_index x JOIN pg_class c ON c.oid=x.indrelid
    JOIN pg_class i ON i.oid=x.indexrelid WHERE x.indrelid IN ('vg.users'::regclass,'vg.addresses'::regclass)
    ORDER BY c.relname,i.relname`,
  constraints: `SELECT conrelid::regclass::text AS table_name, conname, convalidated, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint WHERE conrelid IN ('vg.users'::regclass,'vg.addresses'::regclass,'vg.email_outbox'::regclass)
    ORDER BY conrelid,conname`,
  identities: `SELECT c.relname AS table_name,a.attname AS column_name,a.attidentity AS identity_kind,
    pg_get_serial_sequence(format('%I.%I',n.nspname,c.relname),a.attname) AS sequence
    FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='vg' AND c.relname IN ('users','addresses','email_outbox') AND a.attname='id'`,
  sequences: `SELECT c.relname,has_sequence_privilege(current_user,c.oid,'USAGE') AS can_use,
    has_sequence_privilege(current_user,c.oid,'SELECT') AS can_select,
    has_sequence_privilege(current_user,c.oid,'UPDATE') AS can_update
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='vg' AND c.relkind='S' ORDER BY c.relname`,
  triggers: `SELECT tgrelid::regclass::text AS table_name,tgname,tgenabled,pg_get_triggerdef(oid) AS definition
    FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN ('vg.users'::regclass,'vg.addresses'::regclass,'vg.email_outbox'::regclass)`
};

async function audit() {
  let client;
  try {
    loadEnvironment();
    const config = readConfig().database;
    if (!config) throw new Error("Configuration absente");
    client = new Client({ ...config, options: "-c default_transaction_read_only=on -c search_path=vg,pg_catalog",
      connectionTimeoutMillis: 5000, statement_timeout: 5000 });
    await client.connect();
    await client.query("BEGIN READ ONLY");
    for (const [name, sql] of Object.entries(checks)) {
      console.log(name, JSON.stringify((await client.query(sql)).rows));
    }
    // EXPLAIN SANS ANALYZE : planifie la requete exacte sans inserer ni consommer d'identifiant.
    // Ne pas afficher le plan : il peut contenir les parametres d'une requete.
    await client.query("EXPLAIN " + REGISTER_SQL, ["Client", "Fictif", "audit-plan@example.test",
      "0600000000", "$argon2id$plan-inerte", "1 voie fictive", null, "33000", "Bordeaux", "FR"]);
    console.log("register_plan", JSON.stringify({ planned_without_execution: true }));
    await client.query("ROLLBACK");
  } catch (error) {
    console.error(`Audit interrompu (code ${error.code || "configuration/connexion"}). Aucun secret affiche.`);
    process.exitCode = 1;
  } finally {
    if (client) {
      try { await client.end(); }
      catch { process.exitCode = 1; }
    }
  }
}

if (require.main === module) audit();
module.exports = { checks };

"use strict";

const { Pool } = require("pg");

const ACCOUNT_CHECK_SQL = `
SELECT current_user AS username, r.rolsuper, r.rolcreatedb, r.rolcreaterole,
       r.rolreplication, r.rolbypassrls,
       pg_has_role(current_user, 'vg_owner', 'MEMBER') AS member_of_owner,
       has_database_privilege(current_user, current_database(), 'CREATE') AS can_create_schema,
       has_schema_privilege(current_user, 'vg', 'CREATE') AS can_create_objects
FROM pg_catalog.pg_roles r WHERE r.rolname = current_user`;

function createDatabase(configuration, { PoolClass = Pool, logger = console } = {}) {
  if (!configuration) return null;
  if (configuration.user !== "vg_app") throw new Error("Compte applicatif vg_app requis.");
  const pool = new PoolClass({
    ...configuration, max: 5, idleTimeoutMillis: 10000, connectionTimeoutMillis: 5000,
    statement_timeout: 5000, query_timeout: 6000, application_name: "vite-et-gourmand"
  });
  // Ne jamais journaliser l'erreur brute : elle peut contenir hôte, compte ou SQL.
  pool.on("error", () => logger.error("Connexion PostgreSQL interrompue."));
  return {
    async query(text, values = []) {
      let client;
      let discard = false;
      try {
        client = await pool.connect();
        const { rows } = await client.query(ACCOUNT_CHECK_SQL);
        const account = rows[0];
        if (!account || account.username !== "vg_app" ||
          ["rolsuper", "rolcreatedb", "rolcreaterole", "rolreplication", "rolbypassrls",
            "member_of_owner", "can_create_schema", "can_create_objects"].some((key) => account[key] !== false)) {
          throw new Error("Compte non autorisé");
        }
        return await client.query(text, values);
      } catch {
        discard = true;
        throw new Error("PostgreSQL indisponible.");
      } finally {
        if (client) client.release(discard);
      }
    },
    close() { return pool.end(); }
  };
}

module.exports = { createDatabase, ACCOUNT_CHECK_SQL };

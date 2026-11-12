"use strict";

const path = require("node:path");

function loadEnvironment(file = path.join(__dirname, "../.env")) {
  try { process.loadEnvFile(file); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
}

function readConfig(env = process.env) {
  const port = (name, fallback) => {
    const value = env[name] ?? String(fallback);
    if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535) {
      throw new Error(`${name} doit être un port entre 1 et 65535.`);
    }
    return Number(value);
  };
  const server = { host: env.HOST || "127.0.0.1", port: port("PORT", 3000) };
  // Sans configuration : serveur statique disponible, endpoints DB en erreur 503.
  const supplied = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD", "DB_SSL"];
  if (!supplied.some((name) => env[name] !== undefined)) return { server, database: null };
  const required = (name) => {
    if (!env[name]?.trim()) throw new Error(`${name} est requis pour configurer PostgreSQL.`);
    return env[name];
  };
  const user = required("DB_USER");
  if (user !== "vg_app") {
    throw new Error("DB_USER doit être le compte applicatif vg_app, sans droits d'administration.");
  }
  const ssl = env.DB_SSL ?? "false";
  if (!["true", "false"].includes(ssl)) throw new Error("DB_SSL doit valoir true ou false.");
  const host = required("DB_HOST");
  if (ssl === "false" && !["127.0.0.1", "localhost", "::1"].includes(host)) {
    throw new Error("DB_SSL=true est requis pour un serveur PostgreSQL distant.");
  }
  return {
    server,
    database: {
      host, port: port("DB_PORT", 5432),
      database: required("DB_NAME"), user,
      password: required("DB_PASSWORD"),
      ssl: ssl === "true" ? { rejectUnauthorized: true } : false,
      options: "-c search_path=vg,pg_catalog", connectionTimeoutMillis: 5000
    }
  };
}

module.exports = { loadEnvironment, readConfig };

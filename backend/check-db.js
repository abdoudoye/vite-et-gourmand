"use strict";

const { loadEnvironment, readConfig } = require("./config.js");
const { createDatabase } = require("./database.js");
const { getMenus } = require("./menus-repository.js");

async function check() {
  let database;
  try {
    loadEnvironment();
    database = createDatabase(readConfig().database);
    if (!database) throw new Error("Configuration absente");
    await database.query("SELECT 1 AS ok");
    const menus = await getMenus(database);
    console.log(`Connexion applicative vérifiée : ${menus.length} menus fictifs chargés.`);
  } catch {
    console.error("Vérification impossible. Vérifiez le fichier .env local, PostgreSQL et les droits de vg_app.");
    process.exitCode = 1;
  } finally {
    if (database) {
      try { await database.close(); }
      catch { console.error("Fermeture de la connexion impossible."); process.exitCode = 1; }
    }
  }
}
check();

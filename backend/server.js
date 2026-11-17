
"use strict";

const { loadEnvironment, readConfig } = require("./config.js");
const { createDatabase } = require("./database.js");
const { createApp } = require("./app.js");
const { readEmailConfig, createWelcomeMailer } = require("./welcome-email.js");

function start() {
  loadEnvironment();
  const config = readConfig();
  const mailer = createWelcomeMailer(readEmailConfig());
  const database = createDatabase(config.database);
  const server = createApp({ database, mailer }).listen(config.server.port, config.server.host, () => {
    console.log(`Serveur démarré sur http://${config.server.host}:${config.server.port}`);
  });
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    const timeout = setTimeout(() => process.exit(1), 10000);
    timeout.unref();
    server.close(async () => {
      try { if (database) await database.close(); }
      catch { process.exitCode = 1; }
      finally { clearTimeout(timeout); }
    });
  };
  server.on("error", () => {
    console.error("Impossible de démarrer le serveur HTTP. Vérifiez l'adresse et le port.");
    process.exitCode = 1;
    shutdown();
  });
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  return { server, database };
}

if (require.main === module) {
  try { start(); }
  catch { console.error("Configuration invalide. Vérifiez les variables du fichier .env local."); process.exitCode = 1; }
}
module.exports = { start };

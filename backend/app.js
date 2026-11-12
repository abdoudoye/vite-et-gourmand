"use strict";

const express = require("express");
const path = require("node:path");
const { getMenus } = require("./menus-repository.js");

// Chemin absolu basé sur ce fichier, indépendant du dossier de lancement de Node.
const frontendDirectory = path.resolve(__dirname, "..", "frontend");

function createApp({ database = null } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use("/api", (_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
  app.get("/api/health/db", async (_req, res) => {
    try {
      if (!database) throw new Error("Configuration absente");
      await database.query("SELECT 1 AS ok");
      res.json({ status: "ok" });
    } catch {
      res.status(503).json({ status: "unavailable" });
    }
  });
  app.get("/api/menus", async (_req, res) => {
    try {
      if (!database) throw new Error("Configuration absente");
      res.json(await getMenus(database));
    } catch {
      res.status(503).json({ error: "Catalogue indisponible. Réessayez plus tard." });
    }
  });
  app.use("/api", (_req, res) => res.status(404).json({ error: "Ressource introuvable." }));
  app.use(express.static(frontendDirectory));
  app.get("/", (_req, res) => res.send("Bienvenue sur Vite & Gourmand !"));
  return app;
}

module.exports = { createApp };

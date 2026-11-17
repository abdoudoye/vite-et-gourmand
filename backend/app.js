"use strict";

const express = require("express");
const path = require("node:path");
const { getMenus } = require("./menus-repository.js");
const { registrationHandler } = require("./registration.js");
const { readSessionConfig, createSession, sameOriginMutation } = require("./auth-session.js");
const { authHandlers } = require("./auth.js");
const { orderHandlers } = require("./orders.js");
const { readOrderConfig } = require("./order-rules.js");
const { employeeOrderHandlers } = require("./employee-orders.js");
const { adminHandlers } = require("./admin.js");
const { reviewHandlers } = require("./reviews.js");

// Chemin absolu basé sur ce fichier, indépendant du dossier de lancement de Node.
const frontendDirectory = path.resolve(__dirname, "..", "frontend");

function createApp({ database = null, mailer = null, sessionConfig = readSessionConfig(), sessionStore, orderConfig = readOrderConfig(), now } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", sessionConfig.trustProxy || false);
  app.use("/api", (_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
  app.post("/api/auth/register", express.json({ limit: "16kb" }), registrationHandler({ database, mailer }));
  const sessions = createSession({ config: sessionConfig, database, store: sessionStore });
  const auth = authHandlers({ database, clearCookie: sessions.clear, now });
  const mutation = sameOriginMutation(sessionConfig);
  app.post("/api/auth/login", mutation, express.json({ limit: "2kb" }), sessions.middleware, auth.login);
  app.get("/api/auth/me", sessions.middleware, auth.me);
  app.post("/api/auth/logout", mutation, sessions.middleware, auth.logout);
  const orders = orderHandlers({ database, config: orderConfig, mailer, now });
  app.get("/api/orders/checkout", sessions.middleware, orders.checkout);
  app.post("/api/orders/quote", mutation, express.json({ limit: "8kb" }), sessions.middleware, orders.quote);
  app.post("/api/orders/:id/quote", mutation, express.json({ limit: "8kb" }), sessions.middleware, orders.quote);
  app.post("/api/orders/:id/cancel", mutation, express.json({ limit: "2kb" }), sessions.middleware, orders.cancel);
  app.post("/api/orders", mutation, express.json({ limit: "2kb" }), sessions.middleware, orders.create);
  app.get("/api/orders", sessions.middleware, orders.list);
  app.get("/api/orders/:id", sessions.middleware, orders.detail);
  const employee = employeeOrderHandlers({ database, now });
  app.get("/api/employee/orders", sessions.middleware, employee.list);
  app.get("/api/employee/orders/:id", sessions.middleware, employee.detail);
  app.post("/api/employee/orders/:id/decision", mutation, express.json({ limit:"4kb" }), sessions.middleware, employee.decision);
  const admin = adminHandlers({ database, mailer, now });
  app.get("/api/admin/dashboard", sessions.middleware, admin.dashboard);
  app.get("/api/admin/employees", sessions.middleware, admin.employees);
  app.post("/api/admin/employees", mutation, express.json({limit:"4kb"}), sessions.middleware, admin.createEmployee);
  app.post("/api/admin/employees/:id/deactivate", mutation, express.json({limit:"1kb"}), sessions.middleware, admin.deactivateEmployee);
  app.get("/api/admin/menus", sessions.middleware, admin.menus);
  app.get("/api/admin/references", sessions.middleware, admin.references);
  app.post("/api/admin/menus/:id", mutation, express.json({limit:"48kb"}), sessions.middleware, admin.updateMenu);
  app.get("/api/admin/reviews", sessions.middleware, admin.reviews);
  app.post("/api/admin/reviews/:id/moderate", mutation, express.json({limit:"1kb"}), sessions.middleware, admin.moderateReview);
  const reviews = reviewHandlers({ database, now });
  app.post("/api/orders/:id/review", mutation, express.json({limit:"16kb"}), sessions.middleware, reviews.create);
  app.get("/api/reviews", reviews.publicList);
  app.use((error, _req, res, next) => {
    if (error.type === "entity.too.large") return res.status(413).json({ error: "Formulaire trop volumineux." });
    if (error.type === "entity.parse.failed") return res.status(400).json({ error: "JSON invalide." });
    // Ne jamais journaliser d'erreur de session brute ou exposer de pile/SQL.
    res.status(503).json({ error: "Service indisponible. Réessayez plus tard." });
  });
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

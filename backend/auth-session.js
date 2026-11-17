"use strict";

const session = require("express-session");
const { randomBytes, createHash } = require("node:crypto");
const SESSION_DURATION = 2 * 60 * 60 * 1000;

function readSessionConfig(env = process.env) {
  const production = env.NODE_ENV === "production";
  const mode = env.SESSION_STORE || (production ? "postgres" : "memory");
  if (!["memory", "postgres"].includes(mode) || (production && mode !== "postgres")) throw new Error("Stockage de session invalide.");
  const secret = env.SESSION_SECRET || (production ? "" : randomBytes(32).toString("hex"));
  if (secret.length < 32) throw new Error("SESSION_SECRET doit contenir au moins 32 caractères.");
  let origin = env.APP_ORIGIN || "";
  if (origin) {
    const url = new URL(origin);
    if (!["http:", "https:"].includes(url.protocol) || url.origin !== origin) throw new Error("APP_ORIGIN invalide.");
  }
  if (production && !origin.startsWith("https://")) throw new Error("APP_ORIGIN HTTPS requis en production.");
  const proxy = env.TRUST_PROXY_HOPS || "0";
  if (!["0", "1"].includes(proxy)) throw new Error("TRUST_PROXY_HOPS doit valoir 0 ou 1.");
  return { production, mode, secret, origin, trustProxy: Number(proxy) };
}

const digest = (sid) => createHash("sha256").update(sid).digest("hex");

// Sessions locales bornées ; pas de données personnelles ni de mot de passe dans le store.
class LocalSessionStore extends session.Store {
  constructor({ now = Date.now, maximum = 1000 } = {}) { super(); this.entries = new Map(); this.now = now; this.maximum = maximum; }
  get(sid, callback) {
    const key = digest(sid);
    const entry = this.entries.get(key);
    if (entry && entry.expires <= this.now()) this.entries.delete(key);
    callback(null, entry && entry.expires > this.now() ? JSON.parse(entry.data) : null);
  }
  set(sid, data, callback) {
    for (const [key, entry] of this.entries) if (entry.expires <= this.now()) this.entries.delete(key);
    const key = digest(sid);
    if (!this.entries.has(key) && this.entries.size >= this.maximum) return callback(new Error("Sessions indisponibles."));
    this.entries.set(key, { data: JSON.stringify(data), expires: Math.min(new Date(data.cookie.expires).getTime(), data.loggedAt + SESSION_DURATION) });
    callback(null);
  }
  destroy(sid, callback) { this.entries.delete(digest(sid)); callback(null); }
}

class PostgresSessionStore extends session.Store {
  constructor(database) { super(); this.database = database; }
  get(sid, callback) {
    this.database.query("SELECT session_data FROM vg.web_sessions WHERE sid_digest=$1 AND expires_at>now()", [digest(sid)])
      .then(({ rows }) => callback(null, rows[0]?.session_data || null), () => callback(new Error("Sessions indisponibles.")));
  }
  set(sid, data, callback) {
    const expires = new Date(Math.min(new Date(data.cookie.expires).getTime(), data.loggedAt + SESSION_DURATION));
    this.database.query(`INSERT INTO vg.web_sessions (sid_digest, session_data, expires_at) VALUES ($1,$2::jsonb,$3)
      ON CONFLICT (sid_digest) DO UPDATE SET session_data=EXCLUDED.session_data, expires_at=EXCLUDED.expires_at`,
    [digest(sid), JSON.stringify(data), expires])
      .then(() => callback(null), () => callback(new Error("Sessions indisponibles.")));
  }
  destroy(sid, callback) {
    this.database.query("DELETE FROM vg.web_sessions WHERE sid_digest=$1", [digest(sid)])
      .then(() => callback(null), () => callback(new Error("Sessions indisponibles.")));
  }
}

function createSession({ config, database, store }) {
  if (!store && config.mode === "postgres" && !database) throw new Error("PostgreSQL requis pour les sessions.");
  const cookie = { httpOnly: true, sameSite: "lax", secure: config.production, path: "/", maxAge: SESSION_DURATION };
  const name = config.production ? "__Host-vg.sid" : "vg.sid";
  const middleware = session({ name, secret: config.secret, resave: false, saveUninitialized: false,
    rolling: false, cookie, store: store || (config.mode === "postgres" ? new PostgresSessionStore(database) : new LocalSessionStore()) });
  const clear = (res) => res.clearCookie(name, { httpOnly: true, sameSite: "lax", secure: config.production, path: "/" });
  return { middleware, clear };
}

// Un en-tête non simple bloque les formulaires et fetch inter-origines sans CORS.
// Origin et Fetch Metadata ajoutent une vérification contre les requêtes CSRF.
function sameOriginMutation(config) {
  return (req, res, next) => {
    const origin = req.get("Origin");
    const expected = config.origin || `${req.protocol}://${req.get("host")}`;
    if (req.get("X-Requested-With") !== "ViteGourmand" ||
        (origin && origin !== expected) || req.get("Sec-Fetch-Site") === "cross-site") {
      return res.status(403).json({ error: "Requête non autorisée." });
    }
    if (config.production && !req.secure) return res.status(503).json({ error: "Connexion sécurisée requise." });
    next();
  };
}

module.exports = { readSessionConfig, createSession, sameOriginMutation, LocalSessionStore, PostgresSessionStore, SESSION_DURATION };

"use strict";

const argon2 = require("argon2");
const { randomBytes } = require("node:crypto");
const { SESSION_DURATION } = require("./auth-session.js");

const LOGIN_SQL = `SELECT id::text, first_name, last_name, email, role_code, is_active, deactivated_at, password_hash
  FROM vg.users WHERE lower(email)=$1`;
const ME_SQL = `SELECT id::text, first_name, last_name, email, role_code, is_active, deactivated_at
  FROM vg.users WHERE id=$1`;
const INVALID = { error: "Email ou mot de passe incorrect." };
let dummyHash;
function getDummyHash() {
  // Même vérification coûteuse pour un email absent ; aucun compte factice créé.
  if (!dummyHash) dummyHash = argon2.hash(randomBytes(32), { type: argon2.argon2id,
    memoryCost: 65536, timeCost: 3, parallelism: 1 }).catch((error) => { dummyHash = null; throw error; });
  return dummyHash;
}
const eligible = (user) => user && ["utilisateur", "employe", "administrateur"].includes(user.role_code) && user.is_active === true && user.deactivated_at === null;
const publicUser = (user) => ({ id: String(user.id), firstName: user.first_name, lastName: user.last_name, email: user.email, role: user.role_code });
const perform = (session, action) => new Promise((resolve, reject) => session[action]((error) => error ? reject(error) : resolve()));

function authHandlers({ database, clearCookie, now = Date.now }) {
  const attempts = new Map();
  let active = 0;
  const unavailable = (res) => res.status(503).json({ error: "Authentification indisponible. Réessayez plus tard." });
  return {
    async login(req, res) {
      if (!req.is("application/json")) return res.status(415).json({ error: "Format JSON requis." });
      const time = now();
      for (const [key, entry] of attempts) if (entry.until <= time) attempts.delete(key);
      const entry = attempts.get(req.ip) || { count: 0, until: time + 15 * 60 * 1000 };
      if (entry.count >= 10 || active >= 2 || (!attempts.has(req.ip) && attempts.size >= 10000)) {
        res.set("Retry-After", "900");
        return res.status(429).json({ error: "Trop de demandes. Réessayez plus tard." });
      }
      entry.count++; attempts.set(req.ip, entry);
      const { email, password } = req.body || {};
      if (typeof email !== "string" || email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
          typeof password !== "string" || !password.length || password.length > 128) return res.status(401).json(INVALID);
      if (!database) return unavailable(res);
      active++;
      let creatingSession = false;
      try {
        const fallback = await getDummyHash();
        const { rows } = await database.query(LOGIN_SQL, [email.trim().toLowerCase()]);
        const user = rows[0];
        const hash = typeof user?.password_hash === "string" && user.password_hash.startsWith("$argon2id$") ? user.password_hash : fallback;
        let valid = false;
        try { valid = await argon2.verify(hash, password); }
        catch { await argon2.verify(fallback, password); }
        if (!valid || hash === fallback || !eligible(user)) return res.status(401).json(INVALID);
        await perform(req.session, "regenerate");
        creatingSession = true;
        req.session.userId = String(user.id);
        req.session.loggedAt = time;
        await perform(req.session, "save");
        res.json({ user: publicUser(user) });
      } catch {
        if (creatingSession) {
          try { await perform(req.session, "destroy"); } catch { /* Réponse générique, sans journaliser le store. */ }
          req.session = null;
          clearCookie(res);
        }
        unavailable(res);
      }
      finally { active--; }
    },
    async me(req, res) {
      if (!req.session.userId) return res.status(401).json({ error: "Authentification requise." });
      try {
        if (!database) return unavailable(res);
        const { rows } = await database.query(ME_SQL, [req.session.userId]);
        if (!eligible(rows[0]) || !Number.isFinite(req.session.loggedAt) || now() - req.session.loggedAt >= SESSION_DURATION) {
          await perform(req.session, "destroy"); clearCookie(res);
          return res.status(401).json({ error: "Authentification requise." });
        }
        res.json({ user: publicUser(rows[0]) });
      } catch { unavailable(res); }
    },
    async logout(req, res) {
      try {
        await perform(req.session, "destroy");
        clearCookie(res);
        res.status(204).end();
      } catch { unavailable(res); }
    }
  };
}

module.exports = { LOGIN_SQL, ME_SQL, authHandlers };

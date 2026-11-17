"use strict";

const argon2 = require("argon2");

// Une seule instruction : PostgreSQL annule aussi le compte si l'adresse ou l'email échoue.
// ON CONFLICT protège également deux inscriptions simultanées avec le même email.
const REGISTER_SQL = `WITH new_user AS (
  INSERT INTO vg.users (role_code, first_name, last_name, email, phone, password_hash, is_active)
  VALUES ('utilisateur', $1, $2, $3, $4, $5, true)
  ON CONFLICT (lower(email)) DO NOTHING RETURNING id, email
), new_address AS (
  INSERT INTO vg.addresses (user_id, street, additional_line, postal_code, city, country_code, is_default)
  SELECT id, $6, $7, $8, $9, $10, true FROM new_user
), welcome AS (
  INSERT INTO vg.email_outbox (user_id, kind, recipient)
  SELECT id, 'bienvenue', email FROM new_user RETURNING id, recipient
) SELECT id, recipient FROM welcome`;

function validateRegistration(body) {
  const errors = {};
  const data = {};
  if (!body || typeof body !== "object" || Array.isArray(body)) body = {};
  const text = (key, max, optional = false) => {
    const value = typeof body[key] === "string" ? body[key].trim() : "";
    if ((!value && !optional) || value.length > max || /[\p{Cc}\p{Cf}<>]/u.test(value)) {
      errors[key] = "Renseignez une valeur valide (sans balise ni caractère de contrôle).";
    }
    data[key] = value;
  };
  for (const key of ["firstName", "lastName", "city"]) text(key, 100);
  text("street", 200);
  text("additionalLine", 200, true);
  text("postalCode", 20);
  text("countryCode", 2);
  text("email", 254);
  data.email = data.email.toLowerCase();
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(data.email)) {
    errors.email = "Renseignez une adresse email valide.";
  }
  text("phone", 30);
  if (!/^\+?[\d ().-]+$/.test(data.phone) || !/^\d{7,15}$/.test(data.phone.replace(/\D/g, ""))) {
    errors.phone = "Renseignez un téléphone contenant 7 à 15 chiffres.";
  }
  data.countryCode = data.countryCode.toUpperCase();
  if (!/^[A-Z]{2}$/.test(data.countryCode)) errors.countryCode = "Utilisez un code pays de deux lettres, par exemple FR.";
  if (!/^[\p{L}\p{N} -]{2,20}$/u.test(data.postalCode)) errors.postalCode = "Renseignez un code postal valide.";
  const password = body.password;
  if (typeof password !== "string" || password.length < 10 || password.length > 128 ||
      !/\p{Lu}/u.test(password) || !/\p{Ll}/u.test(password) || !/\d/.test(password) ||
      !/[^\p{L}\p{N}\s]/u.test(password) || /[\p{Cc}\p{Cf}]/u.test(password)) {
    errors.password = "Utilisez 10 à 128 caractères, avec majuscule, minuscule, chiffre et caractère spécial.";
  }
  if (typeof body.passwordConfirmation !== "string" || body.passwordConfirmation !== password) {
    errors.passwordConfirmation = "Les mots de passe doivent être identiques.";
  }
  return { data, errors };
}

function registrationHandler({ database, mailer = null }) {
  const attempts = new Map();
  let active = 0;
  return async (req, res) => {
    const now = Date.now();
    for (const [ip, entry] of attempts) if (entry.until <= now) attempts.delete(ip);
    const entry = attempts.get(req.ip) || { count: 0, until: now + 15 * 60 * 1000 };
    if (entry.count >= 10 || active >= 2 || (!attempts.has(req.ip) && attempts.size >= 10000)) {
      res.set("Retry-After", "900");
      return res.status(429).json({ error: "Trop de demandes. Réessayez plus tard." });
    }
    entry.count++;
    attempts.set(req.ip, entry);
    if (!req.is("application/json")) return res.status(415).json({ error: "Format JSON requis." });
    const { data, errors } = validateRegistration(req.body);
    if (Object.keys(errors).length) return res.status(400).json({ error: "Vérifiez les champs du formulaire.", errors });
    if (!database) return res.status(503).json({ error: "Inscription indisponible. Réessayez plus tard." });
    active++;
    try {
      const passwordHash = await argon2.hash(req.body.password, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
      const { rows } = await database.query(REGISTER_SQL, [data.firstName, data.lastName, data.email,
        data.phone, passwordHash, data.street, data.additionalLine || null, data.postalCode, data.city, data.countryCode]);
      if (!rows.length) return res.status(409).json({ error: "Inscription impossible avec ces informations." });
      let welcomeEmail = "disabled";
      if (mailer) {
        welcomeEmail = "pending";
        try {
          await mailer.sendWelcome(rows[0].recipient);
          await database.query("UPDATE vg.email_outbox SET status='envoye', sent_at=now(), attempts=attempts+1 WHERE id=$1", [rows[0].id]);
          welcomeEmail = "sent";
        } catch {
          // Le compte est créé : une panne SMTP ne doit pas inviter à le recréer.
          // L'événement reste en attente, sans journaliser les données personnelles.
        }
      }
      return res.status(201).json({ message: "Votre compte client a été créé.", welcomeEmail });
    } catch {
      return res.status(503).json({ error: "Inscription indisponible. Réessayez plus tard." });
    } finally { active--; }
  };
}

module.exports = { REGISTER_SQL, validateRegistration, registrationHandler };

"use strict";

const nodemailer = require("nodemailer");
const { orderConfirmationText } = require("./order-email.js");

function readEmailConfig(env = process.env) {
  const mode = env.EMAIL_MODE || "disabled";
  if (mode === "disabled") return null;
  if (mode !== "smtp") throw new Error("EMAIL_MODE doit valoir disabled ou smtp.");
  const required = (key) => {
    if (!env[key]?.trim() || /[\r\n]/.test(env[key])) throw new Error(`Configuration email invalide : ${key}.`);
    return env[key];
  };
  const host = required("SMTP_HOST");
  const port = Number(required("SMTP_PORT"));
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("SMTP_PORT invalide.");
  const from = required("SMTP_FROM");
  if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(from)) throw new Error("SMTP_FROM invalide.");
  const secure = env.SMTP_SECURE ?? "false";
  if (!["true", "false"].includes(secure)) throw new Error("SMTP_SECURE invalide.");
  return { from, transport: { host, port, secure: secure === "true", requireTLS: true,
    auth: { user: required("SMTP_USER"), pass: required("SMTP_PASSWORD") },
    tls: { rejectUnauthorized: true }, connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 10000 } };
}

function createWelcomeMailer(config, { createTransport = nodemailer.createTransport } = {}) {
  if (!config) return null; // Aucun transport, aucune connexion réseau en mode local par défaut.
  const transport = createTransport(config.transport);
  return { async sendOrderConfirmation(recipient, order) {
    const result = await transport.sendMail({ from: config.from, to: recipient,
      subject: "Confirmation de votre commande Vite & Gourmand", text: orderConfirmationText(order) });
    if (!result.accepted?.length || result.rejected?.length) throw new Error("Email non accepté.");
  }, async sendEmployeeCreated(recipient) {
    const result = await transport.sendMail({ from: config.from, to: recipient,
      subject: "Votre compte employé Vite & Gourmand", text: "Votre compte employé Vite & Gourmand a été créé. Contactez votre administrateur pour obtenir vos accès par un canal distinct. Aucun mot de passe n’est envoyé par email." });
    if (!result.accepted?.length || result.rejected?.length) throw new Error("Email non accepté.");
  }, async sendWelcome(recipient) {
    const result = await transport.sendMail({ from: config.from, to: recipient,
      subject: "Bienvenue chez Vite & Gourmand", text: "Bienvenue chez Vite & Gourmand ! Votre compte client a été créé.\nAucun mot de passe ne sera envoyé par email." });
    if (!result.accepted?.length || result.rejected?.length) throw new Error("Email non accepté.");
  } };
}

module.exports = { readEmailConfig, createWelcomeMailer };

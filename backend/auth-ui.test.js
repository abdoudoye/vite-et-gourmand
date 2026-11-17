"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { initLogin } = require("../frontend/connexion.js");

function page(fetcher) {
  const elements = new Map();
  const document = { getElementById: (id) => elements.get(id), focused: "" };
  for (const id of ["login-form", "connected", "auth-status", "auth-error", "user-name", "logout", "submit", "email", "password", "employee-space", "admin-space", "client-orders", "session-description"]) {
    elements.set(id, { hidden: true, value: "", textContent: "", disabled: false, attributes: {}, listeners: {},
      setAttribute(key, value) { this.attributes[key] = value; },
      addEventListener(event, handler) { this.listeners[event] = handler; },
      focus() { document.focused = id; }
    });
  }
  const form = elements.get("login-form");
  form.querySelector = () => elements.get("submit");
  form.reportValidity = () => true;
  form.reset = () => { elements.get("email").value = ""; elements.get("password").value = ""; };
  const ready = initLogin(document, fetcher);
  return { elements, document, ready,
    submit: () => form.listeners.submit({ preventDefault() {} }),
    logout: () => elements.get("logout").listeners.click() };
}
const response = (status, data) => ({ status, ok: status >= 200 && status < 300, json: async () => data });

test("connexion : lien vers l'espace employé uniquement pour employés et administrateurs", async () => {
  for(const role of ["utilisateur","employe","administrateur"]){
    const ui=page(async()=>response(200,{user:{role,firstName:"Compte",lastName:"Fictif"}}));await ui.ready;
    assert.equal(ui.elements.get("employee-space").hidden,role==="utilisateur");
    assert.equal(ui.elements.get("admin-space").hidden,role!=="administrateur");
    assert.equal(ui.elements.get("client-orders").hidden,role!=="utilisateur");
  }
});

test("interface : session existante affichée par texte, sans formulaire ni jeton manipulé", async () => {
  const ui = page(async (url, options) => {
    assert.equal(url, "/api/auth/me"); assert.equal(options.credentials, "same-origin");
    return response(200, { user: { firstName: "<script>texte</script>", lastName: "Fictif" } });
  });
  await ui.ready;
  assert.equal(ui.elements.get("login-form").hidden, true);
  assert.equal(ui.elements.get("connected").hidden, false);
  assert.equal(ui.elements.get("user-name").textContent, "<script>texte</script> Fictif");
});

test("interface : connexion JSON, anti-CSRF, double envoi bloqué, mot de passe effacé et déconnexion", async () => {
  let resolve;
  let calls = 0;
  const ui = page(async (url, options) => {
    calls++;
    if (url.endsWith("/me")) return response(401, {});
    assert.equal(options.headers["X-Requested-With"], "ViteGourmand");
    assert.equal(options.credentials, "same-origin");
    if (url.endsWith("/logout")) return response(204);
    assert.equal(JSON.parse(options.body).password, "ExempleFictif42!");
    return new Promise((done) => { resolve = done; });
  });
  await ui.ready;
  ui.elements.get("email").value = "ui@example.test";
  ui.elements.get("password").value = "ExempleFictif42!";
  const pending = ui.submit();
  assert.equal(ui.elements.get("submit").disabled, true);
  await ui.submit();
  assert.equal(calls, 2);
  resolve(response(200, { user: { firstName: "Client", lastName: "Fictif" } }));
  await pending;
  assert.equal(ui.elements.get("password").value, "");
  assert.equal(ui.document.focused, "auth-status");
  assert.equal(ui.elements.get("connected").hidden, false);
  await ui.logout();
  assert.equal(ui.elements.get("connected").hidden, true);
  assert.equal(ui.elements.get("user-name").textContent, "");
  assert.equal(ui.document.focused, "email");
  assert.equal(ui.elements.get("auth-status").textContent, "Vous êtes déconnecté.");
});

test("interface : erreur générique de connexion et panne de déconnexion gardent un état compréhensible", async () => {
  const ui = page(async (url) => url.endsWith("/me") ? response(401, {}) : response(401, { error: "Email ou mot de passe incorrect." }));
  await ui.ready;
  ui.elements.get("password").value = "fictif";
  await ui.submit();
  assert.equal(ui.elements.get("auth-error").textContent, "Email ou mot de passe incorrect.");
  assert.equal(ui.elements.get("password").value, "");
  assert.equal(ui.document.focused, "auth-error");
  const online = page(async (url) => {
    if (url.endsWith("/me")) return response(200, { user: { firstName: "Client", lastName: "Fictif" } });
    throw new Error("Réseau");
  });
  await online.ready; await online.logout();
  assert.equal(online.elements.get("connected").hidden, false);
  assert.match(online.elements.get("auth-error").textContent, /pas pu être confirmée/);
});

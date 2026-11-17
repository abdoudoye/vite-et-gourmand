"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { initRegistration } = require("../frontend/inscription.js");

// Doublure DOM légère pour vérifier les effets visibles, sans écrire en base.
function page(fetcher) {
  const elements = new Map();
  const make = (name, value = "") => {
    const listeners = {};
    const attributes = {};
    const element = { name, value, textContent: "", disabled: false, validity: "",
      addEventListener: (event, handler) => { listeners[event] = handler; },
      setAttribute: (key, value) => { attributes[key] = value; },
      removeAttribute: (key) => { delete attributes[key]; },
      setCustomValidity(message) { this.validity = message; },
      focus() { document.focused = name; }, attributes, listeners };
    elements.set(name, element);
    return element;
  };
  const values = { firstName: "Client", lastName: "Fictif", email: "ui@example.test", phone: "0612345678",
    street: "1 rue Fictive", additionalLine: "", postalCode: "33000", city: "Bordeaux", countryCode: "FR",
    password: "ExempleFictif42!", passwordConfirmation: "ExempleFictif42!" };
  const fields = Object.entries(values).map(([name, value]) => make(name, value));
  for (const field of fields) make(`${field.name}-error`);
  make("form-error"); make("form-status");
  const button = make("submit");
  const form = make("registration-form");
  form.elements = { namedItem: (name) => elements.get(name) };
  form.querySelector = () => button;
  form.querySelectorAll = () => fields;
  form.reportValidity = () => fields.every((field) => !field.validity);
  form.reset = () => { for (const field of fields) field.value = ""; };
  const document = { getElementById: (name) => elements.get(name), focused: null };
  initRegistration(document, fetcher);
  return { elements, document, submit: () => form.listeners.submit({ preventDefault() {} }) };
}

test("formulaire : JSON, blocage du double envoi, succès annoncé et mots de passe effacés", async () => {
  let resolve;
  let calls = 0;
  const ui = page(async (url, options) => {
    calls++;
    assert.equal(url, "/api/auth/register");
    assert.equal(options.method, "POST");
    assert.equal(options.headers["Content-Type"], "application/json");
    assert.equal(JSON.parse(options.body).email, "ui@example.test");
    return new Promise((done) => { resolve = done; });
  });
  const pending = ui.submit();
  assert.equal(ui.elements.get("submit").disabled, true);
  assert.equal(ui.elements.get("registration-form").attributes["aria-busy"], "true");
  await ui.submit();
  assert.equal(calls, 1);
  resolve({ ok: true, json: async () => ({ welcomeEmail: "disabled" }) });
  await pending;
  assert.match(ui.elements.get("form-status").textContent, /créé.*désactivé/);
  assert.equal(ui.elements.get("password").value, "");
  assert.equal(ui.elements.get("passwordConfirmation").value, "");
  assert.equal(ui.document.focused, "form-status");
  assert.equal(ui.elements.get("submit").disabled, false);
});

test("formulaire : erreurs serveur associées aux champs et focus sur le premier champ invalide", async () => {
  const ui = page(async () => ({ ok: false, json: async () => ({ error: "Vérifiez les champs.", errors: { email: "Email invalide." } }) }));
  await ui.submit();
  assert.equal(ui.document.focused, "email");
  assert.equal(ui.elements.get("email").attributes["aria-invalid"], "true");
  assert.equal(ui.elements.get("email-error").textContent, "Email invalide.");
  assert.equal(ui.elements.get("password").value, "");
});

test("formulaire : panne réseau annoncée sans affirmer que la création a échoué", async () => {
  const ui = page(async () => { throw new Error("Réseau indisponible"); });
  await ui.submit();
  assert.match(ui.elements.get("form-error").textContent, /compte peut avoir été créé/);
  assert.equal(ui.document.focused, "form-error");
  assert.equal(ui.elements.get("password").value, "");
  assert.equal(ui.elements.get("submit").disabled, false);
});

test("formulaire : mot de passe faible ou confirmation différente empêchent l'envoi", async () => {
  let calls = 0;
  const ui = page(async () => { calls++; });
  ui.elements.get("passwordConfirmation").value = "Different42!";
  await ui.submit();
  assert.match(ui.elements.get("passwordConfirmation").validity, /identiques/);
  assert.equal(calls, 0);
  ui.elements.get("password").value = "sansmajuscule42!";
  ui.elements.get("passwordConfirmation").value = "sansmajuscule42!";
  ui.elements.get("password").listeners.input();
  await ui.submit();
  assert.match(ui.elements.get("password").validity, /majuscule/);
  assert.equal(calls, 0);
});

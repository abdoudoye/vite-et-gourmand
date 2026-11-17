"use strict";

function initRegistration(document, fetcher = fetch) {
  const form = document.getElementById("registration-form");
  const status = document.getElementById("form-status");
  const error = document.getElementById("form-error");
  const button = form.querySelector('button[type="submit"]');
  button.disabled = false;
  let busy = false;
  // Sans JavaScript, le bouton reste bloqué : ne jamais placer un mot de passe dans une URL.
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;
    error.textContent = "";
    status.textContent = "";
    const fields = Array.from(form.querySelectorAll("input"));
    for (const field of fields) {
      field.removeAttribute("aria-invalid");
      document.getElementById(`${field.name}-error`).textContent = "";
    }
    const data = Object.fromEntries(fields.map((field) => [field.name, field.value]));
    const password = form.elements.namedItem("password");
    const confirmation = form.elements.namedItem("passwordConfirmation");
    password.setCustomValidity(
      /\p{Lu}/u.test(data.password) && /\p{Ll}/u.test(data.password) && /\d/.test(data.password) &&
      /[^\p{L}\p{N}\s]/u.test(data.password) && !/[\p{Cc}\p{Cf}]/u.test(data.password)
        ? "" : "Ajoutez une majuscule, une minuscule, un chiffre et un caractère spécial.");
    confirmation.setCustomValidity(data.password === data.passwordConfirmation ? "" : "Les mots de passe doivent être identiques.");
    if (!form.reportValidity()) return;
    busy = true;
    button.disabled = true;
    form.setAttribute("aria-busy", "true");
    status.textContent = "Création du compte en cours…";
    try {
      const response = await fetcher("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const result = await response.json();
      if (!response.ok) {
        status.textContent = "";
        error.textContent = result.error || "Impossible de créer le compte. Réessayez plus tard.";
        let firstInvalid;
        for (const field of fields) {
          if (typeof result.errors?.[field.name] !== "string") continue;
          field.setAttribute("aria-invalid", "true");
          document.getElementById(`${field.name}-error`).textContent = result.errors[field.name];
          firstInvalid ||= field;
        }
        (firstInvalid || error).focus();
        return;
      }
      form.reset();
      status.textContent = "Votre compte client a été créé. " + (result.welcomeEmail === "sent"
        ? "L’email de bienvenue a été transmis au serveur de messagerie."
        : result.welcomeEmail === "disabled" ? "L’envoi d’email est désactivé sur cet environnement."
          : "L’email de bienvenue reste en attente d’envoi.");
      status.focus();
    } catch {
      status.textContent = "";
      error.textContent = "La réponse du serveur n’a pas pu être confirmée. Le compte peut avoir été créé ; évitez de renvoyer immédiatement le formulaire.";
      error.focus();
    } finally {
      password.value = "";
      confirmation.value = "";
      busy = false;
      button.disabled = false;
      form.setAttribute("aria-busy", "false");
    }
  });
  for (const name of ["password", "passwordConfirmation"]) {
    form.elements.namedItem(name).addEventListener("input", () => {
      form.elements.namedItem("password").setCustomValidity("");
      form.elements.namedItem("passwordConfirmation").setCustomValidity("");
    });
  }
}

if (typeof module !== "undefined") module.exports = { initRegistration };
if (typeof window !== "undefined") {
  const next = orderDestination(window.location.search);
  if (next) document.getElementById("login-link").href = `connexion.html?next=${encodeURIComponent(next)}`;
  initRegistration(document);
}

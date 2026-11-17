"use strict";

function initLogin(document, fetcher = fetch) {
  const form = document.getElementById("login-form");
  const connected = document.getElementById("connected");
  const status = document.getElementById("auth-status");
  const error = document.getElementById("auth-error");
  const name = document.getElementById("user-name");
  const logout = document.getElementById("logout");
  const submit = form.querySelector('button[type="submit"]');
  const email = document.getElementById("email");
  const password = document.getElementById("password");
  const next = typeof window !== "undefined" ? orderDestination(window.location.search) : null;
  const resume = document.getElementById("resume-order");
  const signup = document.getElementById("signup-link");
  const employeeSpace = document.getElementById("employee-space");
  const adminSpace = document.getElementById("admin-space");
  const clientOrders = document.getElementById("client-orders");
  const description = document.getElementById("session-description");
  if (next && signup) signup.href = `inscription.html?next=${encodeURIComponent(next)}`;
  let busy = false;
  function showUser(user) {
    if (user) {
      form.hidden = true; connected.hidden = false;
      name.textContent = `${user.firstName} ${user.lastName}`;
      const staff = ["employe","administrateur"].includes(user.role);
      status.textContent = staff ? "Vous êtes connecté à votre espace employé." : "Vous êtes connecté à votre compte client.";
      if (description) description.textContent = staff ? "Session employé ou administrateur active." : "Votre session client est active.";
      if (employeeSpace) employeeSpace.hidden = !staff;
      if (adminSpace) adminSpace.hidden = user.role !== "administrateur";
      if (user.role === "administrateur") status.textContent = "Vous êtes connecté à votre espace administrateur.";
      if (clientOrders) clientOrders.hidden = staff;
      if (resume) { resume.hidden = staff || !next; if (next && !staff) resume.href = next; }
    } else {
      form.hidden = false; connected.hidden = true; name.textContent = "";
      if (resume) resume.hidden = true;
      if (employeeSpace) employeeSpace.hidden = true;
      if (adminSpace) adminSpace.hidden = true;
      if (clientOrders) clientOrders.hidden = true;
      status.textContent = "Connectez-vous avec votre email et votre mot de passe.";
    }
  }
  const mutation = (body) => ({ method: "POST", credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-Requested-With": "ViteGourmand" }, body: JSON.stringify(body) });
  function setBusy(value) {
    busy = value; submit.disabled = value; logout.disabled = value;
    form.setAttribute("aria-busy", String(value));
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy || !form.reportValidity()) return;
    error.textContent = ""; status.textContent = "Connexion en cours…"; setBusy(true);
    try {
      const response = await fetcher("/api/auth/login", mutation({ email: email.value, password: password.value }));
      const result = await response.json();
      if (!response.ok) {
        status.textContent = ""; error.textContent = result.error || "Connexion impossible. Réessayez plus tard."; error.focus(); return;
      }
      form.reset(); showUser(result.user); status.focus();
    } catch {
      status.textContent = ""; error.textContent = "Le serveur ne répond pas. Réessayez plus tard."; error.focus();
    } finally { password.value = ""; setBusy(false); }
  });
  logout.addEventListener("click", async () => {
    if (busy) return;
    error.textContent = ""; status.textContent = "Déconnexion en cours…"; setBusy(true);
    try {
      const response = await fetcher("/api/auth/logout", mutation({}));
      if (!response.ok) throw new Error("Déconnexion impossible");
      showUser(null); status.textContent = "Vous êtes déconnecté."; email.focus();
    } catch {
      status.textContent = ""; error.textContent = "La déconnexion n’a pas pu être confirmée. Réessayez."; error.focus();
    } finally { password.value = ""; setBusy(false); }
  });
  async function loadSession() {
    setBusy(true);
    try {
      const response = await fetcher("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
      if (response.status === 401) { showUser(null); return; }
      if (!response.ok) throw new Error("Session indisponible");
      const result = await response.json(); showUser(result.user);
    } catch {
      showUser(null); status.textContent = "";
      error.textContent = "Impossible de vérifier votre session. Vous pouvez réessayer de vous connecter.";
    } finally { setBusy(false); }
  }
  return loadSession();
}

if (typeof module !== "undefined") module.exports = { initLogin };
if (typeof window !== "undefined") initLogin(document);

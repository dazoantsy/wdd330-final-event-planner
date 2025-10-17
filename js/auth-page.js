// /js/auth-page.js — handlers Sign in / Sign up / Reset (verrouillés sur l'URL canonique)
import { supabase } from "./api.js?v=20251017";

const AUTH_ABS = "https://dazoantsy.github.io/wdd330-final-event-planner/auth.html";

// Petites aides UI
const statusEl = document.getElementById("auth-status");
const emailEl  = document.getElementById("auth-email");
const passEl   = document.getElementById("auth-password");

function setStatus(msg, isErr = false) {
  if (!statusEl) return;
  statusEl.textContent = msg || "";
  statusEl.style.color = isErr ? "#b91c1c" : "#065f46";
}

document.getElementById("btn-signin")?.addEventListener("click", async () => {
  const email = (emailEl?.value || "").trim();
  const password = passEl?.value || "";
  if (!email || !password) { setStatus("Email and password are required.", true); return; }

  setStatus("Signing in…");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) { setStatus(error.message, true); return; }

  setStatus("Signed in. Redirecting…");
  // Accueil appli après login (ajuste si tu veux une autre page)
  location.replace("/wdd330-final-event-planner/event-planner/index.html?v=grade1");
});

document.getElementById("btn-signup")?.addEventListener("click", async () => {
  const email = (emailEl?.value || "").trim();
  const password = passEl?.value || "";
  if (!email || !password) { setStatus("Email and password are required.", true); return; }

  setStatus("Creating account…");
  // IMPORTANT : forcer l'URL de redirection vers /auth.html (ABSOLUE)
  const { error } = await supabase.auth.signUp(
    { email, password },
    { emailRedirectTo: AUTH_ABS }
  );
  if (error) { setStatus(error.message, true); return; }

  setStatus("Check your inbox to confirm your email.");
});

document.getElementById("btn-reset")?.addEventListener("click", async () => {
  const email = (emailEl?.value || "").trim();
  if (!email) { setStatus("Enter your email first.", true); return; }

  setStatus("Sending reset email…");
  // IMPORTANT : reset renvoie aussi vers /auth.html (ABSOLUE)
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: AUTH_ABS
  });
  if (error) { setStatus(error.message, true); return; }

  setStatus("Reset email sent. Check your inbox.");
});

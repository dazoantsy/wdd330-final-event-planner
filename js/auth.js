// /js/auth.js — header, callback Supabase, resend, garde d'accès (version corrigée)
import { supabase, getUserOrNull, rootIndexURL } from "./api.js?v=20251017";

// URL canonique d'auth pour tout le flux (signup/resend/reset, guards, sign-in/out)
const AUTH_ABS = "https://dazoantsy.github.io/wdd330-final-event-planner/auth.html";
const AUTH_URL = "/wdd330-final-event-planner/auth.html?v=20251017";

const els = {
  signInLink: null,
  signOutLink: null,
  userEmail: null,
  resendBtn: null,
  emailInput: null,
  statusEl: null,
};

function bindHeaderElements() {
  els.signInLink = document.querySelector('[data-action="sign-in"]');
  els.signOutLink = document.querySelector('[data-action="sign-out"]');
  els.userEmail  = document.querySelector('[data-el="user-email"]');
  els.resendBtn  = document.querySelector('[data-action="resend-confirmation"]');
  els.emailInput = document.getElementById("auth-email");     // <-- récupère l'email du formulaire
  els.statusEl   = document.getElementById("auth-status");
  return true;
}

function setHeaderState(user) {
  if (!els.signInLink || !els.signOutLink || !els.userEmail) return;
  if (user) {
    els.signInLink.style.display = "none";
    els.signOutLink.style.display = "";
    els.userEmail.textContent = user.email || "";
  } else {
    els.signInLink.style.display = "";
    els.signOutLink.style.display = "none";
    els.userEmail.textContent = "";
  }
}

async function onSignInClick(e) {
  e?.preventDefault();
  // Aller directement à la page d'auth canonique (évite d'atterrir sur la Home hors session)
  location.href = AUTH_URL;
}

async function onSignOutClick(e) {
  e?.preventDefault();
  try {
    await supabase.auth.signOut();
  } finally {
    setHeaderState(null);
    // Après sign out, ramener vers la page d'auth canonique
    location.replace(AUTH_URL);
  }
}

// Utilitaire: parse le hash (#k=v&k2=v2)
function parseHashParams() {
  if (!location.hash || location.hash.length < 2) return {};
  const h = location.hash.substring(1);
  return Object.fromEntries(
    h.split("&").map(p => {
      const [k, v] = p.split("=");
      return [decodeURIComponent(k), decodeURIComponent(v || "")];
    })
  );
}

// Traite le retour du lien email (succès/erreur), puis nettoie le hash
async function handleAuthCallback() {
  const params = parseHashParams();
  if (!params) return;

  if (params.error) {
    console.warn("Supabase auth error:", params);
    alert("Email confirmation failed: " + (params.error_description || params.error));
    history.replaceState({}, document.title, location.pathname + location.search);
    return;
  }

  // Si access_token présent, Supabase gère normalement la session automatiquement.
  if (params.access_token) {
    history.replaceState({}, document.title, location.pathname + location.search);
  }
}

function setStatus(msg, isErr = false) {
  if (!els.statusEl) return;
  els.statusEl.textContent = msg || "";
  els.statusEl.style.color = isErr ? "#b91c1c" : "#065f46";
}

async function setupResendIfPresent(user) {
  if (!els.resendBtn) return;

  els.resendBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      // 1) on prend l'email de la session SI dispo, sinon du champ formulaire
      let email = user?.email || (els.emailInput?.value || "").trim();
      if (!email) {
        alert("Please enter your email on the sign in/up form first.");
        return;
      }

      // désactiver pendant l'envoi
      els.resendBtn.disabled = true;
      setStatus("Sending confirmation email…");

      // 2) forcer la redirection vers auth.html (ABSOLUE) → évite tout 404
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: AUTH_ABS,
        },
      });

      if (error) throw error;
      setStatus("A new confirmation email has been sent.");
      alert("A new confirmation email has been sent to " + email + ".");
    } catch (err) {
      console.error(err);
      setStatus(err?.message || "Could not resend the confirmation email.", true);
      alert("Could not resend the confirmation email.");
    } finally {
      els.resendBtn.disabled = false;
    }
  });
}

// Si la page exige un email confirmé, on bloque l'accès
async function enforceConfirmedGuard(user) {
  const requiresConfirmed = document.body?.getAttribute("data-requires-confirmed") === "true";
  if (!requiresConfirmed) return;

  if (!user) {
    location.replace(AUTH_URL);
    return;
  }
  const confirmed = !!user.email_confirmed_at;
  if (!confirmed) {
    alert("Please confirm your email before accessing this page.");
    location.replace(AUTH_URL);
  }
}

async function waitForDOM(ms = 25, tries = 200) {
  for (let i = 0; i < tries; i++) {
    if (document.readyState === "interactive" || document.readyState === "complete") return;
    await new Promise(r => setTimeout(r, ms));
  }
}

(async function init() {
  await waitForDOM();
  bindHeaderElements();

  await handleAuthCallback();

  // État initial user/session
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user || await getUserOrNull();
  setHeaderState(user || null);

  // Listeners header
  els.signInLink?.addEventListener("click", onSignInClick);
  els.signOutLink?.addEventListener("click", onSignOutClick);

  // Resend si bouton présent
  await setupResendIfPresent(user || null);

  // Garde d'accès optionnelle par attribut <body data-requires-confirmed="true">
  await enforceConfirmedGuard(user || null);

  // Suivre les changements de session
  supabase.auth.onAuthStateChange((_evt, s) => {
    const u = s?.user || null;
    setHeaderState(u);
  });
}());

// js/auth-page.js — Login / Signup / Reset avec gestion "Email not confirmed"
// Corrige REDIRECT_URL pour GitHub Pages.  :contentReference[oaicite:1]{index=1}

import { supabase } from "./api.js";

const $ = (s) => document.querySelector(s);

const msg = $("#authMsg");
const tabLogin = $("#tabLogin");
const tabSignup = $("#tabSignup");
const loginForm = $("#loginForm");
const signupForm = $("#signupForm");

// Déduit le répertoire "racine" du dépôt GitHub Pages : "/<repo>/" ou "/"
function repoBase() {
    const parts = location.pathname.split("/").filter(Boolean);
    return parts.length ? `/${parts[0]}/` : "/";
}

// URL absolue (reset/confirm) qui fonctionne en local ET sur GitHub Pages
const REDIRECT_URL = `${location.origin}${repoBase()}auth.html`;

function showMsg(text, type = "info") {
    if (!msg) return;
    msg.textContent = text;
    msg.style.display = text ? "" : "none";
    msg.className = type === "error" ? "card" : "empty";
    if (type === "error") msg.style.borderColor = "#ef4444";
    console[type === "error" ? "error" : "log"]("[auth]", text);
}

function setTab(mode) {
    const login = mode === "login";
    if (loginForm) loginForm.style.display = login ? "" : "none";
    if (signupForm) signupForm.style.display = login ? "none" : "";
    tabLogin?.setAttribute("aria-pressed", String(login));
    tabSignup?.setAttribute("aria-pressed", String(!login));
    showMsg("");
}

// --- Bouton "Resend confirmation" injecté dynamiquement ---
let resendBtn;
function ensureResendBtn(email) {
    if (!resendBtn) {
        resendBtn = document.createElement("button");
        resendBtn.className = "btn";
        resendBtn.type = "button";
        resendBtn.textContent = "Resend confirmation";
        msg?.after(resendBtn);
        resendBtn.addEventListener("click", async () => {
            try {
                const { error } = await supabase.auth.resend({
                    type: "signup",
                    email: resendBtn.dataset.email,
                });
                if (error) throw error;
                showMsg("Confirmation e-mail renvoyé. Vérifie ta boîte (ou Spam).");
            } catch (err) {
                showMsg(err?.message || "Impossible de renvoyer l’e-mail.", "error");
            }
        });
    }
    if (resendBtn) resendBtn.dataset.email = email;
    resendBtn?.setAttribute("style", "");
}

// --- Sign in (email + password)
loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    showMsg("Connexion…");
    const email = $("#loginEmail")?.value?.trim();
    const password = $("#loginPassword")?.value;

    try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        console.log("[auth] signIn ok:", data);
        // depuis /auth.html à la racine du repo, ce relatif suffit :
        location.href = "event-planner/index.html";
    } catch (err) {
        const m = String(err?.message || "").toLowerCase();
        if (m.includes("email not confirmed")) {
            showMsg("E-mail non confirmé. Clique le lien de confirmation reçu, ou renvoie le ci-dessous.", "error");
            ensureResendBtn(email);
            return;
        }
        showMsg(err?.message || "Échec de la connexion.", "error");
    }
});

// --- Forgot password
$("#forgotBtn")?.addEventListener("click", async () => {
    const email = $("#loginEmail")?.value?.trim();
    if (!email) { showMsg("Entrez d’abord votre e-mail.", "error"); return; }
    try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: REDIRECT_URL,
        });
        if (error) throw error;
        showMsg("Lien de réinitialisation envoyé. Vérifie ta boîte (ou Spam).");
    } catch (err) {
        showMsg(err?.message || "Impossible d’envoyer le mail de réinitialisation.", "error");
    }
});

// --- Sign up (email + new password)
signupForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    showMsg("Création du compte…");

    const email = $("#signupEmail")?.value?.trim();
    const p1 = $("#signupPassword")?.value;
    const p2 = $("#signupPassword2")?.value;

    if (p1 !== p2) return showMsg("Les mots de passe ne correspondent pas.", "error");
    if (p1.length < 6) return showMsg("Mot de passe ≥ 6 caractères.", "error");

    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password: p1,
            options: { emailRedirectTo: REDIRECT_URL },
        });
        if (error) throw error;

        console.log("[auth] signUp ok:", data);

        if (!data.session) {
            // Confirmation exigée : l’utilisateur doit cliquer le lien reçu
            showMsg("Inscription réussie. Confirme l’e-mail pour pouvoir te connecter.");
            ensureResendBtn(email);
        } else {
            // (cas autoconfirm désactivé) connecté immédiatement
            location.href = "event-planner/index.html";
        }
    } catch (err) {
        showMsg(err?.message || "Échec de l’inscription.", "error");
    }
});

// Tabs + init
tabLogin?.addEventListener("click", () => setTab("login"));
tabSignup?.addEventListener("click", () => setTab("signup"));
document.addEventListener("DOMContentLoaded", () => setTab("login"));

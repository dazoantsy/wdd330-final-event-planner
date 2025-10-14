// /js/auth.js — gère header (Sign in/out) + écoute session
import { supabase, getUserOrNull, rootIndexURL } from "./api.js";

const els = { signInLink: null, signOutLink: null, userEmail: null };

function bindHeaderElements() {
    els.signInLink = document.querySelector('[data-action="sign-in"]');
    els.signOutLink = document.querySelector('[data-action="sign-out"]');
    els.userEmail = document.querySelector('[data-el="user-email"]');
    return !!(els.signInLink && els.signOutLink && els.userEmail);
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
    location.href = rootIndexURL(); // revient à la page d’auth simple
}

async function onSignOutClick(e) {
    e?.preventDefault();
    try { await supabase.auth.signOut(); } finally {
        setHeaderState(null);
        location.replace(rootIndexURL());
    }
}

async function waitForHeader() {
    for (let i = 0; i < 200; i++) {
        if (bindHeaderElements()) return;
        await new Promise(r => setTimeout(r, 25));
    }
}

(async function init() {
    await waitForHeader();
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user || await getUserOrNull();
    setHeaderState(user || null);
    els.signInLink?.addEventListener("click", onSignInClick);
    els.signOutLink?.addEventListener("click", onSignOutClick);
    supabase.auth.onAuthStateChange((_evt, s) => setHeaderState(s?.user || null));
}());

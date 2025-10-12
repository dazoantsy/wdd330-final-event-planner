// js/auth.js — Auth guard + header
// Garde ultra-précoce : si page protégée et AUCUNE session locale VALIDE → redirection immédiate vers l'index du dépôt.
// Puis garde "serveur" (supabase.auth.getSession) pour l'UI et les cas limites.

import { supabase } from "./api.js";
import { claimRsvpsForUser } from "./db.js";

const $ = (s, r = document) => r.querySelector(s);

/** Déduit la racine du dépôt (local vs GitHub Pages). */
function repoBase() {
    // ex local: /event-planner/index.html  → parts[0] = "event-planner" (ok)
    // ex local: /dashboard.html           → parts[0] = "dashboard.html" (fichier → on retourne "/")
    // GitHub Pages: /wdd330-final-event-planner/event-planner/index.html → "/wdd330-final-event-planner/"
    const parts = location.pathname.split("/").filter(Boolean);
    if (parts.length && /\.[a-z0-9]+$/i.test(parts[0])) return "/";
    return parts.length ? `/${parts[0]}/` : "/";
}

const INDEX_URL = new URL(`${repoBase()}index.html`, location.origin).href;
const ROOT = (document.body?.dataset?.root || "./").replace(/\/?$/, "/");

function mustAuthPage() {
    return document.body?.dataset?.requireAuth === "true";
}

/** Retourne true si une session Supabase VALIDE existe en localStorage (non expirée). */
function hasValidStoredSession() {
    try {
        const now = Math.floor(Date.now() / 1000);
        for (const k of Object.keys(localStorage)) {
            if (!/^sb-.*-auth-token$/.test(k)) continue;
            const raw = localStorage.getItem(k);
            if (!raw) continue;

            // Valeur attendue: {"currentSession":{"access_token":"...","expires_at":1699999999,...}, ...}
            const parsed = JSON.parse(raw);
            const s = parsed?.currentSession || parsed?.session || parsed;
            const token = s?.access_token;
            const exp = typeof s?.expires_at === "number" ? s.expires_at : null;

            if (token && exp && exp > now) return true; // session valide
        }
    } catch {
        // ignore
    }
    return false;
}

/* ==== Garde ULTRA-PRÉCOCE (bloque avant tout affichage) ==== */
if (mustAuthPage() && !hasValidStoredSession()) {
    // Redirection immédiate : pas de “tremblement”
    location.replace(INDEX_URL);
    // Stoppe l’exécution de ce module (évite de continuer à initialiser la page)
    throw new Error("Auth guard: redirecting to index.html");
}

/* ========================== Header / Sign out ========================== */

export async function getSession() {
    const { data } = await supabase.auth.getSession();
    return data?.session ?? null;
}

function updateHeaderUI(session) {
    const emailEl = $("#userEmail");
    if (emailEl) emailEl.textContent = session?.user?.email ?? "";

    const signOutLink = $("#signOutLink");
    if (signOutLink) {
        signOutLink.style.display = session?.user ? "inline" : "none";
        signOutLink.setAttribute("data-action", "signout");
        signOutLink.setAttribute("href", "#");
    }
}

async function doSignOut() {
    try { await supabase.auth.signOut(); } catch { /* ignore */ }
    finally {
        location.replace(INDEX_URL);
        setTimeout(() => {
            if (!/\/index\.html(\?|$)/.test(location.href)) location.href = INDEX_URL;
        }, 200);
    }
}
document.addEventListener("click", async (e) => {
    const t = e.target.closest?.("#signOutLink,[data-action='signout']");
    if (!t) return;
    e.preventDefault();
    await doSignOut();
}, true);

/* ========================== Garde “serveur” ========================== */

export async function requireAuthIfNeeded() {
    const need = mustAuthPage();
    let session = null;

    try { session = await getSession(); }
    catch {
        if (need) {
            location.replace(INDEX_URL);
            return null;
        }
    }

    // UI header (+ rattacher RSVP si besoin)
    try { updateHeaderUI(session); } catch { }
    claimRsvpsForUser().catch(() => { });

    if (need && !session?.user) {
        location.replace(INDEX_URL);
        return null;
    }
    return session;
}

export const requireAuth = requireAuthIfNeeded;

supabase.auth.onAuthStateChange((_ev, session) => {
    try { updateHeaderUI(session); } catch { }
    if (mustAuthPage() && !session?.user) location.replace(INDEX_URL);
});

/* Démarrage : vérification “serveur” (UI + cas limites) */
document.addEventListener("DOMContentLoaded", () => {
    requireAuthIfNeeded().catch(() => {
        if (mustAuthPage()) location.replace(INDEX_URL);
    });
});

/* Quand le header/footer sont injectés, on re-synchronise l’UI */
document.addEventListener("partials:ready", async () => {
    try {
        const { data } = await supabase.auth.getSession();
        updateHeaderUI(data?.session ?? null);
        if (mustAuthPage() && !data?.session?.user) location.replace(INDEX_URL);
    } catch {
        if (mustAuthPage()) location.replace(INDEX_URL);
    }
});

// Compat
export async function ensureDemoUser() { return null; }

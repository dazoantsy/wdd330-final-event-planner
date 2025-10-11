// js/auth.js — Auth guard + header + sign out fiable
import { supabase } from "./api.js";
import { claimRsvpsForUser } from "./db.js";

const $ = (s, r = document) => r.querySelector(s);
const AUTH_URL = `${location.origin}/auth.html`;

// ——— Helpers
function mustAuthPage() {
    return document.body?.dataset?.requireAuth === "true";
}
export async function getSession() {
    const { data } = await supabase.auth.getSession();
    return data?.session ?? null;
}

// ——— Header (email + sign out)
function updateHeaderUI(session) {
    const emailEl = $("#userEmail");
    if (emailEl) emailEl.textContent = session?.user?.email ?? "";

    const signOutLink = $("#signOutLink");
    if (signOutLink) {
        signOutLink.style.display = session?.user ? "inline" : "none";
        signOutLink.setAttribute("data-action", "signout");
        signOutLink.setAttribute("href", "javascript:void(0)");
    }
}

// ——— Sign out
async function doSignOut() {
    try { await supabase.auth.signOut(); } catch { }
    finally {
        location.replace(AUTH_URL);
        setTimeout(() => {
            if (!/\/auth\.html(\?|$)/.test(location.href)) location.href = AUTH_URL;
        }, 200);
    }
}
document.addEventListener("click", async (e) => {
    const t = e.target.closest?.("#signOutLink,[data-action='signout']");
    if (!t) return;
    e.preventDefault();
    await doSignOut();
}, true);

// ——— Guard
export async function requireAuthIfNeeded() {
    const need = mustAuthPage();
    const session = await getSession();

    updateHeaderUI(session);
    // rattache RSVP email -> user_id si besoin (sans effet si rien à faire)
    await claimRsvpsForUser().catch(() => { });

    if (need && !session?.user) {
        const ret = encodeURIComponent(location.pathname + location.search);
        location.replace(`${AUTH_URL}?return=${ret}`);
        return null;
    }
    return session;
}

// ——— Rester synchro
supabase.auth.onAuthStateChange((_ev, session) => {
    updateHeaderUI(session);
    if (mustAuthPage() && !session?.user) {
        const ret = encodeURIComponent(location.pathname + location.search);
        location.replace(`${AUTH_URL}?return=${ret}`);
    }
});

// ——— Init
getSession().then(updateHeaderUI).catch(() => { });

// ---- compatibility stub: some pages import ensureDemoUser from auth.js
export async function ensureDemoUser() {
    // No-op for this project; kept only to satisfy older imports
    return null;
}

// Quand header/footer sont injectés, refaire l'UI (évite la course)
document.addEventListener("partials:ready", async () => {
    try {
        const { data } = await supabase.auth.getSession();
        const session = data?.session ?? null;
        // réutilise ta fonction existante :
        updateHeaderUI(session);
    } catch { }
});

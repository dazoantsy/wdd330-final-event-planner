// js/accept.js — choix RSVP sur invitation
import { supabase } from "./api.js?v=20251017";
import { upsertRsvp } from "./db.js?v=20251017";

function getParam(name) {
    const u = new URL(location.href);
    return u.searchParams.get(name);
}

async function ensureSignedIn() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) return session;
    // pas connecté : redirige vers auth puis revient ici
    const ret = `/auth.html?return=${encodeURIComponent(location.href)}`;
    location.href = ret;
    return null;
}

async function main() {
    const token = getParam("token");
    const msg = document.getElementById("msg");
    if (!token) { msg.textContent = "Lien invalide."; return; }

    const session = await ensureSignedIn();
    if (!session) return;

    const { data: inv, error: e1 } = await supabase
        .from("invitations").select("*").eq("token", token).maybeSingle();
    if (e1 || !inv) { msg.textContent = "Invitation introuvable."; return; }

    const { data: ev } = await supabase
        .from("events").select("id,title").eq("id", inv.event_id).maybeSingle();

    const title = ev ? `Vous êtes invité à « ${ev.title} »` : `Événement #${inv.event_id}`;
    document.getElementById("eventTitle").textContent = title;
    document.getElementById("actions").style.display = "flex";

    async function choose(status) {
        msg.textContent = "Enregistrement…";
        try {
            await upsertRsvp(inv.event_id, { status });
            msg.textContent = "Réponse enregistrée ✅";
            setTimeout(() => (location.href = "/dashboard.html"), 600);
        } catch (err) {
            msg.textContent = "Erreur: " + (err?.message || "inconnue");
            console.error(err);
        }
    }

    document.getElementById("btnYes").onclick = () => choose("yes");
    document.getElementById("btnMaybe").onclick = () => choose("maybe");
    document.getElementById("btnNo").onclick = () => choose("no");
}

window.addEventListener("DOMContentLoaded", main);

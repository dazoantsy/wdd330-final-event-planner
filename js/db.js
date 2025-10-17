// js/db.js — accès données : events + rsvps (pas d'invitations)
import { supabase } from "./api.js?v=20251017";

const KEY = (uid) => `events:${uid}`;

// ——— Session
export async function getSessionSafe() {
    try {
        const { data } = await supabase.auth.getSession();
        return data?.session ?? null;
    } catch { return null; }
}

// ——— Cache local
function readCache(uid) {
    try { return JSON.parse(localStorage.getItem(KEY(uid)) || "[]"); }
    catch { return []; }
}
function writeCache(uid, list) {
    try { localStorage.setItem(KEY(uid), JSON.stringify(list)); } catch { }
}
function upsertInCache(uid, ev) {
    const list = readCache(uid);
    const i = list.findIndex(x => x.id === ev.id);
    if (i >= 0) list[i] = ev; else list.push(ev);
    writeCache(uid, list);
    return list;
}
export function wipeAllEventCaches() {
    Object.keys(localStorage).forEach(k => { if (k.startsWith("events:")) localStorage.removeItem(k); });
    localStorage.removeItem("events");
}

// ——— Events
export async function listEvents() {
    const s = await getSessionSafe();
    if (!s?.user?.id) return [];
    const uid = s.user.id;

    const cached = readCache(uid);
    try {
        const { data, error } = await supabase
            .from("events").select("*").eq("user_id", uid);
        if (error) throw error;
        if (Array.isArray(data)) writeCache(uid, data);
        return data ?? cached;
    } catch { return cached; }
}

/** owner ∪ events où l'utilisateur a un RSVP (user_id ou email) */
export async function listMyEvents() {
    const s = await getSessionSafe();
    const uid = s?.user?.id || null;
    const email = s?.user?.email || null;
    if (!uid && !email) return [];

    // possédés
    let owned = [];
    try {
        const { data } = await supabase.from("events").select("*").eq("user_id", uid);
        if (Array.isArray(data)) owned = data;
    } catch { }

    // events liés par RSVP
    const invitedIds = new Set();
    try {
        const { data } = await supabase.from("rsvps").select("event_id").eq("user_id", uid);
        if (Array.isArray(data)) data.forEach(r => invitedIds.add(r.event_id));
    } catch { }
    if (email) {
        try {
            const { data } = await supabase.from("rsvps").select("event_id").eq("email", email);
            if (Array.isArray(data)) data.forEach(r => invitedIds.add(r.event_id));
        } catch { }
    }

    let invited = [];
    const ids = [...invitedIds];
    if (ids.length) {
        try {
            const { data } = await supabase.from("events").select("*").in("id", ids);
            if (Array.isArray(data)) invited = data;
        } catch { }
    }

    const byId = new Map();
    owned.forEach(e => byId.set(e.id, e));
    invited.forEach(e => byId.set(e.id, e));
    const all = [...byId.values()];
    if (uid) writeCache(uid, all);
    return all;
}

/** ne filtre pas par user_id → policies RLS gèrent l’accès */
export async function getEvent(id) {
    const s = await getSessionSafe();
    const uid = s?.user?.id || "anon";
    const hit = readCache(uid)?.find?.(e => e.id === id);
    if (hit) return hit;

    try {
        const { data } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
        if (data) upsertInCache(uid, data);
        return data || null;
    } catch { return null; }
}

export async function upsertEvent(ev) {
    const s = await getSessionSafe();
    if (!s?.user?.id) throw new Error("Not authenticated");
    const uid = s.user.id;

    const normalized = {
        id: ev.id,
        user_id: uid,
        title: ev.title,
        type: ev.type || null,
        start_date: ev.startDate || ev.date || null,
        end_date: ev.endDate || ev.startDate || ev.date || null,
        time: ev.time || null,
        end_time: ev.endTime || ev.time || null,
        location: ev.location || null,
        notes: ev.notes || null,
    };

    upsertInCache(uid, normalized);

    try {
        const { data, error } = await supabase.from("events").upsert(normalized).select().single();
        if (error) throw error;
        upsertInCache(uid, data);
        return { data, synced: true };
    } catch (err) {
        console.warn("[events] upsert failed, kept in cache:", err?.message);
        return { data: normalized, synced: false };
    }
}

export async function removeEvent(id) {
    const s = await getSessionSafe();
    const uid = s?.user?.id || "anon";
    writeCache(uid, readCache(uid).filter(e => e.id !== id));
    try { await supabase.from("events").delete().eq("id", id); } catch { }
    return true;
}

// ——— RSVPs
export async function upsertRsvp(eventId, { status, guests = 1, note = "", email = null }) {
    const s = await getSessionSafe();
    const uid = s?.user?.id || null;

    try {
        if (uid) await supabase.from("rsvps").delete().eq("event_id", eventId).eq("user_id", uid);
        else if (email) await supabase.from("rsvps").delete().eq("event_id", eventId).eq("email", email);
    } catch { }

    const payload = {
        event_id: eventId,
        user_id: uid,
        email: uid ? null : email,
        status,
        guests: Math.max(1, Number(guests || 1)),
        note: note || null
    };

    const { error } = await supabase.from("rsvps").insert(payload);
    if (error) throw error;
    return true;
}

export async function listRsvps(eventId) {
    const { data, error } = await supabase.from("rsvps").select("*").eq("event_id", eventId);
    if (error) throw error;
    return data || [];
}

/** conversion RSVP email -> user_id après login (idempotent) */
export async function claimRsvpsForUser() {
    const s = await getSessionSafe();
    const uid = s?.user?.id || null;
    const email = s?.user?.email || null;
    if (!uid || !email) return false;

    try {
        const { error } = await supabase
            .from("rsvps")
            .update({ user_id: uid, email: null })
            .is("user_id", null)
            .eq("email", email);
        if (error) throw error;
        return true;
    } catch (e) {
        console.warn("[claimRsvpsForUser]", e?.message || e);
        return false;
    }
}

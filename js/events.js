// js/events.js — utilitaires + formats
export const LIST_KEY = "events";

export const qs = (k) => new URLSearchParams(location.search).get(k);
export const uid = () => (crypto.randomUUID?.() || Math.random().toString(36).slice(2));

const fmtD = new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "short", day: "2-digit" });
export function formatDate(d) { try { return fmtD.format(new Date(d)); } catch { return d || "—"; } }

export function formatDateRange(start, end) {
    if (!start && !end) return "—";
    if (!end || end === start) return formatDate(start);
    return `${formatDate(start)} → ${formatDate(end)}`;
}

export function formatTimeRange(start, end) {
    if (!start && !end) return "";
    if (!end || end === start) return start || "";
    return `${start}–${end}`;
}

// Normalise event (compat ancien schéma)
export function normalizeEvent(ev) {
    const start = ev.startDate || ev.start_date || ev.date || "";
    const end = ev.endDate || ev.end_date || ev.date || start || "";
    const time2 = ev.endTime || ev.end_time || ev.time || "";
    return { ...ev, startDate: start, endDate: end, endTime: time2 };
}

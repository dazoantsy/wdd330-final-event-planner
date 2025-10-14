// /js/events.js — petits helpers d’affichage
export const qs = (k) => new URLSearchParams(location.search).get(k);
const fmtD = new Intl.DateTimeFormat("en-GB", { year: "numeric", month: "short", day: "2-digit" });

export function formatDate(d) { try { return d ? fmtD.format(new Date(d)) : "—"; } catch { return d || "—"; } }

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

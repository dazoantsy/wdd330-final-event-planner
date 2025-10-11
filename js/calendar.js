// js/calendar.js — Google Calendar URL + .ics
function pad(n) { return String(n).padStart(2, "0"); }
function dtUTC(dateISO, timeHHMM) {
    const d = new Date(`${dateISO}T${(timeHHMM || "00:00")}:00`);
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}
export function googleCalendarUrl(ev) {
    const start = dtUTC(ev.startDate || ev.start_date || ev.date, ev.time || "00:00");
    const end = dtUTC(ev.endDate || ev.end_date || ev.startDate || ev.date, ev.endTime || ev.time || "00:00");
    const params = new URLSearchParams({
        action: "TEMPLATE",
        text: ev.title || "Event",
        dates: `${start}/${end}`,
        details: ev.notes || "",
        location: ev.location || ""
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
export function downloadIcs(ev) {
    const start = dtUTC(ev.startDate || ev.start_date || ev.date, ev.time || "00:00");
    const end = dtUTC(ev.endDate || ev.end_date || ev.startDate || ev.date, ev.endTime || ev.time || "00:00");
    const ics = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Event Planner//EN",
        "BEGIN:VEVENT",
        `UID:${ev.id || crypto.randomUUID()}@event-planner`,
        `DTSTAMP:${start}`,
        `DTSTART:${start}`,
        `DTEND:${end}`,
        `SUMMARY:${(ev.title || "").replace(/\n/g, " ")}`,
        `DESCRIPTION:${(ev.notes || "").replace(/\n/g, " ")}`,
        `LOCATION:${(ev.location || "").replace(/\n/g, " ")}`,
        "END:VEVENT",
        "END:VCALENDAR"
    ].join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(ev.title || "event").replace(/\s+/g, "_")}.ics`;
    document.body.appendChild(a);
    a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

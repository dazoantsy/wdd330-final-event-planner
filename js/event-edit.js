// js/event-edit.js — FULL FILE
// - Create / Edit form logic
// - Location autocomplete (geocode)
// - Weather button (Open-Meteo)
// - Save => upsertEvent() then redirect

import { supabase, geocode, fetchWeather } from "./api.js";
import { requireAuthIfNeeded } from "./auth.js";
import { getEvent, upsertEvent } from "./db.js";
import { qs, formatDate, normalizeEvent } from "./events.js";

// ---------- DOM helpers ----------
const $ = (s, r = document) => r.querySelector(s);
const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);
const fmtInputDate = (d) => {
    if (!d) return "";
    try {
        const x = new Date(d);
        const yyyy = x.getFullYear();
        const mm = String(x.getMonth() + 1).padStart(2, "0");
        const dd = String(x.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    } catch { return ""; }
};

// ---------- Elements ----------
const form = $("#eventForm");
const titleEl = $("#title");
const typeEl = $("#type");
const startDateEl = $("#startDate");
const endDateEl = $("#endDate");
const timeEl = $("#time");
const endTimeEl = $("#endTime");
const locationEl = $("#location");
const notesEl = $("#notes");
const saveBtn = $("#saveBtn");
const weatherBtn = $("#weatherBtn");

// ---------- Datalist for geocoding ----------
let geoList = $("#geoList");
if (!geoList) {
    geoList = document.createElement("datalist");
    geoList.id = "geoList";
    document.body.appendChild(geoList);
}
if (locationEl && !locationEl.getAttribute("list")) {
    locationEl.setAttribute("list", "geoList");
}

// ---------- Utilities ----------
function collectForm() {
    return {
        title: (titleEl?.value || "").trim(),
        type: (typeEl?.value || "").trim() || null,
        startDate: startDateEl?.value || null,
        endDate: endDateEl?.value || null,
        time: timeEl?.value || null,
        endTime: endTimeEl?.value || null,
        location: (locationEl?.value || "").trim() || null,
        notes: (notesEl?.value || "").trim() || null,
    };
}

function fillForm(ev) {
    const e = normalizeEvent(ev || {});
    if (titleEl) titleEl.value = e.title || "";
    if (typeEl) typeEl.value = e.type || "";
    if (startDateEl) startDateEl.value = fmtInputDate(e.startDate) || "";
    if (endDateEl) endDateEl.value = fmtInputDate(e.endDate) || "";
    if (timeEl) timeEl.value = e.time || "";
    if (endTimeEl) endTimeEl.value = e.endTime || "";
    if (locationEl) locationEl.value = e.location || "";
    if (notesEl) notesEl.value = e.notes || "";
}

// simple debounce
function debounce(fn, ms = 300) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), ms);
    };
}

// ---------- Geocode (autocomplete) ----------
const doGeocode = debounce(async () => {
    const q = (locationEl?.value || "").trim();
    if (!q) {
        geoList.innerHTML = "";
        return;
    }
    const results = await geocode(q);
    geoList.innerHTML = "";
    results.forEach((r) => {
        const opt = document.createElement("option");
        opt.value = r.label || `${r.lat}, ${r.lon}`;
        geoList.appendChild(opt);
    });
}, 350);

// ---------- Weather ----------
async function onWeather() {
    const q = (locationEl?.value || "").trim();
    if (!q) {
        alert("Enter a location first.");
        return;
    }

    // Essayons de géocoder d’abord pour obtenir lat/lon
    const res = await geocode(q);
    let coords = null;
    if (res && res.length) {
        coords = { lat: res[0].lat, lon: res[0].lon };
    } else {
        // petite tentative : si l'utilisateur tape "lat, lon"
        const m = q.match(/(-?\d+(\.\d+)?)\s*[,; ]\s*(-?\d+(\.\d+)?)/);
        if (m) coords = { lat: Number(m[1]), lon: Number(m[3]) };
    }

    if (!coords) {
        alert("Could not find this location.");
        return;
    }

    try {
        const w = await fetchWeather(coords);
        const parts = [];
        if (w.temperature != null) parts.push(`Temperature: ${w.temperature}°C`);
        if (w.windspeed != null) parts.push(`Wind: ${w.windspeed} km/h`);
        const txt = parts.length ? parts.join(" — ") : "No weather data.";
        alert(txt);
    } catch (e) {
        alert("Weather error.");
    }
}

// ---------- Save ----------
async function onSubmit(e) {
    e.preventDefault();
    saveBtn?.setAttribute("disabled", "disabled");

    try {
        const id = qs("id");
        const payload = collectForm();
        if (id) payload.id = id; // upsert conserve l'id pour édition

        // validation minimale
        if (!payload.title) {
            alert("Title is required.");
            return;
        }

        const { data } = await upsertEvent(payload);
        // Redirection après succès (qu'on ait sync ou pas)
        window.location.href = "./index.html";
    } catch (err) {
        console.error(err);
        alert("Save failed: " + (err?.message || err));
    } finally {
        saveBtn?.removeAttribute("disabled");
    }
}

// ---------- Boot ----------
async function boot() {
    // exige l'auth si la page est protégée
    await requireAuthIfNeeded?.();

    // Edition : charger l'event existant
    const id = qs("id");
    if (id) {
        try {
            const ev = await getEvent(id);
            if (!ev) {
                console.warn("Event not found for id:", id);
            } else {
                fillForm(ev);
            }
        } catch (e) {
            console.error("getEvent error:", e?.message || e);
        }
    }

    // Listeners
    on(form, "submit", onSubmit);
    on(weatherBtn, "click", onWeather);
    on(locationEl, "input", doGeocode);
}

window.addEventListener("DOMContentLoaded", boot);

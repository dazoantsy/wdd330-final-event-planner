// js/event-details.js — détails + météo (icône) + RSVP
import { qs, formatDateRange, formatTimeRange, normalizeEvent } from "./events.js";
import { getEvent, removeEvent, listRsvps, upsertRsvp } from "./db.js";
import { geocode, fetchWeather } from "./api.js";

const $ = (s) => document.querySelector(s);
let current = null;

// ——— mapping icône météo (Open-Meteo code)
function wxIconAndText(code) {
    const c = Number(code);
    if (c === 0) return { icon: "☀️", text: "Clear sky" };
    if ([1, 2, 3].includes(c)) return { icon: "⛅️", text: "Partly cloudy" };
    if ([45, 48].includes(c)) return { icon: "🌫️", text: "Fog" };
    if ([51, 53, 55, 56, 57].includes(c)) return { icon: "🌦️", text: "Drizzle" };
    if ([61, 63, 65, 66, 67].includes(c)) return { icon: "🌧️", text: "Rain" };
    if ([71, 73, 75, 77].includes(c)) return { icon: "🌨️", text: "Snow" };
    if ([80, 81, 82].includes(c)) return { icon: "🌧️", text: "Rain showers" };
    if ([85, 86].includes(c)) return { icon: "🌨️", text: "Snow showers" };
    if (c === 95) return { icon: "⛈️", text: "Thunderstorm" };
    if ([96, 99].includes(c)) return { icon: "⛈️", text: "Thunderstorm w/ hail" };
    return { icon: "❓", text: "Unknown" };
}

async function loadAndRender() {
    const id = qs("id");
    if (!id) { $("#details").innerHTML = "<p>Missing event id.</p>"; return; }

    const raw = await getEvent(id);
    if (!raw) { $("#details").innerHTML = "<p>Event not found.</p>"; return; }

    const ev = current = normalizeEvent(raw);

    const time = formatTimeRange(ev.time, ev.endTime);
    $("#title").textContent = ev.title || "(untitled)";
    $("#when").textContent = `${formatDateRange(ev.startDate, ev.endDate)}${time ? " — " + time : ""}`;
    $("#where").textContent = ev.location || "";
    $("#notes").textContent = ev.notes || "";
    $("#editLink").href = `./edit-event.html?id=${encodeURIComponent(ev.id)}`;

    // delete
    $("#deleteBtn")?.addEventListener("click", async () => {
        if (!confirm("Delete this event?")) return;
        await removeEvent(ev.id);
        window.location.href = "./index.html";
    });

    await renderWeatherInline();
    await renderRsvps();

    $("#rsvpForm")?.addEventListener("submit", submitRsvp);
}

async function renderWeatherInline() {
    const box = $("#weatherBox");
    if (!box) return;
    if (!current?.location) { box.textContent = "No location set for this event."; return; }

    box.textContent = "Loading weather…";
    try {
        const results = await geocode(current.location);
        const spot = results?.[0];
        if (!spot) { box.textContent = "Location not found."; return; }

        const w = await fetchWeather({ lat: spot.lat, lon: spot.lon });
        const { icon, text } = wxIconAndText(w.code);

        const parts = [];
        if (w.temperature != null) parts.push(`Temperature: ${Math.round(w.temperature)}°C`);
        if (w.windspeed != null) parts.push(`Wind: ${Math.round(w.windspeed)} km/h`);

        box.innerHTML = `
      <div class="wx">
        <span class="wx__icon" aria-hidden="true">${icon}</span>
        <div class="wx__meta">
          <strong>${current.location}</strong><br/>
          <span class="wx__label">${text}</span>
          ${parts.length ? `<span class="wx__sep"> • </span><span class="wx__vals">${parts.join(" — ")}</span>` : ""}
        </div>
      </div>
    `;
    } catch (e) {
        console.error(e);
        box.textContent = "Weather unavailable.";
    }
}

async function renderRsvps() {
    const c = $("#rsvpList");
    if (!c) return;
    c.textContent = "Loading…";
    try {
        const list = await listRsvps(current.id);
        if (!list?.length) { c.innerHTML = `<p class="empty">No responses yet.</p>`; return; }
        const ul = document.createElement("ul");
        ul.className = "list";
        list.forEach(r => {
            const li = document.createElement("li");
            const who = r.user_id ? "User" : (r.email || "Guest");
            li.textContent = `${who} — ${r.status}${r.guests ? ` ×${r.guests}` : ""}${r.note ? ` — ${r.note}` : ""}`;
            ul.appendChild(li);
        });
        c.innerHTML = "";
        c.appendChild(ul);
    } catch (e) {
        console.error(e);
        c.textContent = "Failed to load RSVPs.";
    }
}

async function submitRsvp(e) {
    e.preventDefault();
    const f = e.currentTarget;
    const status = f.status.value;
    const guests = Math.max(1, Number(f.guests.value || 1));
    const note = f.note.value.trim();
    const email = f.email?.value?.trim() || null;

    try {
        await upsertRsvp(current.id, { status, guests, note, email: email || null });
        f.reset();
        await renderRsvps();
        alert("RSVP saved ✅");
    } catch (err) {
        alert("Could not save RSVP");
        console.error(err);
    }
}

window.addEventListener("DOMContentLoaded", loadAndRender);

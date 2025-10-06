import { load, save } from "./storage.js";
import { geocodeOne, forecastAt, currentWeather } from "./api.js";

const LIST_KEY = "ep-events";
const listEl = document.getElementById("events");
const userEl = document.getElementById("username");

userEl && (userEl.textContent = localStorage.getItem("ep-user-name") || "Guest");

// utils
function codeToEmoji(code) {
    if (code === 0) return "☀️";
    if (code === 1 || code === 2) return "⛅";
    if (code === 3) return "☁️";
    if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return "🌧️";
    if ([71, 73, 75].includes(code)) return "❄️";
    if ([95, 96, 99].includes(code)) return "⛈️";
    if ([45, 48].includes(code)) return "🌫️";
    return "🌡️";
}

function eventStartDate(e) {
    if (!e.startDate) return null;
    return new Date(`${e.startDate}T${e.startTime || "00:00"}`);
}
function eventEndDate(e) {
    if (!e.endDate) return null;
    return new Date(`${e.endDate}T${e.endTime || "00:00"}`);
}
function isPastEvent(e) {
    const end = eventEndDate(e);
    const start = eventStartDate(e);
    const ref = end || start; // si fin absente → on juge sur le début
    if (!ref) return false;
    return ref < new Date();
}

// html
function cardHTML(e) {
    const start = e.startDate ? `${e.startDate}${e.startTime ? " " + e.startTime : ""}` : "";
    const end = e.endDate ? `${e.endDate}${e.endTime ? " " + e.endTime : ""}` : "";
    const when = end ? `${start} → ${end}` : start;

    const wx = e.weather || null;
    const icon = (wx && (wx.icon || codeToEmoji(wx.code))) || "";
    const wxText = wx ? `${icon ? icon + " " : ""}${wx.temp_c ?? "—"}°C · ${wx.condition || "—"}` : "";

    const past = isPastEvent(e);
    const cardClass = past ? "event-card card past-event" : "event-card card";

    return `
    <li class="${cardClass}" data-id="${e.id}" ${past ? 'data-past="1"' : ""}>
      <div class="card-actions">
        <button class="icon-btn edit" title="Edit" data-id="${e.id}" ${past ? "disabled" : ""}>✏️</button>
        <button class="icon-btn del" title="Delete" data-id="${e.id}" ${past ? "disabled" : ""}>🗑️</button>
      </div>
      <h3 class="title">${e.title || "Untitled"}</h3>
      <span class="badge">${e.type || "Event"}</span>
      <p class="meta">${when} — ${e.location || ""}</p>
      ${wx ? `<p class="wx">${wxText}</p>` : ``}
    </li>
  `;
}

async function backfillWeather(events) {
    let changed = false;
    for (const e of events) {
        if (e.weather || !e.location) continue;
        try {
            let lat = e.lat ?? null, lon = e.lon ?? null;
            if (lat == null || lon == null) {
                const found = await geocodeOne(e.location);
                if (found) { lat = found.lat; lon = found.lon; e.lat = lat; e.lon = lon; changed = true; }
            }
            if (lat != null && lon != null) {
                let met = null;
                const s = eventStartDate(e);
                if (s) {
                    met = await forecastAt(lat, lon, s);
                } else {
                    met = await currentWeather(lat, lon);
                }
                if (met) { e.weather = met; changed = true; }
            }
        } catch { }
    }
    if (changed) save(LIST_KEY, events);
}

async function render() {
    const events = load(LIST_KEY, []);
    if (!events.length) {
        listEl.innerHTML = `<li class="card">No events yet. <a href="./create-event.html">Create one</a>.</li>`;
        return;
    }
    await backfillWeather(events);
    listEl.innerHTML = events.map(cardHTML).join("");

    document.querySelectorAll(".past-event").forEach(card => {
        card.style.filter = "grayscale(100%)";
        card.style.pointerEvents = "none";
        card.style.opacity = "0.6";
    });
}

// actions
listEl.addEventListener("click", (e) => {
    const editBtn = e.target.closest(".edit");
    const delBtn = e.target.closest(".del");
    const card = e.target.closest(".event-card");
    if (!card || card.dataset.past === "1") return;

    if (editBtn) {
        const id = editBtn.dataset.id;
        window.location.href = `./edit-event.html?id=${encodeURIComponent(id)}`;
        return;
    }
    if (delBtn) {
        const id = delBtn.dataset.id;
        if (confirm("Delete this event?")) {
            const all = load(LIST_KEY, []);
            const next = all.filter(ev => ev.id !== id);
            save(LIST_KEY, next);
            render();
        }
        return;
    }
    if (card) {
        const id = card.dataset.id;
        window.location.href = `./event-details.html?id=${encodeURIComponent(id)}`;
    }
});

render();

import { load, save } from "./storage.js";
import { searchPlaces, geocodeOne, forecastAt, currentWeather } from "./api.js";

const LIST_KEY = "ep-events";

const form = document.getElementById("edit-form");
const cancelBtn = document.getElementById("cancel");
const backLink = document.getElementById("back");
const idInput = document.getElementById("id");
const titleEl = document.getElementById("title");
const startDateEl = document.getElementById("startDate");
const startTimeEl = document.getElementById("startTime");
const endDateEl = document.getElementById("endDate");
const endTimeEl = document.getElementById("endTime");
const locInput = document.getElementById("location");
const typeEl = document.getElementById("type");
const descEl = document.getElementById("description");
const sugList = document.getElementById("loc-suggestions");
const previewBtn = document.getElementById("preview-weather");
const previewBox = document.getElementById("weather-preview");

const show = (el) => el && el.removeAttribute("hidden");
const hide = (el, clear = false) => { if (!el) return; el.setAttribute("hidden", ""); if (clear) el.innerHTML = ""; };
const qs = (k) => new URLSearchParams(location.search).get(k);

const id = qs("id");
if (backLink) backLink.href = id ? `./event-details.html?id=${encodeURIComponent(id)}` : "./index.html";

// charger
const events = load(LIST_KEY, []);
const idx = events.findIndex(x => x.id === id);
const ev = idx >= 0 ? events[idx] : null;

if (!ev) {
    form.innerHTML = "<p>Event not found.</p>";
} else {
    idInput.value = ev.id;
    titleEl.value = ev.title || "";
    startDateEl.value = ev.startDate || "";
    startTimeEl.value = ev.startTime || "";
    endDateEl.value = ev.endDate || "";
    endTimeEl.value = ev.endTime || "";
    locInput.value = ev.location || "";
    typeEl.value = ev.type || "Meeting";
    descEl.value = ev.description || "";
    if (ev.lat != null && ev.lon != null) {
        locInput.dataset.lat = String(ev.lat);
        locInput.dataset.lon = String(ev.lon);
    }
}

hide(sugList, true);
hide(previewBox, true);

// suggestions
let sugTimer = null;
if (locInput && sugList) {
    locInput.addEventListener("input", () => {
        const q = locInput.value.trim();
        if (sugTimer) clearTimeout(sugTimer);
        if (!q) { hide(sugList, true); delete locInput.dataset.lat; delete locInput.dataset.lon; return; }

        sugTimer = setTimeout(async () => {
            try {
                const items = await searchPlaces(q);
                if (!items || !items.length) { hide(sugList, true); return; }
                sugList.innerHTML = items.map(it =>
                    `<li class="suggest-item" data-lat="${it.lat}" data-lon="${it.lon}">${it.display_name}</li>`
                ).join("");
                show(sugList);
            } catch { hide(sugList, true); }
        }, 300);
    });

    sugList.addEventListener("click", (e) => {
        const li = e.target.closest(".suggest-item");
        if (!li) return;
        locInput.value = li.textContent.trim();
        locInput.dataset.lat = li.dataset.lat;
        locInput.dataset.lon = li.dataset.lon;
        hide(sugList, true);
    });

    locInput.addEventListener("keydown", (e) => { if (e.key === "Escape") hide(sugList, true); });
    locInput.addEventListener("blur", () => { setTimeout(() => hide(sugList), 150); });
    document.addEventListener("click", (e) => { if (!locInput.contains(e.target) && !sugList.contains(e.target)) hide(sugList); });
}

// preview météo (sur START)
if (previewBtn && previewBox) {
    previewBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        const address = locInput.value.trim();
        if (!address) { previewBox.textContent = "Enter a location first."; show(previewBox); return; }

        previewBox.textContent = "Loading…"; show(previewBox);

        try {
            let lat = locInput.dataset.lat ? Number(locInput.dataset.lat) : null;
            let lon = locInput.dataset.lon ? Number(locInput.dataset.lon) : null;
            let pretty = address;

            if (lat == null || lon == null) {
                const found = await geocodeOne(address);
                if (!found) { previewBox.textContent = "Location not found."; return; }
                lat = found.lat; lon = found.lon; pretty = found.display_name || `${lat}, ${lon}`;
                locInput.dataset.lat = String(lat); locInput.dataset.lon = String(lon);
            }

            const startDate = startDateEl.value;
            const startTime = startTimeEl.value;
            let met = null;

            if (startDate) {
                const [H, M] = (startTime || "12:00").split(":").map(Number);
                const when = new Date(`${startDate}T${String(H).padStart(2, "0")}:${String(M).padStart(2, "0")}:00`);
                met = await forecastAt(lat, lon, when);
            } else {
                met = await currentWeather(lat, lon);
            }

            if (!met) { previewBox.textContent = "Weather preview failed."; return; }

            previewBox.innerHTML = `
        <strong>${pretty}</strong><br>
        ${met.icon ? `${met.icon} ` : ""}${met.temp_c ?? "—"}°C — ${met.condition || "—"} 
        <small>(${met.provider || "open-meteo"})</small>
      `;
        } catch (err) {
            previewBox.textContent = "Weather preview failed (see console).";
            console.log(err);
        }
    });
}

// save
form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (idx === -1) return;

    let lat = locInput.dataset.lat ? Number(locInput.dataset.lat) : null;
    let lon = locInput.dataset.lon ? Number(locInput.dataset.lon) : null;
    if (lat == null || lon == null) {
        const found = await geocodeOne(locInput.value.trim());
        if (found) { lat = found.lat; lon = found.lon; }
    }

    // météo sur la date de début
    let weather = null;
    try {
        if (lat != null && lon != null) {
            const startDate = startDateEl.value;
            const startTime = startTimeEl.value;
            if (startDate) {
                const [H, M] = (startTime || "12:00").split(":").map(Number);
                const when = new Date(`${startDate}T${String(H).padStart(2, "0")}:${String(M).padStart(2, "0")}:00`);
                weather = await forecastAt(lat, lon, when);
            } else {
                weather = await currentWeather(lat, lon);
            }
        }
    } catch (_) { }

    events[idx] = {
        ...events[idx],
        title: titleEl.value.trim(),
        startDate: startDateEl.value,
        startTime: startTimeEl.value,
        endDate: endDateEl.value || null,
        endTime: endTimeEl.value || null,
        location: locInput.value.trim(),
        type: typeEl.value,
        description: descEl.value.trim(),
        lat, lon, weather
    };

    save(LIST_KEY, events);
    alert("✅ Event updated!");
    window.location.href = `./event-details.html?id=${encodeURIComponent(id)}`;
});

// cancel
if (cancelBtn) {
    cancelBtn.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.href = `./event-details.html?id=${encodeURIComponent(id)}`;
    });
}

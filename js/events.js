import { geocodeOne, searchPlaces, currentWeather, forecastAt } from "./api.js";
import { load, save } from "./storage.js";

const LIST_KEY = "ep-events";
const form = document.getElementById("create-event-form");
const previewBtn = document.getElementById("preview-weather");
const previewBox = document.getElementById("weather-preview");
const locInput = document.getElementById("location");
const sugList = document.getElementById("loc-suggestions");

// helpers
const show = (el) => el && el.removeAttribute("hidden");
const hide = (el, clear = false) => { if (!el) return; el.setAttribute("hidden", ""); if (clear) el.innerHTML = ""; };

hide(sugList, true);
hide(previewBox, true);

// === Suggestions ===
let sugTimer = null;
locInput.addEventListener("input", () => {
    const q = locInput.value.trim();
    if (sugTimer) clearTimeout(sugTimer);
    if (!q) { hide(sugList, true); delete locInput.dataset.lat; delete locInput.dataset.lon; return; }

    sugTimer = setTimeout(async () => {
        try {
            const items = await searchPlaces(q);
            if (!items.length) { hide(sugList, true); return; }
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

// === Preview Weather (basée sur START) ===
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

        const startDate = document.getElementById("startDate").value;
        const startTime = document.getElementById("startTime").value;
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

// === Create (sauvegarde avec START/END) ===
form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const title = document.getElementById("title").value.trim();
    const startDate = document.getElementById("startDate").value;
    const startTime = document.getElementById("startTime").value;
    const endDate = document.getElementById("endDate").value;
    const endTime = document.getElementById("endTime").value;
    const type = document.getElementById("type").value;
    const description = document.getElementById("description").value.trim();
    const location = locInput.value.trim();

    let lat = locInput.dataset.lat ? Number(locInput.dataset.lat) : null;
    let lon = locInput.dataset.lon ? Number(locInput.dataset.lon) : null;
    if (lat == null || lon == null) {
        const found = await geocodeOne(location);
        if (found) { lat = found.lat; lon = found.lon; }
    }

    // météo sur la date de début
    let weather = null;
    try {
        if (lat != null && lon != null) {
            if (startDate) {
                const [H, M] = (startTime || "12:00").split(":").map(Number);
                const when = new Date(`${startDate}T${String(H).padStart(2, "0")}:${String(M).padStart(2, "0")}:00`);
                weather = await forecastAt(lat, lon, when);
            } else {
                weather = await currentWeather(lat, lon);
            }
        }
    } catch (_) { }

    const event = {
        id: crypto.randomUUID(),
        title,
        startDate, startTime,
        endDate: endDate || null,
        endTime: endTime || null,
        location,
        type,
        description,
        lat, lon,
        weather
    };

    const events = load(LIST_KEY, []);
    events.push(event);
    save(LIST_KEY, events);

    alert("✅ Event created!");
    window.location.href = "../event-planner/index.html";
});

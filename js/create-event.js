// /js/create-event.js
import { supabase, getUserOrNull } from "./api.js";
import { toDbTimestampLocal } from "./date-helpers.js";

// --- Weather helpers (WMO -> English text + emoji) ---
function weatherCodeToText(code) {
  const c = Number(code);
  const M = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Light freezing drizzle",
    57: "Dense freezing drizzle",
    61: "Light rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Light rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Light snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
  };
  return Object.prototype.hasOwnProperty.call(M, c) ? M[c] : `Weather code ${c}`;
}

function codeToEmoji(code) {
  const c = Number(code);
  if (c === 0) return "☀️";
  if (c === 1) return "🌤️";
  if (c === 2) return "⛅";
  if (c === 3) return "☁️";
  if (c === 45 || c === 48) return "🌫️";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(c)) return "🌧️";
  if ([66, 67].includes(c)) return "🌧️❄️";
  if ([71, 73, 75, 77, 85, 86].includes(c)) return "🌨️";
  if ([95, 96, 99].includes(c)) return "⛈️";
  return "🌡️";
}

function formatWeather(tempC, code) {
  const t = (tempC != null) ? `${Math.round(tempC)}°C` : "n/a";
  const txt = weatherCodeToText(code);
  const emo = codeToEmoji(code);
  return `${emo} ${t} • ${txt}`;
}

const form = document.querySelector("#form");
const statusEl = document.querySelector("#status");
const titleEl = document.querySelector("#title");
const startEl = document.querySelector("#start");
const endEl = document.querySelector("#end");
const locEl = document.querySelector("#location");
// LocalStorage: preferred_location
try {
  const last = localStorage.getItem("preferred_location");
  if (last && !locEl.value) locEl.value = last;
} catch { }
locEl?.addEventListener("change", () => {
  try { localStorage.setItem("preferred_location", (locEl.value || "").trim()); } catch { }
});
const descEl = document.querySelector("#description");
const weatherBtn = document.querySelector("#weather-btn");
const weatherBox = document.querySelector("#weather-box");
const dl = document.querySelector("#loc-suggestions");

/* ---------- helpers ---------- */
function setStatus(msg, kind = "info") {
  if (!statusEl) return;
  statusEl.textContent = msg || "";
  statusEl.className = "status " + (kind || "info");
  // Annonce au lecteur d’écran : alert pour erreur, sinon status/polite
  if (kind === "error") {
    statusEl.setAttribute("role", "alert");
    statusEl.setAttribute("aria-live", "assertive");
  } else {
    statusEl.setAttribute("role", "status");
    statusEl.setAttribute("aria-live", "polite");
  }
}

function debounce(fn, ms = 350) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/* ---------- Validation minimale (HTML5) ---------- */
// DO NOT REMOVE: minimal form validation
function validateEndAfterStart() {
  const s = startEl?.value ? new Date(startEl.value) : null;
  const e = endEl?.value ? new Date(endEl.value) : null;
  if (endEl?.value && (!e || !s || e <= s)) {
    endEl.setCustomValidity("End must be after start");
  } else {
    endEl?.setCustomValidity("");
  }
}
startEl?.addEventListener("input", validateEndAfterStart);
endEl?.addEventListener("input", validateEndAfterStart);

/* ---------- Suggestions de lieux (Nominatim) ---------- */
async function searchPlaces(q) {
  if (!q || q.length < 2) { if (dl) dl.innerHTML = ""; return; }
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=7&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { "Accept-Language": "en" } });
    const data = await res.json();
    if (!Array.isArray(data)) return;
    if (dl) {
      dl.innerHTML = data.map(p => {
        const name = p.display_name;
        return `<option value="${name.replace(/"/g, '&quot;')}"></option>`;
      }).join("");
    }
  } catch { /* silencieux */ }
}
locEl?.addEventListener("input", debounce(() => searchPlaces(locEl.value.trim()), 350));

/* ---------- Création ---------- */
form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  // Validation HTML5
  validateEndAfterStart();
  if (!form.checkValidity()) { form.reportValidity(); return; }

  const user = await getUserOrNull();
  if (!user) { setStatus("Not signed in", "error"); return; }

  const title = titleEl.value.trim();
  const start = toDbTimestampLocal(startEl.value);
  const end = toDbTimestampLocal(endEl.value);
  let place = (locEl.value || "").trim();        // ⚠️ ne pas nommer "location" pour ne pas écraser window.location
  const description = (descEl.value || "").trim();

  setStatus("Saving...");
  const { data: inserted, error } = await supabase
    .from("events")
    .insert({
      user_id: user.id,
      title,
      description,
      location: place,     // (ne pas renommer)
      start_date: start,
      end_date: end,
      end_time: ""
    })
    .select("id")
    .single();

  if (error) { setStatus(error.message, "error"); return; }
  try { localStorage.setItem("last_insert_id", inserted?.id || ""); } catch { }
  window.location.href = "./index.html";
});

/* ---------- Météo ---------- */
async function checkWeather() {
  const where = (locEl?.value || "").trim();
  const start = startEl?.value;
  if (!where || !start) { setStatus("Enter location and start time first", "error"); return; }
  setStatus("");

  try {
    // 1) Geocode
    const geo = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(where)}`
    ).then(r => r.json());

    if (!Array.isArray(geo) || !geo[0]) {
      weatherBox.textContent = "Location not found";
      return;
    }

    const lat = geo[0].lat, lon = geo[0].lon;

    // 2) Hourly weather for selected date/hour
    const d = new Date(start);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');

    const w = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,weathercode&start_date=${y}-${m}-${da}&end_date=${y}-${m}-${da}`
    ).then(r => r.json());

    const idx = w?.hourly?.time?.findIndex(t => t.includes('T' + h));
    const temp = (idx >= 0) ? w.hourly.temperature_2m[idx] : null;
    const code = (idx >= 0) ? w.hourly.weathercode[idx] : null;

    weatherBox.textContent = (idx >= 0) ? formatWeather(temp, code) : "Weather: n/a";
  } catch (e) {
    weatherBox.textContent = "Weather: n/a";
  }
}

weatherBtn?.addEventListener("click", checkWeather);

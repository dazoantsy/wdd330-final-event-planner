// api.js — geocoding via Photon (Komoot) + weather (Open-Meteo fallback)

// ============ GEOCODING (Photon) ============
export async function searchPlaces(query) {
    if (!query) return [];
    try {
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`;
        const res = await fetch(url, { method: "GET" });
        if (!res.ok) throw new Error(`Photon HTTP ${res.status}`);
        const data = await res.json();
        const feats = data?.features || [];
        return feats.map(f => ({
            lat: Number(f.geometry.coordinates[1]),
            lon: Number(f.geometry.coordinates[0]),
            display_name:
                (f.properties?.name || "") +
                (f.properties?.city ? `, ${f.properties.city}` : "") +
                (f.properties?.state ? `, ${f.properties.state}` : "") +
                (f.properties?.country ? `, ${f.properties.country}` : "")
        }));
    } catch (err) {
        console.error("[api.searchPlaces] failed:", err);
        return [];
    }
}

// One result + supports "lat,lon"
export async function geocodeOne(query) {
    if (!query) return null;
    const m = query.trim().match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (m) {
        const lat = Number(m[1]);
        const lon = Number(m[2]);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
            return { lat, lon, display_name: `${lat}, ${lon}` };
        }
    }
    const list = await searchPlaces(query);
    return list[0] || null;
}

// ============ WEATHER ============
const WEATHER_KEY = ""; // Optionnel: ta clé WeatherAPI. Laisse vide pour Open-Meteo.

export async function currentWeather(lat, lon) {
    if (WEATHER_KEY && WEATHER_KEY !== "YOUR_WEATHERAPI_KEY") {
        try {
            const r = await fetch(`https://api.weatherapi.com/v1/current.json?key=${WEATHER_KEY}&q=${lat},${lon}`);
            if (!r.ok) throw new Error(`WeatherAPI HTTP ${r.status}`);
            const d = await r.json();
            if (d?.current) {
                return {
                    provider: "weatherapi",
                    temp_c: d.current.temp_c,
                    condition: d.current.condition?.text || "—",
                    icon: d.current.condition?.icon || null,
                    code: null,
                };
            }
        } catch (e) {
            console.warn("[api.currentWeather] WeatherAPI failed, fallback:", e);
        }
    }
    // Open-Meteo (sans clé)
    const om = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`;
    const res = await fetch(om);
    if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
    const d2 = await res.json();
    const t = d2?.current?.temperature_2m;
    const code = d2?.current?.weather_code;
    return { provider: "open-meteo", temp_c: typeof t === "number" ? t : null, condition: codeToText(code), icon: null, code };
}

// Prévision à une date/heure locale (prend l’heure disponible la plus proche ce jour-là)
export async function forecastAt(lat, lon, when /* Date */) {
    const y = when.getFullYear();
    const m = String(when.getMonth() + 1).padStart(2, "0");
    const d = String(when.getDate()).padStart(2, "0");

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&hourly=temperature_2m,weather_code&timezone=auto&start_date=${y}-${m}-${d}&end_date=${y}-${m}-${d}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Open-Meteo hourly HTTP ${res.status}`);
    const data = await res.json();

    const times = data?.hourly?.time || [];
    const temps = data?.hourly?.temperature_2m || [];
    const codes = data?.hourly?.weather_code || [];
    if (!times.length) return null;

    // Index de l’heure la plus proche
    let best = 0, bestDiff = Infinity;
    for (let i = 0; i < times.length; i++) {
        const diff = Math.abs(new Date(times[i]).getTime() - when.getTime());
        if (diff < bestDiff) { best = i; bestDiff = diff; }
    }

    const code = codes[best];
    const temp = temps[best];
    return {
        provider: "open-meteo",
        temp_c: typeof temp === "number" ? temp : null,
        condition: codeToText(code),
        icon: codeToEmoji(code),
        code
    };
}

// Mapping de code → libellé
function codeToText(code) {
    const m = {
        0: "Clear", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Rime fog",
        51: "Light drizzle", 53: "Drizzle", 55: "Dense drizzle",
        61: "Light rain", 63: "Rain", 65: "Heavy rain",
        71: "Slight snow", 73: "Snow", 75: "Heavy snow",
        80: "Rain showers", 81: "Heavy rain showers", 82: "Violent rain showers",
        95: "Thunderstorm", 96: "Thunderstorm (slight hail)", 99: "Thunderstorm (heavy hail)"
    };
    return m?.[code] ?? "—";
}

// Petit set d’icônes (emoji) simple
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

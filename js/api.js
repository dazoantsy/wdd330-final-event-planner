// js/api.js — client Supabase + géocodage + météo
// Remplace tout le fichier par cette version.

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// 👉 RENSEIGNE ces deux variables :
const SUPABASE_URL = window.env?.SUPABASE_URL || "https://cekijhhbnxgapiqlowfx.supabase.co";
const SUPABASE_ANON_KEY = window.env?.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNla2lqaGhibnhnYXBpcWxvd2Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5ODcwMzQsImV4cCI6MjA3NTU2MzAzNH0.Pefh7gC-oSAgPVUiO1t2WvH70cdPT81YvqaHcbCgDKc";

// Client unique pour toute l'app
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Utilitaires communs ---
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const toNum = (v) => (v == null ? null : Number(v));

// --- Géocodage (OpenStreetMap via geocode.maps.co : pas de clé, CORS OK) ---
/**
 * Geocode une requête texte et renvoie un tableau d'objets { label, lat, lon }
 * @param {string} query
 * @returns {Promise<Array<{label:string, lat:number, lon:number}>>}
 */
export async function geocode(query) {
    const q = (query || "").trim();
    if (!q) return [];
    // service simple basé sur OSM (proxy public)
    const url = `https://geocode.maps.co/search?q=${encodeURIComponent(q)}&limit=5`;
    try {
        const res = await fetch(url, { headers: { "Accept": "application/json" } });
        if (!res.ok) throw new Error(`geocode HTTP ${res.status}`);
        const data = await res.json();
        return (data || []).slice(0, 5).map(x => ({
            label: x.display_name || `${x.name || ""}`.trim(),
            lat: toNum(x.lat),
            lon: toNum(x.lon),
        })).filter(x => Number.isFinite(x.lat) && Number.isFinite(x.lon));
    } catch (err) {
        console.warn("[geocode] error:", err?.message);
        return [];
    }
}

// --- Météo (Open-Meteo : pas de clé) ---
/**
 * Récupère la météo courante + prévision simple
 * @param {{lat:number, lon:number}} p
 * @returns {Promise<{temperature:number|null, windspeed:number|null, code:number|null, source:string, raw:any}>}
 */
export async function fetchWeather({ lat, lon }) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        throw new Error("fetchWeather: invalid coordinates");
    }
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
    try {
        const res = await fetch(url, { headers: { "Accept": "application/json" } });
        if (!res.ok) throw new Error(`weather HTTP ${res.status}`);
        const json = await res.json();
        const cw = json?.current_weather || {};
        return {
            temperature: toNum(cw.temperature),
            windspeed: toNum(cw.windspeed),
            code: toNum(cw.weathercode),
            source: "open-meteo",
            raw: json,
        };
    } catch (err) {
        console.warn("[weather] error:", err?.message);
        return { temperature: null, windspeed: null, code: null, source: "open-meteo", raw: null };
    }
}

// --- Helpers auth (facultatif mais utile) ---
export async function requireSession() {
    const { data } = await supabase.auth.getSession();
    if (!data?.session?.user) throw new Error("Not authenticated");
    return data.session;
}

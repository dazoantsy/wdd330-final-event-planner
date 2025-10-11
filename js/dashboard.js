// js/dashboard.js — stats à partir de mes événements
import { requireAuthIfNeeded } from "./auth.js";
import { listMyEvents } from "./db.js";

const $ = (s, r = document) => r.querySelector(s);

function computeStats(list) {
  const now = new Date();
  const total = list.length;
  const upcoming = list.filter(e => new Date(e.start_date || e.date) >= now).length;

  const map = new Map();
  list.forEach(e => {
    const t = (e.type || "Other").trim() || "Other";
    map.set(t, (map.get(t) || 0) + 1);
  });
  const byType = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  return { total, upcoming, byType };
}

function renderStats(container, stats) {
  container.innerHTML = `
    <article class="card"><h3>Total Event</h3><p style="font-size:2rem">${stats.total}</p></article>
    <article class="card"><h3>Upcoming Events</h3><p style="font-size:2rem">${stats.upcoming}</p></article>
    <article class="card" style="grid-column:1/-1">
      <h3>By type</h3>
      <ul>${stats.byType.map(([t, c]) => `<li>${t}: ${c}</li>`).join("")}</ul>
    </article>
  `;
}

async function boot() {
  await requireAuthIfNeeded();

  const root = $("#stats");
  if (!root) return;

  root.innerHTML = `<article class="card"><p>Loading…</p></article>`;

  let list = [];
  try {
    list = await listMyEvents();
  } catch (e) {
    console.error(e);
    root.innerHTML = `<article class="card"><p>Erreur de chargement.</p></article>`;
    return;
  }

  renderStats(root, computeStats(list));
}

window.addEventListener("DOMContentLoaded", boot);

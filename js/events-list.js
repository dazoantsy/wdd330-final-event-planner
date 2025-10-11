// js/events-list.js — Events list (owner ∪ RSVP) + filtres
import { requireAuthIfNeeded } from "./auth.js";
import { listEvents, listMyEvents, claimRsvpsForUser } from "./db.js";
import { formatDate, normalizeEvent } from "./events.js";

const $ = (s, r = document) => r.querySelector(s);

// ——— Card
function toCard(e) {
    const ev = normalizeEvent(e);
    const when = `${formatDate(ev.startDate)}${ev.time ? " • " + ev.time : ""}`;
    return `
    <h3>${ev.title || "(Untitled)"}</h3>
    <p>${when}</p>
    ${ev.location ? `<p>${ev.location}</p>` : ""}
    <div class="row">
      <a class="btn" href="./event-details.html?id=${encodeURIComponent(ev.id)}">View</a>
      <a class="btn" href="./edit-event.html?id=${encodeURIComponent(ev.id)}">Edit</a>
    </div>
  `;
}

function renderEmpty(container, msg = "No events yet.") {
    container.innerHTML = `<li class="empty">${msg}</li>`;
}

function splitPastUpcoming(list) {
    const now = new Date();
    const up = [], past = [];
    (list || []).forEach(e => {
        const d = new Date(e.start_date || e.date || e.startDate || Date.now());
        (d >= now ? up : past).push(e);
    });
    past.sort((a, b) => new Date(b.start_date || b.date) - new Date(a.start_date || a.date));
    up.sort((a, b) => new Date(a.start_date || a.date) - new Date(b.start_date || b.date));
    return { past, up };
}

function renderList(containerPast, containerUp, list) {
    const { past, up } = splitPastUpcoming(list);

    if (!up.length) renderEmpty(containerUp, "Nothing upcoming.");
    else {
        containerUp.innerHTML = "";
        up.forEach(e => {
            const li = document.createElement("li");
            li.className = "card";
            li.innerHTML = toCard(e);
            containerUp.appendChild(li);
        });
    }

    if (!past.length) renderEmpty(containerPast, "No past events.");
    else {
        containerPast.innerHTML = "";
        past.forEach(e => {
            const li = document.createElement("li");
            li.className = "card";
            li.innerHTML = toCard(e);
            containerPast.appendChild(li);
        });
    }
}

function applyFilters(list, q, type) {
    let out = list || [];
    if (q) {
        const s = q.toLowerCase();
        out = out.filter(e =>
            (e.title || "").toLowerCase().includes(s) ||
            (e.location || "").toLowerCase().includes(s)
        );
    }
    if (type) out = out.filter(e => (e.type || "") === type);
    return out;
}

// ——— Boot
async function boot() {
    await requireAuthIfNeeded();

    const ulPast = document.querySelector("#eventsPast");
    const ulUp = document.querySelector("#eventsUpcoming");
    if (!ulPast || !ulUp) return;

    ulPast.innerHTML = `<li class="empty">Loading…</li>`;
    ulUp.innerHTML = `<li class="empty">Loading…</li>`;

    let data = [];

    try {
        await claimRsvpsForUser();

        // 1) rapide cache (owner)
        data = await listEvents();
        renderList(ulPast, ulUp, data);

        // 2) complet (owner ∪ RSVP)
        const server = await listMyEvents();
        renderList(ulPast, ulUp, server);
        data = server;
    } catch (e) {
        console.error(e);
        renderEmpty(ulPast, "Failed to load.");
        renderEmpty(ulUp, "Failed to load.");
    }

    const search = $("#search");
    const typeSel = $("#type");
    const rerender = () => {
        const q = search?.value?.trim() || "";
        const t = typeSel?.value || "";
        renderList(ulPast, ulUp, applyFilters(data, q, t));
    };
    search?.addEventListener("input", rerender);
    typeSel?.addEventListener("change", rerender);
}

window.addEventListener("DOMContentLoaded", boot);

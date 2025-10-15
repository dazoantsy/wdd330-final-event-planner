// /js/events-list.js — My Events page: own events + accepted invites + pending banner
import { supabase } from "./api.js";
import { formatDateRange } from "./events.js";

// Robust root for links inside /event-planner/
const ROOT = location.pathname.includes("/event-planner/my-events/")
  ? "../"
  : location.pathname.includes("/event-planner/")
    ? "./"
    : "./event-planner/";

// Dashboard is at repo root:
// - from /event-planner/my-events/  -> "../../dashboard.html"
// - from /event-planner/            -> "../dashboard.html"
// - from anywhere else              -> "./dashboard.html"
const DASH = location.pathname.includes("/event-planner/my-events/")
  ? "../../dashboard.html"
  : location.pathname.includes("/event-planner/")
    ? "../dashboard.html"
    : "./dashboard.html";

const list = document.getElementById("events-list");
const banner = document.getElementById("invites-banner");
if (!list) console.warn("[EventsList] #events-list not found");

// --- Collapsible Past Events state ---
const PAST_KEY = "myEvents_past_open";
function readPastOpen() {
  try { return JSON.parse(localStorage.getItem(PAST_KEY) || "false"); } catch { return false; }
}
function writePastOpen(v) {
  try { localStorage.setItem(PAST_KEY, JSON.stringify(!!v)); } catch { }
}

// Helpers
function isPast(ev) {
  // Past if end_date < today (00:00)
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const ref = ev.end_date || ev.start_date || "";
  const d = new Date(ref);
  if (isNaN(d.getTime())) return false; // if bad date, treat as upcoming
  return d < today;
}
function byStartDesc(a, b) {
  const da = new Date(a.start_date || a.end_date || 0).getTime();
  const db = new Date(b.start_date || b.end_date || 0).getTime();
  return db - da; // newest first
}

// Render one card (UPCOMING); `owner` = am I the owner?
function cardUpcoming(ev, { owner = true } = {}) {
  const detailsURL = `${ROOT}event-details.html?id=${encodeURIComponent(ev.id)}`;
  const editURL = `${ROOT}edit-event.html?id=${encodeURIComponent(ev.id)}`;
  const date = formatDateRange(ev.start_date, ev.end_date);
  const time = ev.end_time ? ` • ${ev.end_time}` : "";
  const invitedBadge = owner ? "" : `<span class="badge" title="You are invited">Invited</span>`;

  return `
    <li class="event-card" data-id="${ev.id}">
      <div class="event-head">
        <a class="event-title" href="${detailsURL}">${ev.title || "Untitled"}</a>
        <div class="event-actions">
          <a class="btn sm" href="${detailsURL}">View</a>
          ${owner ? `<a class="btn sm ghost" href="${editURL}">Edit</a>` : ""}
          ${owner ? `<button class="btn sm danger" data-action="delete" data-id="${ev.id}">Delete</button>` : ""}
          ${invitedBadge}
        </div>
      </div>
      <div class="event-meta">${date}${time}</div>
      <div class="event-loc">${ev.location || ""}</div>
    </li>
  `;
}

// Render one item (PAST) — simplified, NO Edit; Delete only if owner
function itemPast(ev, { owner = true } = {}) {
  const detailsURL = `${ROOT}event-details.html?id=${encodeURIComponent(ev.id)}`;
  const date = formatDateRange(ev.start_date, ev.end_date);
  return `
    <li class="item event-card" data-id="${ev.id}">
      <div class="row" style="justify-content:space-between;align-items:center;gap:10px;">
        <a class="event-title" href="${detailsURL}">${ev.title || "Untitled"}</a>
        <div class="event-actions">
          ${owner ? `<button class="btn sm danger" data-action="delete" data-id="${ev.id}">Delete</button>` : ""}
        </div>
      </div>
      <div class="muted">${date}${ev.location ? ` • ${ev.location}` : ""}</div>
    </li>
  `;
}

async function load() {
  // current user
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id || "__";
  const myEmail = (auth?.user?.email || "").toLowerCase();

  // --- 1) Owned events (server filtered by user_id) ---
  const { data: owned, error: errOwned } = await supabase
    .from("events")
    .select("id,user_id,title,location,start_date,end_date,end_time")
    .eq("user_id", userId)
    .order("start_date", { ascending: false }); // newest first (server-side)

  if (errOwned) { list.innerHTML = `<li class="error">${errOwned.message}</li>`; return; }

  // --- 2) Accepted invitations (only those you accepted) ---
  const { data: acceptedInvs, error: errAcc } = await supabase
    .from("invitations")
    .select("event_id")
    .ilike("invitee_email", myEmail)
    .eq("status", "accepted");

  if (errAcc) { console.warn("[EventsList] accepted invites error:", errAcc.message); }

  const accIds = [...new Set((acceptedInvs || []).map(i => i.event_id))];
  let invitedEvents = [];
  if (accIds.length) {
    const { data: evMeta, error: evErr } = await supabase
      .from("events")
      .select("id,user_id,title,location,start_date,end_date,end_time")
      .in("id", accIds);
    if (!evErr) invitedEvents = (evMeta || []);
  }

  // --- 3) Merge (avoid duplicates when you accepted your own event) ---
  const mineById = new Map((owned || []).map(ev => [ev.id, ev]));
  const merged = [
    ...(owned || []).map(ev => ({ ev, owner: true })),
    ...invitedEvents
      .filter(ev => !mineById.has(ev.id))
      .map(ev => ({ ev, owner: false }))
  ];

  // --- 4) Split upcoming vs past & sort (newest first) ---
  const upcoming = [], past = [];
  for (const { ev, owner } of merged) (isPast(ev) ? past : upcoming).push({ ev, owner });
  upcoming.sort((a, b) => byStartDesc(a.ev, b.ev));
  past.sort((a, b) => byStartDesc(a.ev, b.ev));

  // --- 5) Pending invites banner ---
  const { data: pend } = await supabase
    .from("invitations")
    .select("id", { count: "exact" })
    .ilike("invitee_email", myEmail)
    .eq("status", "pending");

  const pendingCount = (pend && Array.isArray(pend)) ? pend.length : (pend?.length ?? 0);
  if (banner) {
    if (pendingCount > 0) {
      banner.classList.remove("hidden");
      banner.innerHTML = `
        You have <strong>${pendingCount}</strong> pending invitation${pendingCount > 1 ? "s" : ""}.
        <a class="btn sm" href="${DASH}#inv-me">Review on Dashboard</a>
      `;
    } else {
      banner.classList.add("hidden");
      banner.textContent = "";
    }
  }

  // --- 6) Render sections inside the existing UL as two blocks ---
  const pastOpen = readPastOpen();
  const upHTML = upcoming.length
    ? `<ul class="list" id="list-upcoming">
         ${upcoming.map(({ ev, owner }) => cardUpcoming(ev, { owner })).join("")}
       </ul>`
    : `<div class="muted">No upcoming events.</div>`;

  const pastCount = past.length;
  const pastHTML = past.length
    ? `<h2 id="past-toggle" tabindex="0" role="button" aria-expanded="${pastOpen}" aria-controls="list-past" style="cursor:pointer;">
         Past Events <span class="muted">(${pastCount})</span>
       </h2>
       <ul class="list ${pastOpen ? "" : "hidden"}" id="list-past">
         ${past.map(({ ev, owner }) => itemPast(ev, { owner })).join("")}
       </ul>`
    : `<h2>Past Events <span class="muted">(0)</span></h2>
       <div class="muted">None.</div>`;

  // Note: on garde #events-list comme conteneur ; on insère nos deux sections
  list.innerHTML = `
    <li class="no-bullet">
      <h2>Upcoming Events</h2>
      ${upHTML}
    </li>
    <li class="no-bullet">
      ${pastHTML}
    </li>
  `;

  // --- 7) Toggle Past collapsible (click or keyboard) ---
  const pastToggle = document.getElementById("past-toggle");
  const pastList = document.getElementById("list-past");
  if (pastToggle && pastList) {
    const toggle = () => {
      const open = pastToggle.getAttribute("aria-expanded") === "true";
      const next = !open;
      pastToggle.setAttribute("aria-expanded", String(next));
      pastList.classList.toggle("hidden", !next);
      writePastOpen(next);
    };
    pastToggle.addEventListener("click", toggle);
    pastToggle.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
    });
  }

  // --- 8) Delete (delegation, works for both sections) ---
  list.addEventListener("click", async (e) => {
    const btn = e.target.closest('[data-action="delete"]');
    if (!btn) return;
    const id = btn.getAttribute("data-id");
    if (!id) return;
    if (!confirm("Delete this event?")) return;

    btn.disabled = true;
    const { error: delErr } = await supabase.from("events").delete().eq("id", id);
    if (delErr) { alert(delErr.message); btn.disabled = false; return; }

    // remove card from DOM
    const card = list.querySelector(`.event-card[data-id="${id}"]`);
    card?.remove();

    // if both sections empty, show placeholder
    const hasAny = list.querySelector(".event-card");
    if (!hasAny) {
      list.innerHTML = `<li class="muted">No events found.</li>`;
    } else {
      // update counts if needed (past count)
      const pastListNow = document.getElementById("list-past");
      const count = pastListNow ? pastListNow.querySelectorAll(".event-card").length : 0;
      const h = document.getElementById("past-toggle");
      if (h) {
        const m = h.innerHTML.replace(/\(\d+\)/, `(${count})`);
        h.innerHTML = m;
      }
    }
  });
}

document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", load) : load();

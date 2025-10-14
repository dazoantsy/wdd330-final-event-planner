// /js/events-list.js — clean layout + actions
import { supabase } from "./api.js";
import { formatDateRange } from "./events.js";

const list = document.getElementById("events-list");
if (!list) console.warn("[EventsList] #events-list not found");

function card(ev) {
  // liens explicites dans le dossier /event-planner/
  const detailsURL = `/event-planner/event-details.html?id=${encodeURIComponent(ev.id)}`;
  const editURL = `/event-planner/edit-event.html?id=${encodeURIComponent(ev.id)}`;
  const date = formatDateRange(ev.start_date, ev.end_date);
  const time = ev.end_time ? ` • ${ev.end_time}` : "";

  return `
    <li class="event-card" data-id="${ev.id}">
      <div class="event-head">
        <a class="event-title" href="${detailsURL}">${ev.title || "Untitled"}</a>
        <div class="event-actions">
          <a class="btn sm" href="${detailsURL}">View</a>
          <a class="btn sm ghost" href="${editURL}">Edit</a>
          <button class="btn sm danger" data-action="delete" data-id="${ev.id}">Delete</button>
        </div>
      </div>
      <div class="event-meta">${date}${time}</div>
      <div class="event-loc">${ev.location || ""}</div>
    </li>
  `;
}


async function load() {
  const { data, error } = await supabase
    .from("events")
    .select("id,title,location,start_date,end_date,end_time")
    .order("start_date", { ascending: true }); // RLS filtre côté serveur

  if (error) { list.innerHTML = `<li class="error">${error.message}</li>`; return; }
  if (!data || data.length === 0) { list.innerHTML = `<li class="muted">No events found.</li>`; return; }

  list.innerHTML = data.map(card).join("");

  // Delete (delegation)
  list.addEventListener("click", async (e) => {
    const btn = e.target.closest('[data-action="delete"]');
    if (!btn) return;
    const id = btn.getAttribute("data-id");
    if (!id) return;
    if (!confirm("Delete this event?")) return;

    btn.disabled = true;
    const { error: delErr } = await supabase.from("events").delete().eq("id", id);
    if (delErr) { alert(delErr.message); btn.disabled = false; return; }
    list.querySelector(`.event-card[data-id="${id}"]`)?.remove();
    if (!list.querySelector(".event-card")) list.innerHTML = `<li class="muted">No events found.</li>`;
  });
}

document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", load) : load();

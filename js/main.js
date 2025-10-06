import { load, save } from "./storage.js";
import { ensureDemoUser } from "./auth.js";

ensureDemoUser();

const LIST_KEY = "ep-events"; // [{id,title,date,time,location,type,lat,lon,weather:{...}}]

function render() {
    const events = load(LIST_KEY, []);
    const ul = document.getElementById("events");
    ul.innerHTML = events.map(ev => `
    <li class="event-card" data-type="${ev.type}">
      <h3>${ev.title}</h3>
      <div class="badge">${ev.type}</div>
      <p>${ev.date} ${ev.time} — ${ev.location}</p>
      ${ev.weather ? `<p>${ev.weather.temp_c}°C · ${ev.weather.condition}</p>` : ""}
    </li>
  `).join("");
}
render();

// Expose for quick manual testing in console if needed:
window.__ep = { add(e) { const all = load(LIST_KEY, []); all.push(e); save(LIST_KEY, all); render(); } };

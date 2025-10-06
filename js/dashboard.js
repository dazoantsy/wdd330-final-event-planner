import { requireAuth, signOut } from "./auth.js";
import { load } from "./storage.js";

const user = requireAuth();
document.getElementById("greeting").textContent = `My Events — ${user.name}`;

document.getElementById("logout").addEventListener("click", () => {
    signOut();
    window.location.href = "../index.html";
});

// afficher événements existants
const events = load("ep-events", []);
const ul = document.getElementById("events");
ul.innerHTML = events.length
    ? events.map(ev => `
      <li class="event-card" data-type="${ev.type}">
        <h3>${ev.title}</h3>
        <div class="badge">${ev.type}</div>
        <p>${ev.date} ${ev.time} — ${ev.location}</p>
        ${ev.weather ? `<p>${ev.weather.temp_c}°C · ${ev.weather.condition}</p>` : ""}
      </li>
    `).join("")
    : `<li class="card">No events yet. <a href="create-event.html">Create one</a>.</li>`;

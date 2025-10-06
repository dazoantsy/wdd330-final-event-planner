import { load, save } from "./storage.js";

const LIST_KEY = "ep-events";
const box = document.getElementById("details");
const btnEdit = document.getElementById("edit");
const btnDel = document.getElementById("delete");

function q(key) { return new URLSearchParams(location.search).get(key); }
const id = q("id");

const events = load(LIST_KEY, []);
const ev = events.find(x => x.id === id);

function whenText(e) {
    const start = e.startDate ? `${e.startDate}${e.startTime ? " " + e.startTime : ""}` : "";
    const end = e.endDate ? `${e.endDate}${e.endTime ? " " + e.endTime : ""}` : "";
    return end ? `${start} → ${end}` : start;
}

if (!ev) {
    box.innerHTML = `<p>Event not found.</p>`;
} else {
    const wx = ev.weather;
    const wxLine = wx ? `${wx.icon ? wx.icon + " " : ""}${wx.temp_c ?? "—"}°C — ${wx.condition || "—"} <small>(${wx.provider})</small>` : "";
    box.innerHTML = `
    <h2 style="margin-top:0">${ev.title}</h2>
    <span class="badge">${ev.type}</span>
    <p><strong>When:</strong> ${whenText(ev)}</p>
    <p><strong>Location:</strong> ${ev.location || ""}</p>
    ${wx ? `<p><strong>Weather:</strong> ${wxLine}</p>` : ``}
    <p><strong>Description:</strong><br>${(ev.description || "").replace(/\n/g, "<br>")}</p>
  `;
}

btnEdit.addEventListener("click", () => {
    if (ev) window.location.href = `./edit-event.html?id=${encodeURIComponent(ev.id)}`;
});
btnDel.addEventListener("click", () => {
    if (!ev) return;
    if (confirm("Delete this event?")) {
        const next = events.filter(x => x.id !== ev.id);
        save(LIST_KEY, next);
        window.location.href = "./index.html";
    }
});

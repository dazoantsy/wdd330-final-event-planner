// /js/event-details.js  — Back + Details + Guests (owner / invited)
// Une seule variable de session: currentUser
import { supabase } from "./api.js";
import { formatDateRange, formatTimeRange } from "./events.js";

(function () {
  const $ = (sel) => document.querySelector(sel);
  const titleEl = $("#event-title");
  const timeEl = $("#event-time");
  const locationEl = $("#event-location");
  const notesEl = $("#event-notes");
  const btnEdit = $("#btn-edit");
  const btnDelete = $("#btn-delete");
  const btnBack = $("#btn-back");
  const errEl = $("#details-error");

  // Guests UI (peut ne pas exister si tu n'as pas ajouté la section)
  const ownerBox = document.getElementById("guests-owner");
  const selfBox = document.getElementById("guest-self");
  const cntP = document.getElementById("gcnt-p");
  const cntA = document.getElementById("gcnt-a");
  const cntM = document.getElementById("gcnt-m");
  const cntD = document.getElementById("gcnt-d");
  const listP = document.getElementById("glist-p");
  const listA = document.getElementById("glist-a");
  const listM = document.getElementById("glist-m");
  const listD = document.getElementById("glist-d");

  function getId() {
    const p = new URLSearchParams(location.search).get("id");
    return p && p.trim() ? p.trim() : null;
  }

  function setupBack() {
    const ref = document.referrer || "";
    const sameApp = ref.includes("/event-planner/");
    if (btnBack) {
      if (sameApp && window.history.length > 1) {
        btnBack.addEventListener("click", (e) => { e.preventDefault(); history.back(); });
      } else {
        btnBack.setAttribute("href", "/event-planner/index.html");
      }
    }
  }

  function liInvite(inv) {
    const when = new Date(inv.created_at).toLocaleString();
    return `<li class="item">
      <div class="row" style="justify-content:space-between;align-items:center;gap:10px;">
        <div>
          <div><strong>${inv.invitee_email}</strong></div>
          <div class="muted" style="font-size:.9rem">${when}</div>
        </div>
        <span class="badge">${inv.status || "pending"}</span>
      </div>
    </li>`;
  }

  // === Calendar helpers ===
  function pad(n) { return String(n).padStart(2, "0"); }
  function toUTCDateString(dt) {
    // dt = Date   -> "YYYYMMDDTHHMMSSZ"
    const y = dt.getUTCFullYear();
    const m = pad(dt.getUTCMonth() + 1);
    const d = pad(dt.getUTCDate());
    const H = pad(dt.getUTCHours());
    const M = pad(dt.getUTCMinutes());
    const S = pad(dt.getUTCSeconds());
    return `${y}${m}${d}T${H}${M}${S}Z`;
  }
  function buildGoogleCalURL({ title, description, location, startUTC, endUTC }) {
    const base = "https://calendar.google.com/calendar/render?action=TEMPLATE";
    const params = new URLSearchParams({
      text: title || "Event",
      details: description || "",
      location: location || "",
      dates: `${toUTCDateString(startUTC)}/${toUTCDateString(endUTC)}`
    });
    return `${base}&${params.toString()}`;
  }
  function buildICS({ uid, title, description, location, startUTC, endUTC }) {
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Event Planner//WDD330//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${toUTCDateString(new Date())}`,
      `DTSTART:${toUTCDateString(startUTC)}`,
      `DTEND:${toUTCDateString(endUTC)}`,
      `SUMMARY:${(title || "Event").replace(/\r?\n/g, " ")}`,
      `DESCRIPTION:${(description || "").replace(/\r?\n/g, " ")}`,
      `LOCATION:${(location || "").replace(/\r?\n/g, " ")}`,
      "END:VEVENT",
      "END:VCALENDAR"
    ];
    return lines.join("\r\n");
  }
  function downloadICS(filename, content) {
    const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }


  async function load() {
    setupBack();

    const id = getId();
    if (!id) { errEl.textContent = "Missing event id in URL."; return; }

    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) { errEl.textContent = error?.message || "Event not found or not accessible."; return; }

    titleEl.textContent = data.title || "Untitled";
    timeEl.textContent = `${formatDateRange(data.start_date, data.end_date)} ${formatTimeRange("", data.end_time)}`.trim();
    locationEl.textContent = data.location || "";
    notesEl.textContent = data.description || "";

    // === Add to Calendar buttons ===
    const btnGCal = document.getElementById("btn-gcal");
    const btnICS = document.getElementById("btn-ics");

    // calcule start/end UTC à partir des champs stockés
    const startUTC = new Date(data.start_date);
    let endUTC = data.end_date ? new Date(data.end_date) : null;
    if (!endUTC) endUTC = new Date(startUTC.getTime() + 60 * 60 * 1000); // défaut +1h

    // Google Calendar (ouvre l'éditeur pré-rempli)
    if (btnGCal) {
      btnGCal.href = buildGoogleCalURL({
        title: data.title,
        description: data.description,
        location: data.location,
        startUTC,
        endUTC
      });
    }

    // .ics (téléchargement)
    if (btnICS) {
      btnICS.addEventListener("click", (e) => {
        e.preventDefault();
        const ics = buildICS({
          uid: `${data.id}@event-planner`,
          title: data.title,
          description: data.description,
          location: data.location,
          startUTC,
          endUTC
        });
        const safe = (data.title || "event").replace(/[^\w\-]+/g, "_").slice(0, 50);
        downloadICS(`${safe}.ics`, ics);
      });
    }


    if (btnEdit) btnEdit.href = `./edit-event.html?id=${encodeURIComponent(id)}`;
    if (btnDelete) {
      btnDelete.addEventListener("click", async () => {
        if (!confirm("Delete this event?")) return;
        const { error: delErr } = await supabase.from("events").delete().eq("id", id);
        if (delErr) { alert(delErr.message); return; }
        location.href = `./index.html`;
      });
    }

    // -------- Session (déclarée UNE SEULE fois) --------
    const { data: userData } = await supabase.auth.getUser();
    const currentUser = userData?.user;

    // (Optionnel) petit badge "You are invited"
    if (currentUser?.email) {
      const { data: invRow } = await supabase
        .from("invitations")
        .select("status")
        .eq("event_id", id)
        .eq("invitee_email", currentUser.email)
        .maybeSingle();
      if (invRow) {
        titleEl.insertAdjacentHTML(
          "afterend",
          `<p class="badge" style="margin-top:6px">You are invited — status: ${invRow.status || "pending"}</p>`
        );
      }
    }

    // -------- Guests (owner vs invited) --------
    const isOwner = !!currentUser && data.user_id === currentUser.id;

    if (isOwner && ownerBox) {
      ownerBox.classList.remove("hidden");

      const { data: invs, error: invErr } = await supabase
        .from("invitations")
        .select("id,invitee_email,status,created_at")
        .eq("event_id", data.id)
        .order("created_at", { ascending: false });

      if (invErr) {
        if (listP) listP.innerHTML = `<li class="error">${invErr.message}</li>`;
      } else {
        let p = 0, a = 0, m = 0, d = 0;
        (invs || []).forEach(inv => {
          const st = (inv.status || "pending").toLowerCase();
          if (st === "accepted") { listA.insertAdjacentHTML("beforeend", liInvite(inv)); a++; }
          else if (st === "maybe") { listM.insertAdjacentHTML("beforeend", liInvite(inv)); m++; }
          else if (st === "declined") { listD.insertAdjacentHTML("beforeend", liInvite(inv)); d++; }
          else { listP.insertAdjacentHTML("beforeend", liInvite(inv)); p++; }
        });
        if (!p) listP.innerHTML = `<li class="muted">None.</li>`;
        if (!a) listA.innerHTML = `<li class="muted">None.</li>`;
        if (!m) listM.innerHTML = `<li class="muted">None.</li>`;
        if (!d) listD.innerHTML = `<li class="muted">None.</li>`;
        if (cntP) cntP.textContent = `(${p})`;
        if (cntA) cntA.textContent = `(${a})`;
        if (cntM) cntM.textContent = `(${m})`;
        if (cntD) cntD.textContent = `(${d})`;
      }

    } else if (currentUser?.email && selfBox) {
      selfBox.classList.remove("hidden");
      const stEl = document.getElementById("guest-self-status");
      const msgEl = document.getElementById("guest-self-msg");

      const { data: myInv } = await supabase
        .from("invitations")
        .select("id,status")
        .eq("event_id", data.id)
        .eq("invitee_email", currentUser.email)
        .maybeSingle();

      if (myInv) {
        stEl.textContent = myInv.status || "pending";
        selfBox.addEventListener("click", async (e) => {
          const btn = e.target.closest('[data-action="respond"]');
          if (!btn) return;
          const newStatus = btn.getAttribute("data-status");
          const { error: updErr } = await supabase
            .from("invitations")
            .update({ status: newStatus })
            .eq("id", myInv.id);
          if (updErr) { msgEl.textContent = updErr.message; return; }
          stEl.textContent = newStatus;
          msgEl.textContent = "Response saved.";
        });
      } else {
        stEl.textContent = "pending";
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load);
  } else {
    load();
  }
}());

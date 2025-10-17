// /js/dashboard.js — events + pending invites (sent) + invites for me (buckets)
import { supabase, getUserOrNull } from "./api.js?v=20251017";
import { formatDateRange } from "./events.js?v=20251017";

// Robust relative base (works from repo root or /event-planner/)
const BASE = location.pathname.includes('/event-planner/') ? './' : './event-planner/';

(function () {
  // ----- DOM -----
  const myEventsList = document.querySelector("#list-my-events");
  const myEventsCount = document.querySelector("#count-my-events");

  // NEW: list of events where I'm invited (non-pending)
  const invitedEventsList = document.querySelector("#list-invited-events");

  // "Pending Invitations" (sent by me)
  const sentInvList = document.querySelector("#list-my-invites");

  // "Invitations for Me" buckets
  const listPend = document.querySelector("#list-inv-me-pending");
  const listAcc = document.querySelector("#list-inv-me-accepted");
  const listMay = document.querySelector("#list-inv-me-maybe");
  const listDec = document.querySelector("#list-inv-me-declined");
  const cntPend = document.querySelector("#cnt-pend");
  const cntAcc = document.querySelector("#cnt-acc");
  const cntMay = document.querySelector("#cnt-may");
  const cntDec = document.querySelector("#cnt-dec");

  const toDetails = (id) => `${BASE}event-details.html?id=${encodeURIComponent(id)}`;
  const toEdit = (id) => `${BASE}edit-event.html?id=${encodeURIComponent(id)}`;

  // ===== Collapsible sections (no HTML changes required) =====
  const COLLAPSE_KEY = "invBucketsState"; // { "<ul-id>": true|false }
  function readCollapseState() {
    try { return JSON.parse(localStorage.getItem(COLLAPSE_KEY) || "{}"); } catch { return {}; }
  }
  function writeCollapseState(state) {
    try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify(state)); } catch { }
  }
  function setCollapsed(ul, header, open) {
    if (!ul || !header) return;
    ul.classList.toggle("hidden", !open);
    header.setAttribute("aria-expanded", String(open));
  }
  function headerize(h) {
    // rendre le <h3> cliquable accessible
    h.setAttribute("tabindex", "0");
    h.setAttribute("role", "button");
    h.style.cursor = "pointer";
  }
  function setupCollapsibles() {
    const ids = [
      "list-inv-me-pending",
      "list-inv-me-accepted",
      "list-inv-me-maybe",
      "list-inv-me-declined",
    ];
    const state = readCollapseState(); // défaut = fermé (false)
    ids.forEach((id) => {
      const ul = document.getElementById(id);
      if (!ul) return;
      // on prend le H3 juste au-dessus du UL
      let header = ul.previousElementSibling;
      // si le précédent n'est pas un h3 (markup différent), on remonte jusqu'à trouver un H3
      while (header && header.tagName !== "H3") header = header.previousElementSibling;
      if (!header) return;

      headerize(header);
      header.setAttribute("aria-controls", id);

      const open = Object.prototype.hasOwnProperty.call(state, id) ? !!state[id] : false;
      setCollapsed(ul, header, open);

      const toggle = () => {
        const next = !(header.getAttribute("aria-expanded") === "true");
        setCollapsed(ul, header, next);
        const s = readCollapseState();
        s[id] = next;
        writeCollapseState(s);
      };
      header.addEventListener("click", toggle);
      header.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
      });
    });
  }
  // ===========================================================

  // ----- Utils -----
  function buildCounts(invites) {
    const m = Object.create(null);
    for (const row of invites || []) m[row.event_id] = (m[row.event_id] || 0) + 1;
    return m;
  }

  function shortText(t, n = 160) {
    t = (t || "").trim();
    return t.length > n ? t.slice(0, n - 1) + "…" : t;
  }

  // ----- Renders -----
  function eventCard(ev, counts) {
    const n = counts[ev.id] || 0;
    const date = formatDateRange(ev.start_date, ev.end_date);
    const time = ev.end_time ? ` • ${ev.end_time}` : "";
    return `
      <li class="event-card" data-id="${ev.id}">
        <div class="event-head">
          <a class="event-title" href="${toDetails(ev.id)}">
            ${ev.title || "Untitled"} <span class="muted guests-count" aria-label="${n} guests">(${n} guests)
  <span class="sr-only">, total invited guests</span>
</span>

          </a>
          <div class="event-actions">
            <a class="btn sm" href="${BASE}event-details.html?id=${encodeURIComponent(ev.id)}">View</a>
            <a class="btn sm ghost" href="${BASE}edit-event.html?id=${encodeURIComponent(ev.id)}">Edit</a>
            <button class="btn sm" data-action="invite" data-id="${ev.id}">Invite people</button>
            <button class="btn sm danger" data-action="delete" data-id="${ev.id}">Delete</button>
          </div>
        </div>
        <div class="event-meta">${date}${time}</div>
        <div class="event-loc">${ev.location || ""}</div>

        <form class="invite-form hidden" data-id="${ev.id}">
          <input class="invite-input" type="email" placeholder="name@example.com" required />
          <button class="btn sm" type="submit">Send invite</button>
          <button class="btn sm ghost" type="button" data-action="cancel-invite">Cancel</button>
        </form>
        <p class="invite-msg muted" aria-live="polite"></p>
      </li>
    `;
  }

  function renderEvents(rows, counts) {
    if (!myEventsList) return;
    if (myEventsCount) myEventsCount.textContent = `(${rows?.length || 0})`;
    if (!rows || !rows.length) {
      myEventsList.innerHTML = `<li class="muted">No events yet.</li>`;
      return;
    }
    myEventsList.innerHTML = rows.map((ev) => eventCard(ev, counts)).join("");
  }

  function renderSentInvites(rows) {
    if (!sentInvList) return;
    if (!rows || !rows.length) {
      sentInvList.innerHTML = `<li class="muted">No pending invitations.</li>`;
      return;
    }
    sentInvList.innerHTML = rows.map((inv) => {
      const when = new Date(inv.created_at).toLocaleString();
      return `
        <li class="item">
          <div class="row" style="gap:10px;align-items:center;justify-content:space-between;">
            <div>
              <div><strong>${inv.invitee_email}</strong></div>
              <div class="muted" style="font-size:.9rem">${when}</div>
            </div>
            <span class="badge">${inv.status || "pending"}</span>
          </div>
        </li>
      `;
    }).join("");
  }

  function inviteMeCard(inv, ev, showActions) {
    const date = ev ? formatDateRange(ev.start_date, ev.end_date) : "";
    const loc = ev?.location || "";
    const desc = shortText(ev?.description || "");
    const status = inv.status || "pending";
    return `
      <li class="item inv-card" data-inv-id="${inv.id}" data-ev-id="${inv.event_id}">
        <div class="row" style="justify-content:space-between;align-items:flex-start;gap:12px;">
          <div style="flex:1 1 auto;">
            <div><a class="event-title" href="${toDetails(inv.event_id)}">${ev?.title || "Event"}</a>
              <span class="muted">— ${new Date(inv.created_at).toLocaleString()}</span>
            </div>
            <div class="muted" style="margin-top:4px;">${date}</div>
            <div class="muted" style="margin-top:4px;">${loc}</div>
            ${desc ? `<div class="muted" style="margin-top:6px;">${desc}</div>` : ""}
          </div>
          <div class="actions" style="flex:0 0 auto; display:flex; gap:8px; align-items:center;">
            <span class="badge" data-role="status">${status}</span>
            ${showActions
        ? `
              <button class="btn sm" data-action="respond" data-status="accepted">Accept</button>
              <button class="btn sm ghost" data-action="respond" data-status="maybe">Maybe</button>
              <button class="btn sm danger" data-action="respond" data-status="declined">Decline</button>
            `
        : `<button class="btn sm ghost" data-action="change-response">Change response</button>`}
          </div>
        </div>
      </li>
    `;
  }

  function renderInvitesBuckets(invs, eventsById) {
    if (!listAcc || !listMay || !listDec || !cntAcc || !cntMay || !cntDec) return;

    listPend && (listPend.innerHTML = "");
    listAcc.innerHTML = "";
    listMay.innerHTML = "";
    listDec.innerHTML = "";

    let nP = 0, nA = 0, nM = 0, nD = 0;

    if (!invs || !invs.length) {
      if (listPend) listPend.innerHTML = `<li class="muted">None.</li>`;
      listAcc.innerHTML = `<li class="muted">None.</li>`;
      listMay.innerHTML = `<li class="muted">None.</li>`;
      listDec.innerHTML = `<li class="muted">None.</li>`;
      cntPend && (cntPend.textContent = "(0)");
      cntAcc.textContent = "(0)";
      cntMay.textContent = "(0)";
      cntDec.textContent = "(0)";
      return;
    }

    for (const inv of invs) {
      const st = (inv.status || "pending").toLowerCase();
      const ev = eventsById[inv.event_id];

      if (st === "accepted") {
        const html = inviteMeCard(inv, ev, false);
        listAcc.insertAdjacentHTML("beforeend", html);
        nA++;
      } else if (st === "maybe") {
        const html = inviteMeCard(inv, ev, false);
        listMay.insertAdjacentHTML("beforeend", html);
        nM++;
      } else if (st === "declined") {
        const html = inviteMeCard(inv, ev, false);
        listDec.insertAdjacentHTML("beforeend", html);
        nD++;
      } else {
        const html = inviteMeCard(inv, ev, true);
        if (listPend) {
          listPend.insertAdjacentHTML("beforeend", html);
          nP++;
        } else {
          listMay.insertAdjacentHTML("beforeend", html);
          nM++;
        }
      }
    }

    if (listPend && !nP) listPend.innerHTML = `<li class="muted">None.</li>`;
    if (!nA) listAcc.innerHTML = listAcc.innerHTML || `<li class="muted">None.</li>`;
    if (!nM) listMay.innerHTML = listMay.innerHTML || `<li class="muted">None.</li>`;
    if (!nD) listDec.innerHTML = listDec.innerHTML || `<li class="muted">None.</li>`;

    cntPend && (cntPend.textContent = `(${nP})`);
    cntAcc.textContent = `(${nA})`;
    cntMay.textContent = `(${nM})`;
    cntDec.textContent = `(${nD})`;
  }

  // Helpers for "Events I’m Invited To"
  function invitedEventCard(ev) {
    const title = ev?.title || "Untitled";
    const date = formatDateRange(ev.start_date, ev.end_date);
    const loc = ev?.location || "";
    const detailsURL = `${BASE}event-details.html?id=${encodeURIComponent(ev.id)}`;
    return `
      <li class="item event-card" data-invited-ev-id="${ev.id}">
        <div class="event-head">
          <a class="event-title" href="${detailsURL}">${title}</a>
          <div class="event-actions">
            <a class="btn sm" href="${detailsURL}">View</a>
          </div>
        </div>
        <div class="muted">${date}</div>
        <div class="event-loc">${loc}</div>
      </li>
    `;
  }

  async function addInvitedEventById(eventId) {
    if (!invitedEventsList) return;
    // already there?
    if (invitedEventsList.querySelector(`[data-invited-ev-id="${eventId}"]`)) return;
    const { data: ev, error } = await supabase
      .from("events")
      .select("id,title,location,description,start_date,end_date,end_time")
      .eq("id", eventId)
      .single();
    if (error || !ev) return;
    invitedEventsList.insertAdjacentHTML("afterbegin", invitedEventCard(ev));
    // remove “No invited events yet.”
    const empty = invitedEventsList.querySelector(".muted");
    if (empty && invitedEventsList.querySelectorAll("[data-invited-ev-id]").length) {
      empty.remove();
    }
  }

  function removeInvitedEventById(eventId) {
    if (!invitedEventsList) return;
    invitedEventsList.querySelector(`[data-invited-ev-id="${eventId}"]`)?.remove();
    if (!invitedEventsList.querySelector("[data-invited-ev-id]")) {
      invitedEventsList.innerHTML = `<li class="muted">No invited events yet.</li>`;
    }
  }

  function renderInvitedEvents(events = []) {
    if (!invitedEventsList) return;
    if (!events.length) {
      invitedEventsList.innerHTML = `<li class="muted">No invited events yet.</li>`;
      return;
    }
    invitedEventsList.innerHTML = events.map(invitedEventCard).join("");
  }

  // ----- Load -----
  async function load() {
    // init collapsibles (fermé par défaut, état mémorisé)
    setupCollapsibles();

    const user = await getUserOrNull();
    if (!user) {
      location.replace("./index.html");
      return;
    }

    // Only my own events
    const { data: evs, error: e1 } = await supabase
      .from("events")
      .select("id,title,location,description,start_date,end_date,end_time")
      .eq("user_id", user.id)
      .order("start_date", { ascending: true });

    if (e1) {
      if (myEventsList) myEventsList.innerHTML = `<li class="error">${e1.message}</li>`;
      return;
    }

    // Invitations sent by me (pending)
    const { data: sentInvsPending } = await supabase
      .from("invitations")
      .select("id,event_id,invitee_email,status,created_at,inviter_id")
      .eq("inviter_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    renderSentInvites(sentInvsPending || []);

    // Counts for guests
    const { data: sentInvsAll } = await supabase
      .from("invitations")
      .select("event_id")
      .eq("inviter_id", user.id);
    const counts = buildCounts(sentInvsAll || []);
    renderEvents(evs || [], counts);

    // reopen last invite form if any
    try {
      const openId = localStorage.getItem("dashboard_invite_open");
      if (openId) {
        const card = myEventsList?.querySelector(`.event-card[data-id="${openId}"]`);
        const form = card?.querySelector(".invite-form");
        form?.classList.remove("hidden");
      }
    } catch { }

    // Invitations for me
    const myEmail = user.email;
    const { data: invsForMe } = await supabase
      .from("invitations")
      .select("id,event_id,invitee_email,status,created_at")
      .ilike("invitee_email", myEmail)
      .order("created_at", { ascending: false });

    const evIds = [...new Set((invsForMe || []).map((i) => i.event_id))];
    let eventsById = {};
    if (evIds.length) {
      const { data: evMeta } = await supabase
        .from("events")
        .select("id,title,location,description,start_date,end_date")
        .in("id", evIds);
      for (const e of evMeta || []) eventsById[e.id] = e;
    }

    renderInvitesBuckets(invsForMe || [], eventsById);

    // Populate invited events (only non-pending)
    const responded = (invsForMe || []).filter(
      i => ["accepted", "maybe", "declined"].includes((i.status || "").toLowerCase())
    );
    const invitedEvents = responded.map(i => eventsById[i.event_id]).filter(Boolean);
    renderInvitedEvents(invitedEvents);
  }

  // ----- Event list actions -----
  myEventsList?.addEventListener("click", async (e) => {
    const delBtn = e.target.closest('[data-action="delete"]');
    if (delBtn) {
      const id = delBtn.getAttribute("data-id");
      if (!id) return;
      if (!confirm("Delete this event?")) return;
      delBtn.disabled = true;
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) {
        alert(error.message);
        delBtn.disabled = false;
        return;
      }
      myEventsList.querySelector(`.event-card[data-id="${id}"]`)?.remove();
      const remaining = myEventsList.querySelectorAll(".event-card").length;
      if (myEventsCount) myEventsCount.textContent = `(${remaining})`;
      if (!remaining) myEventsList.innerHTML = `<li class="muted">No events yet.</li>`;
      return;
    }

    const inviteBtn = e.target.closest('[data-action="invite"]');
    if (inviteBtn) {
      const id = inviteBtn.getAttribute("data-id");
      const card = myEventsList.querySelector(`.event-card[data-id="${id}"]`);
      const form = card?.querySelector(".invite-form");
      form?.classList.remove("hidden");
      const formId = `invite-form-${id}`;
      form.id = formId;
      inviteBtn.setAttribute("aria-controls", formId);
      inviteBtn.setAttribute("aria-expanded", "true");
      const input = card?.querySelector(".invite-input");
      input?.focus();
      try { localStorage.setItem("dashboard_invite_open", id); } catch { }
      return;
    }

    const cancelBtn = e.target.closest('[data-action="cancel-invite"]');
    if (cancelBtn) {
      const form = cancelBtn.closest(".invite-form");
      const card = cancelBtn.closest(".event-card");
      const btn = card?.querySelector('[data-action="invite"]');
      form?.classList.add("hidden");
      form?.reset?.();
      btn?.setAttribute("aria-expanded", "false");
      btn?.focus();
      return;
    }
  });

  // send invite
  myEventsList?.addEventListener("submit", async (e) => {
    const form = e.target.closest(".invite-form");
    if (!form) return;
    e.preventDefault();

    if (!form.checkValidity()) { form.reportValidity(); return; }

    const eventId = form.getAttribute("data-id");
    const input = form.querySelector(".invite-input");
    const msg = form.parentElement.querySelector(".invite-msg");
    const email = (input.value || "").trim();
    if (!email) { msg.textContent = "Please enter an email."; return; }

    const { data: u } = await supabase.auth.getUser();
    const inviterId = u?.user?.id;
    if (!inviterId) { msg.textContent = "Not signed in."; return; }

    const emailLC = email.toLowerCase();
    const { error } = await supabase
      .from("invitations")
      .insert({ event_id: eventId, inviter_id: inviterId, invitee_email: emailLC });

    if (error) { msg.textContent = error.message; return; }

    form.classList.add("hidden");
    form.reset();
    msg.textContent = "Invitation sent.";
    msg.setAttribute("role", "status");

    const title = form.parentElement.querySelector(".guests-count");
    if (title) {
      const m = /\((\d+)\s+guests\)/i.exec(title.textContent || "");
      const current = m ? parseInt(m[1], 10) : 0;
      title.textContent = `(${current + 1} guests)`;
    }

    if (sentInvList) {
      const now = new Date().toLocaleString();
      sentInvList.insertAdjacentHTML("afterbegin", `
        <li class="item">
          <div class="row" style="gap:10px;align-items:center;justify-content:space-between;">
            <div>
              <div><strong>${emailLC}</strong></div>
              <div class="muted" style="font-size:.9rem">${now}</div>
            </div>
            <span class="badge">pending</span>
          </div>
        </li>
      `);
    }
  });

  // ----- Invitations for Me: respond / change response -----
  function placeInBucket(li, status) {
    if (!listAcc || !listMay || !listDec || !cntAcc || !cntMay || !cntDec) return;

    const html = li.outerHTML.replace(
      /(<span class="badge"[^>]*>)([^<]+)(<\/span>)/i,
      `$1${status}$3`
    );
    const eventId = li.getAttribute("data-ev-id"); // keep before remove
    li.remove();

    if (status === "accepted") listAcc.insertAdjacentHTML("afterbegin", html);
    else if (status === "maybe") listMay.insertAdjacentHTML("afterbegin", html);
    else listDec.insertAdjacentHTML("afterbegin", html);

    const placed =
      (status === "accepted" ? listAcc : status === "maybe" ? listMay : listDec).querySelector(
        ".inv-card"
      );
    if (placed) {
      const actions = placed.querySelector(".actions");
      actions.querySelectorAll('[data-action="respond"]').forEach((b) => b.remove());
      const hasChange = actions.querySelector('[data-action="change-response"]');
      if (!hasChange) {
        actions.insertAdjacentHTML(
          "beforeend",
          `<button class="btn sm ghost" data-action="change-response">Change response</button>`
        );
      }
    }

    cntPend && (cntPend.textContent = `(${document.querySelectorAll("#list-inv-me-pending .inv-card").length})`);
    cntAcc.textContent = `(${listAcc.querySelectorAll(".inv-card").length})`;
    cntMay.textContent = `(${listMay.querySelectorAll(".inv-card").length})`;
    cntDec.textContent = `(${listDec.querySelectorAll(".inv-card").length})`;

    // --- LIVE SYNC with "Events I'm Invited To" ---
    if (status === "accepted" || status === "maybe") {
      addInvitedEventById(eventId);   // add/update immediately
    } else if (status === "declined") {
      removeInvitedEventById(eventId);
    }
  }

  document.getElementById("inv-me")?.addEventListener("click", async (e) => {
    const respBtn = e.target.closest('[data-action="respond"]');
    if (respBtn) {
      const li = respBtn.closest(".inv-card");
      const id = li?.getAttribute("data-inv-id");
      const newStatus = respBtn.getAttribute("data-status");
      if (!id || !newStatus) return;

      const { error } = await supabase.from("invitations").update({ status: newStatus }).eq("id", id);
      if (error) { alert(error.message); return; }
      placeInBucket(li, newStatus);
      return;
    }

    const changeBtn = e.target.closest('[data-action="change-response"]');
    if (changeBtn) {
      const actions = changeBtn.closest(".actions");
      changeBtn.remove();
      actions.insertAdjacentHTML("beforeend", `
        <button class="btn sm" data-action="respond" data-status="accepted">Accept</button>
        <button class="btn sm ghost" data-action="respond" data-status="maybe">Maybe</button>
        <button class="btn sm danger" data-action="respond" data-status="declined">Decline</button>
      `);
    }
  });

  // ----- Boot -----
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load);
  } else {
    load();
  }
})();

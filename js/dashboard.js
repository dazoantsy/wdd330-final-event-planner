// /js/dashboard.js — events + pending invites (sent) + invites for me (buckets)
import { supabase, getUserOrNull } from "./api.js";
import { formatDateRange } from "./events.js";

(function () {
  // ----- DOM -----
  const myEventsList = document.querySelector("#list-my-events");
  const myEventsCount = document.querySelector("#count-my-events");

  // "Pending Invitations" (sent by me)
  const sentInvList = document.querySelector("#list-my-invites");

  // "Invitations for Me" buckets
  const listAcc = document.querySelector("#list-inv-me-accepted");
  const listMay = document.querySelector("#list-inv-me-maybe");
  const listDec = document.querySelector("#list-inv-me-declined");
  const cntAcc = document.querySelector("#cnt-acc");
  const cntMay = document.querySelector("#cnt-may");
  const cntDec = document.querySelector("#cnt-dec");

  const toDetails = (id) => `./event-details.html?id=${encodeURIComponent(id)}`;
  const toEdit = (id) => `./edit-event.html?id=${encodeURIComponent(id)}`;

  // ----- Utils -----
  function buildCounts(invites) {
    // { event_id: totalInvitesAllStatuses }
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
    const n = counts[ev.id] || 0; // total all statuses
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
            <a class="btn sm" href="${toDetails(ev.id)}">View</a>
            <a class="btn sm ghost" href="${toEdit(ev.id)}">Edit</a>
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
    if (!sentInvList) return; // section optionnelle
    if (!rows || !rows.length) {
      sentInvList.innerHTML = `<li class="muted">No pending invitations.</li>`;
      return;
    }
    sentInvList.innerHTML = rows
      .map((inv) => {
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
      })
      .join("");
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

    listAcc.innerHTML = "";
    listMay.innerHTML = "";
    listDec.innerHTML = "";
    let nA = 0,
      nM = 0,
      nD = 0;

    if (!invs || !invs.length) {
      listAcc.innerHTML = `<li class="muted">None.</li>`;
      listMay.innerHTML = `<li class="muted">None.</li>`;
      listDec.innerHTML = `<li class="muted">None.</li>`;
      cntAcc.textContent = "(0)";
      cntMay.textContent = "(0)";
      cntDec.textContent = "(0)";
      return;
    }

    for (const inv of invs) {
      const ev = eventsById[inv.event_id];
      const showActions = !["accepted", "maybe", "declined"].includes(inv.status || "");
      const html = inviteMeCard(inv, ev, showActions);
      const st = (inv.status || "pending").toLowerCase();
      if (st === "accepted") {
        listAcc.insertAdjacentHTML("beforeend", html);
        nA++;
      } else if (st === "maybe") {
        listMay.insertAdjacentHTML("beforeend", html);
        nM++;
      } else if (st === "declined") {
        listDec.insertAdjacentHTML("beforeend", html);
        nD++;
      } else {
        // pending -> on le met dans Maybe par défaut (ou crée une 4e section si tu préfères)
        listMay.insertAdjacentHTML("beforeend", html);
        nM++;
      }
    }
    cntAcc.textContent = `(${nA})`;
    cntMay.textContent = `(${nM})`;
    cntDec.textContent = `(${nD})`;
  }

  // ----- Load -----
  async function load() {
    const user = await getUserOrNull();
    if (!user) {
      location.replace("./index.html");
      return;
    }

    // EVENTS (RLS filtre par propriétaire)
    const { data: evs, error: e1 } = await supabase
      .from("events")
      .select("id,title,location,description,start_date,end_date,end_time")
      .order("start_date", { ascending: true });

    if (e1) {
      if (myEventsList) myEventsList.innerHTML = `<li class="error">${e1.message}</li>`;
      return;
    }

    // ----- Invitations envoyées par moi -----
    // (a) Section "Pending Invitations" : seulement pending
    const { data: sentInvsPending } = await supabase
      .from("invitations")
      .select("id,event_id,invitee_email,status,created_at,inviter_id")
      .eq("inviter_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    renderSentInvites(sentInvsPending || []);

    // (b) Compteur "(n guests)" : toutes les invitations (tous statuts)
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


    // ----- Invitations pour moi (classified buckets) -----
    const myEmail = user.email;
    const { data: invsForMe } = await supabase
      .from("invitations")
      .select("id,event_id,invitee_email,status,created_at")
      .eq("invitee_email", myEmail)
      .order("created_at", { ascending: false });

    // pour afficher les détails d'event dans les cartes d'invitation
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
      // A11y: relier le bouton et le formulaire
      const formId = `invite-form-${id}`;
      form.id = formId;
      inviteBtn.setAttribute("aria-controls", formId);
      inviteBtn.setAttribute("aria-expanded", "true");
      // focus dans le champ email
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
      // A11y: effondrer l’état et rendre le focus au bouton
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

    // Validation HTML5 (email requis et valide)
    if (!form.checkValidity()) { form.reportValidity(); return; }

    const eventId = form.getAttribute("data-id");
    const input = form.querySelector(".invite-input");
    const msg = form.parentElement.querySelector(".invite-msg");
    const email = (input.value || "").trim();
    if (!email) {
      msg.textContent = "Please enter an email.";
      return;
    }

    const { data: u } = await supabase.auth.getUser();
    const inviterId = u?.user?.id;
    if (!inviterId) {
      msg.textContent = "Not signed in.";
      return;
    }

    const { error } = await supabase
      .from("invitations")
      .insert({ event_id: eventId, inviter_id: inviterId, invitee_email: email });

    if (error) {
      msg.textContent = error.message;
      return;
    }

    // UI success
    form.classList.add("hidden");
    form.reset();
    msg.textContent = "Invitation sent.";
    msg.setAttribute("role", "status"); // annonce explicite
    msg.focus?.(); // (si focusable via CSS; sinon laisse tel quel)


    // bump local "(n guests)" counter
    const title = form.parentElement.querySelector(".guests-count");
    if (title) {
      const m = /\((\d+)\s+guests\)/i.exec(title.textContent || "");
      const current = m ? parseInt(m[1], 10) : 0;
      title.textContent = `(${current + 1} guests)`;
    }

    // add to "Pending Invitations" list if section exists
    if (sentInvList) {
      const now = new Date().toLocaleString();
      sentInvList.insertAdjacentHTML(
        "afterbegin",
        `
        <li class="item">
          <div class="row" style="gap:10px;align-items:center;justify-content:space-between;">
            <div>
              <div><strong>${email}</strong></div>
              <div class="muted" style="font-size:.9rem">${now}</div>
            </div>
            <span class="badge">pending</span>
          </div>
        </li>
      `
      );
    }
  });

  // ----- Invitations for Me: respond / change response -----
  function placeInBucket(li, status) {
    if (!listAcc || !listMay || !listDec || !cntAcc || !cntMay || !cntDec) return;

    const html = li.outerHTML.replace(
      /(<span class="badge"[^>]*>)([^<]+)(<\/span>)/i,
      `$1${status}$3`
    );
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

    cntAcc.textContent = `(${listAcc.querySelectorAll(".inv-card").length})`;
    cntMay.textContent = `(${listMay.querySelectorAll(".inv-card").length})`;
    cntDec.textContent = `(${listDec.querySelectorAll(".inv-card").length})`;
  }

  document.getElementById("inv-me")?.addEventListener("click", async (e) => {
    const respBtn = e.target.closest('[data-action="respond"]');
    if (respBtn) {
      const li = respBtn.closest(".inv-card");
      const id = li?.getAttribute("data-inv-id");
      const newStatus = respBtn.getAttribute("data-status");
      if (!id || !newStatus) return;

      const { error } = await supabase.from("invitations").update({ status: newStatus }).eq("id", id);
      if (error) {
        alert(error.message);
        return;
      }
      placeInBucket(li, newStatus);
      return;
    }

    const changeBtn = e.target.closest('[data-action="change-response"]');
    if (changeBtn) {
      const actions = changeBtn.closest(".actions");
      changeBtn.remove();
      actions.insertAdjacentHTML(
        "beforeend",
        `
        <button class="btn sm" data-action="respond" data-status="accepted">Accept</button>
        <button class="btn sm ghost" data-action="respond" data-status="maybe">Maybe</button>
        <button class="btn sm danger" data-action="respond" data-status="declined">Decline</button>
      `
      );
    }
  });

  // ----- Boot -----
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load);
  } else {
    load();
  }
})();

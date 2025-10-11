// js/layout.js — Header & Footer dynamiques pour toutes les pages

// ——— Utilitaires
const $ = (s, r = document) => r.querySelector(s);

// Permet d'indiquer un préfixe de chemins si la page est dans un sous-dossier.
// Ex: <body data-root="../"> pour remonter d'un niveau.
const ROOT = (document.body?.dataset?.root || "").replace(/\/?$/, "/").replace(/^\/+/, "");

// Construit une URL relative en respectant ROOT
const url = (path) => (ROOT ? ROOT : "") + path.replace(/^\/+/, "");

// Vérifie si un lien correspond à la page en cours (pour activer l’onglet)
function isActive(target) {
    try {
        const here = new URL(location.href);
        const there = new URL(url(target), location.origin);
        // active si le fichier correspond (ignore le querystring)
        return here.pathname.replace(/\/+$/, "") === there.pathname.replace(/\/+$/, "");
    } catch {
        return false;
    }
}

// Crée un <a> avec classes / état actif
function navLink(href, label, extra = "") {
    const active = isActive(href) ? "active" : "";
    return `<a class="btn ${extra} ${active}" href="${url(href)}">${label}</a>`;
}

// ——— Header
function renderHeader() {
    const host = $('[data-header]') || $('#siteHeader') || $('header');
    if (!host) return;

    host.innerHTML = `
    <div class="site-header container">
      <div class="brand">
        <a class="logo" href="${url('index.html')}" aria-label="Event Planner Home">
          <img src="${url('img/logo.svg')}" alt="" onerror="this.style.display='none'">
          <span>Event Planner</span>
        </a>
      </div>

      <nav class="nav">
        ${navLink('create-event.html', 'Create')}
        ${navLink('dashboard.html', 'Dashboard')}
        ${navLink('index.html', 'Events')}
      </nav>

      <div class="auth-box">
        <span id="userEmail" class="user-email"></span>
        <a id="signOutLink" class="btn subtle" href="#" style="display:none">Sign out</a>
      </div>
    </div>
  `;
}

// ——— Footer
function renderFooter() {
    const host = $('[data-footer]') || $('#siteFooter') || $('footer');
    if (!host) return;

    const year = new Date().getFullYear();
    host.innerHTML = `
    <div class="site-footer container">
      <div>© ${year} Event Planner</div>
      <div class="links">
        <a href="${url('index.html')}">Home</a>
        <span aria-hidden="true">·</span>
        <a href="${url('dashboard.html')}">Dashboard</a>
      </div>
    </div>
  `;
}

// ——— Styles minimaux (optionnel : si ton style.css ne couvre pas ces classes)
function injectBaseStyles() {
    if (document.getElementById("layout-base-styles")) return;
    const css = `
  .site-header,.site-footer{display:flex;align-items:center;justify-content:space-between;gap:1rem}
  .site-header{padding:.75rem 0;border-bottom:1px solid rgba(255,255,255,.07)}
  .site-footer{padding:1.25rem 0;border-top:1px solid rgba(255,255,255,.07);opacity:.85}
  .brand .logo{display:flex;align-items:center;gap:.5rem;font-weight:700;text-decoration:none}
  .brand .logo img{height:28px;width:auto}
  .nav{display:flex;gap:.5rem;flex-wrap:wrap}
  .auth-box{display:flex;gap:.75rem;align-items:center}
  .user-email{opacity:.9}
  .btn{display:inline-block;padding:.45rem .8rem;border-radius:.6rem;border:1px solid rgba(255,255,255,.12);text-decoration:none}
  .btn:hover{background:rgba(255,255,255,.06)}
  .btn.subtle{border-color:transparent}
  .btn.active{outline:2px solid rgba(99,102,241,.7)}
  .container{max-width:1100px;margin:0 auto;padding:0 1rem}
  `;
    const style = document.createElement("style");
    style.id = "layout-base-styles";
    style.textContent = css;
    document.head.appendChild(style);
}

// ——— Boot
function initLayout() {
    injectBaseStyles();
    renderHeader();
    renderFooter();
}
document.addEventListener("DOMContentLoaded", initLayout);

/* js/headerFooter.js
 * Insère header.html et footer.html et corrige les chemins suivant la page :
 *
 * - Les partiels se trouvent dans /event-planner/
 *   - Page à la racine           : <body data-partials="event-planner/">
 *   - Page dans /event-planner/  : <body data-root="../" data-partials="">
 *
 * - ROOT     : préfixe pour rejoindre la racine des assets ("" à la racine, "../" dans /event-planner/)
 * - PARTIALS : chemin vers le dossier des partiels relativement à la page courante
 *
 * NB : si quelqu’un a mis par erreur data-root="event-planner/" à la racine,
 *      on corrige automatiquement pour que ça continue à marcher.
 */

(function () {
  "use strict";

  const ds = document.body?.dataset || {};
  let ROOT = ds.root || "";
  let PARTIALS = ds.partials || "";

  // Normalisation : ajouter un '/' final si non vide et absent
  const withSlash = (s) => (s && !s.endsWith("/") ? s + "/" : s || "");

  // Cas d'usage ancien/erroné : data-root="event-planner/" sur la page racine
  // => on interprète ça comme PARTIALS="event-planner/" et ROOT=""
  if (!PARTIALS && ROOT && /event-planner\/?$/.test(ROOT)) {
    PARTIALS = ROOT;
    ROOT = "";
  }

  ROOT = withSlash(ROOT);           // ""  ou "../"
  PARTIALS = withSlash(PARTIALS);   // ""  ou "event-planner/"

  // Sélecteur rapide
  const $ = (s, r = document) => r.querySelector(s);

  // Lien interne (pas http(s), pas mailto/tel, pas hash)
  function isInternal(href) {
    return (
      href &&
      !/^([a-z]+:)?\/\//i.test(href) &&
      !href.startsWith("#") &&
      !href.startsWith("mailto:") &&
      !href.startsWith("tel:")
    );
  }

  // Réécrit les chemins du fragment injecté :
  // - liens de nav (a[href])  : préfixe PARTIALS si on inclut depuis la racine
  // - assets (img/src, link[rel=icon]/href) : préfixe ROOT pour viser /assets depuis /event-planner/
  function rewritePaths(host) {
    // Liens (nav, etc.)
    host.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href");
      if (!isInternal(href)) return;
      a.setAttribute("href", (PARTIALS ? PARTIALS : "") + href.replace(/^\.?\//, ""));
    });

    // Images + favicon
    host.querySelectorAll("img[src], link[rel='icon'][href]").forEach((el) => {
      const attr = el.tagName === "IMG" ? "src" : "href";
      const val = el.getAttribute(attr);
      if (!isInternal(val)) return;
      el.setAttribute(attr, ROOT + val.replace(/^\.?\//, ""));
    });
  }

  // Met .active sur le lien correspondant à la page courante
  function highlightActiveNav(headerHost) {
    if (!headerHost) return;
    const here = location.pathname.split("/").pop() || "index.html";
    headerHost.querySelectorAll("nav a[href]").forEach((a) => {
      const href = (a.getAttribute("href") || "").split("#")[0].split("?")[0];
      const file = href.split("/").pop();
      if (file === here) a.classList.add("active");
    });
  }

  // Remplit l'année (#footerYear) si présent
  function fillYear(footerHost) {
    const y = footerHost?.querySelector("#footerYear");
    if (y) y.textContent = new Date().getFullYear();
  }

  // Injecte un partiel
  async function inject(targetId, file) {
    const host = document.getElementById(targetId);
    if (!host) return null;

    const url = PARTIALS + file; // "event-planner/header.html" (à la racine) ou "header.html" (dans /event-planner/)
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`${url}: ${res.status}`);
      const html = await res.text();
      host.innerHTML = html;

      rewritePaths(host);
      return host;
    } catch (err) {
      console.error("[headerFooter] failed to fetch:", err);
      host.innerHTML = "";
      return null;
    }
  }

  async function boot() {
    const headerHost = await inject("header", "header.html");
    highlightActiveNav(headerHost);

    const footerHost = await inject("footer", "footer.html");
    fillYear(footerHost);

    document.dispatchEvent(new CustomEvent("partials:ready"));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

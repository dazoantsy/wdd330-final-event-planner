// js/headerFooter.js — insère header.html et footer.html dans #header / #footer
// - Gère un préfixe de chemins via <body data-root="../"> si la page est dans un sous-dossier
// - Préfixe les liens internes du header/footer
// - Met l’onglet de nav "actif"
// - Remplit l'année dans le footer

(function () {
    const $ = (s, r = document) => r.querySelector(s);
    const ROOT = (document.body?.dataset?.root || "./").replace(/\/?$/, "/");

    // Détermine si href est un lien interne "fichier" (pas http, mailto, tel, #)
    function isInternal(href) {
        return href &&
            !/^([a-z]+:)?\/\//i.test(href) &&
            !href.startsWith("#") &&
            !href.startsWith("mailto:") &&
            !href.startsWith("tel:");
    }

    async function inject(targetId, file) {
        const host = document.getElementById(targetId);
        if (!host) return null;

        const res = await fetch(ROOT + file, { cache: "no-cache" });
        host.innerHTML = await res.text();

        // Préfixer les liens internes
        host.querySelectorAll("a[href]").forEach(a => {
            const href = a.getAttribute("href");
            if (isInternal(href)) {
                a.setAttribute("href", ROOT + href.replace(/^\.?\//, ""));
            }
        });

        return host;
    }

    // Met la classe .active sur le lien du header correspondant à la page courante
    function highlightActiveNav(headerHost) {
        if (!headerHost) return;
        const here = new URL(location.href);
        headerHost.querySelectorAll("nav a[href]").forEach(a => {
            try {
                const there = new URL(a.href, location.origin);
                if (here.pathname.replace(/\/+$/, "") === there.pathname.replace(/\/+$/, "")) {
                    a.classList.add("active");
                }
            } catch { }
        });
    }

    // Remplit l'année dans le footer
    function fillYear(footerHost) {
        const y = footerHost?.querySelector("#footerYear");
        if (y) y.textContent = new Date().getFullYear();
    }

    async function boot() {
        // Injecter header puis footer
        const headerHost = await inject("header", "header.html");
        highlightActiveNav(headerHost);

        const footerHost = await inject("footer", "footer.html");
        fillYear(footerHost);

        // Signaler que les fragments sont prêts (utile si d'autres scripts veulent agir ensuite)
        document.dispatchEvent(new CustomEvent("partials:ready"));
    }

    document.addEventListener("DOMContentLoaded", boot);
})();

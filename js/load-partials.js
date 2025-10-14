// /js/load-partials.js — injecte header/footer et corrige les liens selon l’emplacement
export async function loadPartials() {
    const isSub = location.pathname.includes("/event-planner/");
    const base = isSub ? ".." : ".";
    const appRoot = isSub ? "../" : "./";
    const planner = isSub ? "./" : "./event-planner/";

    const [h, f] = await Promise.all([
        fetch(`${base}/partials/header.html`).then(r => r.text()),
        fetch(`${base}/partials/footer.html`).then(r => r.text())
    ]);

    document.getElementById("__header").innerHTML = h;
    document.getElementById("__footer").innerHTML = f;

    // Logo (src relatif racine)
    const logo = document.querySelector('[data-el="logo"]');
    if (logo) {
        const p = logo.getAttribute("data-logo-path") || "assets/images/logo.svg";
        logo.src = `${base}/${p}`;
    }

    // Liens de nav
    const link = (sel, href) => {
        const a = document.querySelector(`[data-link="${sel}"]`);
        if (a) a.href = href;
    };
    link("home", appRoot + "index.html");
    link("dashboard", appRoot + "dashboard.html");
    link("events", planner + "index.html");
    link("create-event", planner + "create-event.html");

    // Favicon (optionnel)
    if (!document.querySelector('link[rel="icon"]')) {
        const ic = document.createElement("link");
        ic.rel = "icon";
        ic.href = `${base}/assets/images/logo.svg`;
        document.head.appendChild(ic);
    }
}

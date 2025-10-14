// /js/header-logo.js
import { supabase, isInPlanner, rootIndexURL } from "./api.js";

(async function () {
    // Le lien du logo dans le header
    const logoLink = document.querySelector('a.brand-link[data-link="home"]');
    if (!logoLink) return;

    const { data } = await supabase.auth.getUser();
    const authed = !!data?.user;

    // Cibles relatives correctes, peu importe la page actuelle
    const authedTarget = isInPlanner() ? "./index.html" : "./event-planner/index.html";
    const unauthedTarget = rootIndexURL(); // -> "../index.html" depuis /event-planner, sinon "./index.html"

    // Fixe le href
    logoLink.setAttribute("href", authed ? authedTarget : unauthedTarget);

    // Comportement au clic : si connecté, on force la redirection vers la liste
    logoLink.addEventListener("click", (e) => {
        if (!authed) return;        // laisser le lien normal vers la page d'auth
        e.preventDefault();
        window.location.href = authedTarget;
    });
})();

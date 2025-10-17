// /js/header-logo.js
import { supabase, isInPlanner, rootIndexURL } from "./api.js?v=20251017";

// URL canonique pour l'auth (évite 404 et ambiguïtés)
const AUTH_URL = "/wdd330-final-event-planner/auth.html?v=20251017";

(async function () {
    // Le lien du logo dans le header (HOME)
    const logoLink = document.querySelector('a.brand-link[data-link="home"]');
    if (!logoLink) return;

    // État de session
    const { data } = await supabase.auth.getUser();
    const authed = !!data?.user;

    // Cibles relatives correctes (on garde ton comportement existant côté "authed")
    const authedTarget   = isInPlanner() ? "./index.html" : "./event-planner/index.html";
    // Si pas connecté: aller sur la page d'auth canonique (on ne passe plus par la Home)
    const unauthedTarget = AUTH_URL;

    // Fixe le href selon l'état
    logoLink.setAttribute("href", authed ? authedTarget : unauthedTarget);

    // Comportement au clic : renvoie explicitement vers la bonne cible au moment du clic
    logoLink.addEventListener("click", (e) => {
        e.preventDefault();
        if (authed) {
            window.location.href = authedTarget;
        } else {
            window.location.href = unauthedTarget;
        }
    });
})();

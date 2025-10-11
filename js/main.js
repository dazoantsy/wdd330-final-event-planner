// js/main.js — rendu tolérant (ne plante pas si le conteneur est absent)

// Choisit un conteneur "classique" s'il existe.
// Tu peux changer l'ordre ou mettre ton id préféré (#hero, #welcome, etc.).
function selectMount() {
  return document.querySelector('#main, #app, #root, [data-main], #welcome, #hero');
}

function render() {
  const mount = selectMount();
  if (!mount) {
    // Aucun conteneur trouvé sur cette page : on sort proprement
    console.debug('[main] No mount element found — skipping render on this page.');
    return;
  }

  // Exemple de contenu; adapte si tu veux
  mount.innerHTML = `
    <div class="card">
      <h1>Welcome to Event Planner</h1>
      <p>Plan, track, and share your events effortlessly.</p>
      <div class="row" style="gap:.5rem;margin-top:.75rem">
        <a class="btn" href="./auth.html">Sign in / Sign up</a>
        <a class="btn" href="./index.html">View Events</a>
      </div>
    </div>
  `;
}

// Lance le rendu quand le DOM est prêt
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', render);
} else {
  render();
}

import { ENTRY_POINT_COUNT, GRID_COLS, GRID_ROWS } from '../game/constants';

export interface HomeInfo {
  version: string;
}

/** Page d'accueil provisoire du socle : confirme que le site est servi et que le code du jeu est lié. */
export function renderHome(root: HTMLElement, info: HomeInfo): void {
  root.innerHTML = `
    <main class="home">
      <p class="badge">Version ${info.version} · socle</p>
      <h1>Orapa Training</h1>
      <p class="lede">
        Site d'entraînement au jeu de société Orapa Mine. Cette page confirme que le projet
        est bien déployé ; le jeu arrive aux étapes suivantes.
      </p>
      <dl class="facts">
        <div><dt>Grille</dt><dd>${GRID_COLS} × ${GRID_ROWS} cases</dd></div>
        <div><dt>Points d'entrée</dt><dd>${ENTRY_POINT_COUNT}</dd></div>
      </dl>
    </main>
  `;
}

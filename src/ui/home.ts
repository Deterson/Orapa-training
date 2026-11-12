import { ENTRY_POINT_COUNT, GRID_COLS, GRID_ROWS } from '../game/constants';
import { mountBench } from './bench';

export interface HomeInfo {
  version: string;
}

/** Page d'accueil provisoire : version, grille, et banc d'essai de la logique du jeu. */
export function renderHome(root: HTMLElement, info: HomeInfo): void {
  root.innerHTML = `
    <main class="home">
      <p class="badge">Version ${info.version} · logique du jeu</p>
      <h1>Orapa Training</h1>
      <p class="lede">
        Site d'entraînement au jeu de société Orapa Mine. Le jeu complet arrive aux étapes
        suivantes ; en attendant, ce banc d'essai montre la logique déjà en place : gemmes,
        règles de placement et laser.
      </p>
      <dl class="facts">
        <div><dt>Grille</dt><dd>${GRID_COLS} × ${GRID_ROWS} cases</dd></div>
        <div><dt>Points d'entrée</dt><dd>${ENTRY_POINT_COUNT}</dd></div>
      </dl>
      <section class="bench" aria-labelledby="bench-title">
        <h2 id="bench-title">Banc d'essai : schéma du livret</h2>
        <div id="bench"></div>
      </section>
    </main>
  `;
  const bench = root.querySelector<HTMLElement>('#bench');
  if (bench) mountBench(bench);
}

/**
 * Page d'accueil : la partie en cours (reprendre) et « Nouvelle partie ». Sans compte, une seule
 * partie à la fois : « Nouvelle partie » la remplace, après confirmation (modale de l'application).
 * Pas d'horloge : le temps ne se montre qu'à la fin de la partie.
 */
import { formatDate, plural } from './format';
import { escapeHtml } from './html';
import { t } from './strings';

/** Une partie non terminée, telle que l'accueil la montre. */
export interface HomeGame {
  seed: string;
  /** « Sans extension », « Diamant »… */
  extensions: string;
  shots: number;
}

/** Une partie en cours enregistrée sur le compte (autre que celle chargée dans cette fenêtre). */
export interface HomeRemote extends HomeGame {
  id: string;
  /** Dernière modification, date ISO. */
  updatedAt: string;
}

export interface HomeModel {
  current: HomeGame | null;
  newGameBlocked: boolean;
  /** Le site propose des comptes (sinon on n'invite pas à se connecter). */
  accounts: boolean;
  /** Un compte est connecté : la liste des parties en cours du compte est affichée. */
  signedIn: boolean;
  /** La partie en cours n'est pas encore dans le compte : « Importer ». */
  canImport: boolean;
  others: readonly HomeRemote[];
  othersStatus: 'idle' | 'loading' | 'ready' | 'error';
  /** Dix parties en cours : plus de nouvelle partie tant qu'on n'en termine pas une. */
  limitReached: boolean;
}

function card(game: HomeGame, canImport: boolean): string {
  const shots = `${game.shots} tir${plural(game.shots, '', 's')}`;
  const actions = `<div class="actions"><button type="button" data-action="resume-game">${t.actions.resume}</button>${canImport ? `<button type="button" class="ghost" data-action="import-game">${t.home.import}</button>` : ''}</div>`;
  return `<section class="home-card" aria-label="${t.home.current}">
    <h2>${t.home.current}</h2>
    <p class="hc-line"><code class="seed">${escapeHtml(game.seed)}</code> <span class="ext-chip">${escapeHtml(game.extensions)}</span> · ${shots}</p>
    ${actions}
  </section>`;
}

function remote(game: HomeRemote): string {
  const shots = `${game.shots} tir${plural(game.shots, '', 's')}`;
  return `<li class="home-remote">
    <p class="hc-line"><code class="seed">${escapeHtml(game.seed)}</code> <span class="ext-chip">${escapeHtml(game.extensions)}</span> · ${shots} · <span class="hc-date">${escapeHtml(formatDate(game.updatedAt))}</span></p>
    <div class="actions"><button type="button" data-action="resume-remote" data-id="${escapeHtml(game.id)}">${t.actions.resume}</button></div>
  </li>`;
}

function others(model: HomeModel): string {
  if (!model.signedIn) return '';
  if (model.othersStatus === 'error') {
    return `<section class="home-others"><p class="warning" role="alert">${t.home.loadError} <button type="button" class="ghost" data-action="retry-playing">${t.home.retry}</button></p></section>`;
  }
  if (model.othersStatus === 'loading' && model.others.length === 0) {
    return `<section class="home-others" aria-busy="true"><p class="placeholder" role="status">${t.history.loading}</p></section>`;
  }
  if (model.others.length === 0) return '';
  return `<section class="home-others" aria-label="${t.home.others}">
    <h2>${t.home.others}</h2>
    <ul class="home-list">${model.others.map(remote).join('')}</ul>
  </section>`;
}

export function homePage(model: HomeModel): string {
  const hint = model.limitReached ? `<p class="hint">${t.home.limit}</p>` : '';
  return `<div class="home">
    <h1 class="sr-only">${t.appName}</h1>
    ${model.current ? card(model.current, model.canImport) : ''}
    <p class="home-new"><button type="button" class="big" data-action="new-game"${model.newGameBlocked ? ' disabled' : ''}>${t.actions.newGame}</button></p>
    ${hint}
    ${others(model)}
  </div>`;
}

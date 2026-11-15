/**
 * Page d'accueil : la partie en cours (reprendre ou abandonner) et « Nouvelle partie ».
 * Sans compte, une seule partie à la fois : tant qu'elle n'est ni terminée ni abandonnée,
 * « Nouvelle partie » n'est pas disponible.
 */
import { formatTime, plural } from './format';
import { escapeHtml } from './html';
import { t } from './strings';

/** Une partie non terminée, telle que l'accueil la montre. */
export interface HomeGame {
  seed: string;
  /** « Sans extension », « Diamant »… */
  extensions: string;
  shots: number;
  elapsedMs: number;
}

export interface HomeModel {
  current: HomeGame | null;
  /** Confirmation d'abandon ouverte sur la partie en cours. */
  confirmAbandon: boolean;
  newGameBlocked: boolean;
  /** Le site propose des comptes (sinon on n'invite pas à se connecter). */
  accounts: boolean;
}

function card(game: HomeGame, confirm: boolean): string {
  const shots = `${game.shots} tir${plural(game.shots, '', 's')}`;
  const actions = confirm
    ? `<div class="confirm" role="alertdialog" aria-label="Confirmer"><p>${t.home.confirmAbandon}</p><div class="actions"><button type="button" data-action="confirm-abandon">${t.actions.abandon}</button><button type="button" class="ghost" data-action="cancel-confirm">${t.modal.cancel}</button></div></div>`
    : `<div class="actions"><button type="button" data-action="resume-game">${t.actions.resume}</button><button type="button" class="ghost" data-action="ask-abandon">${t.actions.abandon}</button></div>`;
  return `<section class="home-card" aria-label="${t.home.current}">
    <h2>${t.home.current}</h2>
    <p class="hc-line"><code class="seed">${escapeHtml(game.seed)}</code> <span class="ext-chip">${escapeHtml(game.extensions)}</span> · ${shots} · ${formatTime(game.elapsedMs)}</p>
    ${actions}
  </section>`;
}

export function homePage(model: HomeModel): string {
  const hint = !model.newGameBlocked
    ? ''
    : `<p class="hint">${model.accounts ? t.home.blockedSignIn : t.home.blockedNoAccount}</p>`;
  return `<div class="home">
    <h1 class="sr-only">${t.appName}</h1>
    ${model.current ? card(model.current, model.confirmAbandon) : ''}
    <p class="home-new"><button type="button" class="big" data-action="new-game"${model.newGameBlocked ? ' disabled' : ''}>${t.actions.newGame}</button></p>
    ${hint}
  </div>`;
}

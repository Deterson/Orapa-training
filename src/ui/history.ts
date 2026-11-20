/**
 * Page « Historique » : les parties terminées du compte connecté, paginées, avec filtre
 * victoires / défaites et tri. Les textes qui viennent de la base (graine) sont échappés.
 */
import type { HistoryFilter, HistorySort } from '../backend/games';
import { extensionsFromCode } from '../game/record';
import type { GameRecord } from '../game/record';
import { formatDate, formatTime, plural } from './format';
import { escapeHtml } from './html';
import { t } from './strings';

export interface HistoryModel {
  signedIn: boolean;
  filter: HistoryFilter;
  sort: HistorySort;
  /** Page affichée, à partir de 0. */
  page: number;
  pageSize: number;
  status: 'loading' | 'ready' | 'error';
  games: readonly GameRecord[];
  total: number;
}

const FILTERS: readonly HistoryFilter[] = ['all', 'won', 'lost'];
const SORTS: readonly HistorySort[] = ['recent', 'oldest', 'shots'];

export const isHistoryFilter = (value: unknown): value is HistoryFilter =>
  FILTERS.includes(value as HistoryFilter);
export const isHistorySort = (value: unknown): value is HistorySort =>
  SORTS.includes(value as HistorySort);

export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** Adresse pour rejouer la même mine : même graine et mêmes extensions. */
export function replayHref(game: Pick<GameRecord, 'seed' | 'extensions'>): string {
  const params = new URLSearchParams({ seed: game.seed });
  const { diamond, blackBody } = extensionsFromCode(game.extensions);
  const flags = `${diamond ? 'd' : ''}${blackBody ? 'n' : ''}`;
  if (flags) params.set('ext', flags);
  return `./?${params.toString()}`;
}

function row(game: GameRecord): string {
  // Depuis la v1.0.17, un laser et la sonde d'une case comptent chacun pour un tir.
  const shots = game.lasersCount + game.probesCount;
  const count = `${shots} tir${plural(shots, '', 's')}`;
  // Un duel ne se rejoue pas (le plateau de l'IA se joue contre elle) : il porte son niveau à la place du lien.
  const last =
    game.mode === 'duel' && game.level
      ? `<span class="h-mode">${t.duel.chip} · ${t.duel.levels[game.level]}</span>`
      : `<a class="h-replay nav-link" href="${escapeHtml(replayHref(game))}" title="${escapeHtml(game.seed)}">${t.history.replay}</a>`;
  return `<li class="h-row is-${game.status}">
    <span class="h-date">${escapeHtml(formatDate(game.endedAt))}</span>
    <span class="h-status">${t.status[game.status]}</span>
    <span class="h-lasers">${count}</span>
    <span class="h-time">${formatTime(game.durationS * 1000)}</span>
    ${last}
  </li>`;
}

export function historyPage(model: HistoryModel): string {
  if (!model.signedIn) {
    return `<article class="history-page"><h2>${t.history.title}</h2>
      <p><button type="button" data-action="sign-in">${t.history.signInNeeded}</button></p></article>`;
  }
  const filters = FILTERS.map(
    (filter) =>
      `<button type="button" class="ghost h-chip${model.filter === filter ? ' is-active' : ''}" aria-pressed="${model.filter === filter}" data-hfilter="${filter}">${t.history.filters[filter]}</button>`,
  ).join('');
  const sorts = SORTS.map(
    (sort) =>
      `<option value="${sort}"${model.sort === sort ? ' selected' : ''}>${t.history.sorts[sort]}</option>`,
  ).join('');
  const pages = pageCount(model.total, model.pageSize);
  const pager =
    model.total > model.pageSize
      ? `<nav class="pager" aria-label="Pages">
          <button type="button" class="ghost" data-hpage="prev"${model.page <= 0 ? ' disabled' : ''}>${t.history.previous}</button>
          <span>${model.page + 1} / ${pages}</span>
          <button type="button" class="ghost" data-hpage="next"${model.page + 1 >= pages ? ' disabled' : ''}>${t.history.next}</button>
        </nav>`
      : '';
  let body: string;
  if (model.status === 'loading' && model.games.length === 0) {
    body = `<p class="placeholder" role="status">${t.history.loading}</p>`;
  } else if (model.status === 'error') {
    body = `<p class="warning" role="alert">${t.history.error} <button type="button" class="ghost" data-hpage="retry">${t.history.retry}</button></p>`;
  } else if (model.games.length === 0) {
    body = `<p class="placeholder">${t.history.empty}</p>`;
  } else {
    body = `<ol class="h-list" aria-label="${t.history.title}">${model.games.map(row).join('')}</ol>`;
  }
  return `<article class="history-page">
    <h2>${t.history.title}</h2>
    <div class="h-tools">
      <div class="h-filters" role="group">${filters}</div>
      <label class="h-sort">${t.history.sortLabel}
        <select data-hsort>${sorts}</select>
      </label>
    </div>
    <div aria-busy="${model.status === 'loading'}">${body}</div>
    ${pager}
  </article>`;
}

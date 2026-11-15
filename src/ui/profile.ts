/**
 * Page « Profil » : nombre de parties, victoires, pourcentage de victoires et moyenne de lasers
 * tirés avant de gagner. Les chiffres viennent de la base (`profile_stats`), l'interface ne fait
 * que les mettre en forme : « — » sans victoire (jamais 0), « Aucune partie jouée » sans partie.
 */
import type { AccountUser } from '../backend/auth';
import type { ProfileStats } from '../game/record';
import { escapeHtml } from './html';
import { t } from './strings';

export interface ProfileModel {
  user: AccountUser | null;
  status: 'loading' | 'ready' | 'error';
  stats: ProfileStats | null;
}

function number(value: number, maxFractionDigits: number): string {
  try {
    return new Intl.NumberFormat('fr', { maximumFractionDigits: maxFractionDigits }).format(value);
  } catch {
    return String(Math.round(value * 10 ** maxFractionDigits) / 10 ** maxFractionDigits);
  }
}

/** Pourcentage de victoires, une décimale au plus : « 66,7 % ». « — » sans partie. */
export function formatWinRate(stats: ProfileStats): string {
  return stats.winRate === null ? t.profile.noWin : `${number(stats.winRate * 100, 1)} %`;
}

/** Moyenne de lasers avant victoire, une décimale au plus : « 7,7 ». « — » sans victoire. */
export function formatAvgShots(stats: ProfileStats): string {
  return stats.avgShotsToWin === null ? t.profile.noWin : number(stats.avgShotsToWin, 1);
}

function card(label: string, value: string, hint = ''): string {
  return `<div class="p-card"><dt>${label}</dt><dd${hint ? ` aria-label="${hint}"` : ''}>${value}</dd></div>`;
}

export function profilePage(model: ProfileModel, version: string): string {
  const back = `<p><a class="back" href="#jeu">← ${t.nav.backToGame}</a></p>`;
  const foot = `<p class="hint">v${version}</p>`;
  if (!model.user) {
    return `<article class="profile-page"><h2>${t.profile.title}</h2>
      <p><button type="button" data-action="sign-in">${t.history.signInNeeded}</button></p>${back}${foot}</article>`;
  }
  const { user, stats } = model;
  const avatar = user.avatarUrl
    ? `<img class="avatar" src="${escapeHtml(user.avatarUrl)}" alt="" referrerpolicy="no-referrer" width="48" height="48">`
    : '';
  const who = `<div class="p-who">${avatar}<span class="account-name">${escapeHtml(user.name)}</span></div>`;
  let body: string;
  if (model.status === 'error') {
    body = `<p class="warning" role="alert">${t.profile.error} <button type="button" class="ghost" data-action="retry-profile">${t.profile.retry}</button></p>`;
  } else if (model.status === 'loading' || stats === null) {
    body = `<p class="placeholder" role="status">${t.profile.loading}</p>`;
  } else if (stats.total === 0) {
    body = `<p class="placeholder">${t.profile.none}</p>`;
  } else {
    body = `<dl class="p-stats">
      ${card(t.profile.games, String(stats.total))}
      ${card(t.profile.wins, String(stats.wins))}
      ${card(t.profile.winRate, formatWinRate(stats))}
      ${card(t.profile.avgShots, formatAvgShots(stats), stats.avgShotsToWin === null ? t.profile.noWinLabel : '')}
    </dl>`;
  }
  return `<article class="profile-page">
    <h2>${t.profile.title}</h2>
    ${who}
    <div aria-busy="${model.status === 'loading'}">${body}</div>
    <p><a class="nav-link" href="#historique">${t.history.link}</a> <a class="nav-link" href="#confidentialite">${t.privacy.link}</a></p>
    ${back}${foot}
  </article>`;
}

/**
 * Barre du haut, commune à toutes les pages (sauf le plein écran) : à gauche le titre (qui ramène à
 * l'accueil) avec la version, « Nouvelle partie » et « Règles » ; à droite « Historique », « Profil »
 * (avec l'avatar, sans le nom) et « Connexion » / « Déconnexion ».
 */
import type { AccountUser } from '../backend/auth';
import { escapeHtml } from './html';
import { type View, routeHash } from './router';
import { t } from './strings';

export interface HeaderModel {
  version: string;
  view: View;
  /** « Nouvelle partie » est-elle indisponible (une partie est en cours, sans compte) ? */
  newGameBlocked: boolean;
  /** Le backend est branché et la session de connexion est lue : sinon aucun bouton de compte. */
  accountReady: boolean;
  user: AccountUser | null;
}

const PERSON_ICON =
  '<svg class="avatar avatar-icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z"/></svg>';

function avatar(user: AccountUser): string {
  return user.avatarUrl
    ? `<img class="avatar" src="${escapeHtml(user.avatarUrl)}" alt="" referrerpolicy="no-referrer" width="24" height="24">`
    : PERSON_ICON;
}

function link(view: View, current: View, label: string, content = label): string {
  const here = current === view ? ' aria-current="page"' : '';
  return `<a class="tb-link${current === view ? ' is-current' : ''}" href="${routeHash(view)}"${here} aria-label="${label}">${content}</a>`;
}

export function headerHtml(model: HeaderModel): string {
  const { view, user } = model;
  const blocked = model.newGameBlocked;
  const left = `
    <a class="brand" href="${routeHash('home')}">${t.appName}</a>
    <span class="version" title="Version">v${model.version}</span>
    <button type="button" class="tb-new" data-action="new-game"${blocked ? ` disabled title="${t.home.blocked}"` : ''}>${t.actions.newGame}</button>
    ${link('rules', view, t.nav.rules)}`;
  let right = '';
  if (model.accountReady) {
    right = user
      ? `${link('history', view, t.history.link)}
         ${link('profile', view, t.profile.link, `${avatar(user)}<span>${t.profile.link}</span>`)}
         <button type="button" class="ghost" data-action="sign-out">${t.account.signOut}</button>`
      : `<button type="button" class="ghost" data-action="sign-in">${t.account.signIn}</button>`;
  }
  return `<header class="topbar"><nav class="tb-left" aria-label="Navigation">${left}</nav><div class="tb-right">${right}</div></header>`;
}

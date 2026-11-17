/**
 * Barre du haut, commune à toutes les pages (sauf le plein écran) : à gauche le titre (qui ramène à
 * l'accueil) avec la version, « Nouvelle partie » et « Règles » ; à droite « Historique », « Profil »
 * (avec l'avatar, sans le nom) et « Connexion » / « Déconnexion ».
 */
import type { AccountUser } from '../backend/auth';
import { escapeHtml } from './html';
import { type View, routeHash } from './router';
import { t } from './strings';
import type { Theme } from './theme';

export interface HeaderModel {
  version: string;
  view: View;
  /** « Nouvelle partie » est-elle indisponible (une partie est en cours, sans compte) ? */
  newGameBlocked: boolean;
  /** Le backend est branché et la session de connexion est lue : sinon aucun bouton de compte. */
  accountReady: boolean;
  user: AccountUser | null;
  /** Thème affiché : le bouton propose l'autre (lune en mode jour, soleil en mode nuit). */
  theme: Theme;
}

const PERSON_ICON =
  '<svg class="avatar avatar-icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z"/></svg>';

function avatar(user: AccountUser): string {
  return user.avatarUrl
    ? `<img class="avatar" src="${escapeHtml(user.avatarUrl)}" alt="" referrerpolicy="no-referrer" width="24" height="24">`
    : PERSON_ICON;
}

const MOON_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
const SUN_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';

/** Bouton jour / nuit : la lune propose la nuit, le soleil propose le jour. */
function themeButton(theme: Theme): string {
  const label = theme === 'dark' ? t.theme.toLight : t.theme.toDark;
  return `<button type="button" class="ghost theme-btn" data-action="toggle-theme" aria-label="${label}" title="${label}">${theme === 'dark' ? SUN_ICON : MOON_ICON}</button>`;
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
  return `<header class="topbar"><nav class="tb-left" aria-label="Navigation">${left}</nav><div class="tb-right">${themeButton(model.theme)}${right}</div></header>`;
}

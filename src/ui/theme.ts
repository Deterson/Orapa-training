/**
 * Thème jour / nuit. Sans choix du joueur, le site suit le réglage du système (`prefers-color-scheme`) ;
 * le bouton de la barre du haut force « jour » ou « nuit » (attribut `data-theme` de `<html>`, lu par la
 * feuille de style) et se souvient du choix dans le navigateur. Tout accès au stockage est protégé : sans
 * lui, le choix vaut pour la visite en cours.
 */
export type Theme = 'light' | 'dark';

/** Clé du navigateur. */
export const THEME_KEY = 'orapa-training:theme';

type Backend = Pick<Storage, 'getItem' | 'setItem'>;

export function parseTheme(value: unknown): Theme | null {
  return value === 'light' || value === 'dark' ? value : null;
}

export function nextTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark';
}

/** Le choix mémorisé, ou null (absent, illisible ou modifié à la main). */
export function readTheme(backend: Backend | null): Theme | null {
  try {
    return parseTheme(backend?.getItem(THEME_KEY));
  } catch {
    return null;
  }
}

/** Mémorise le choix ; renvoie faux si le navigateur refuse d'écrire. */
export function saveTheme(backend: Backend | null, theme: Theme): boolean {
  try {
    backend?.setItem(THEME_KEY, theme);
    return backend !== null;
  } catch {
    return false;
  }
}

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Le thème du système (jour si le navigateur ne le dit pas). */
export function systemTheme(): Theme {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/** Le thème affiché : celui choisi, sinon celui du système. */
export function currentTheme(): Theme {
  return parseTheme(document.documentElement.dataset['theme']) ?? systemTheme();
}

/** Applique le choix mémorisé, avant le premier affichage (pas de clignotement). */
export function initTheme(): void {
  const stored = readTheme(browserStorage());
  if (stored) document.documentElement.dataset['theme'] = stored;
}

/** Bascule jour / nuit, applique et mémorise le choix. */
export function toggleTheme(): Theme {
  const theme = nextTheme(currentTheme());
  document.documentElement.dataset['theme'] = theme;
  saveTheme(browserStorage(), theme);
  return theme;
}

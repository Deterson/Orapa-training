/**
 * Mode daltonien : option de l'interface, mémorisée dans le navigateur (comme le thème jour / nuit). Active
 * une palette adaptée (voir `palette.ts`), des motifs sur les gemmes et des lettres sur les pastilles ; les
 * règles du jeu ne changent pas. Tout accès au stockage est protégé : sans lui, le choix vaut pour la visite.
 */
import { isColorblind, setColorblind } from './palette';

/** Clé du navigateur. */
export const COLORBLIND_KEY = 'orapa-training:colorblind';

type Backend = Pick<Storage, 'getItem' | 'setItem'>;

/** Le choix mémorisé (faux si absent, illisible ou modifié à la main). */
export function readColorblind(backend: Backend | null): boolean {
  try {
    return backend?.getItem(COLORBLIND_KEY) === '1';
  } catch {
    return false;
  }
}

/** Mémorise le choix ; renvoie faux si le navigateur refuse d'écrire. */
export function saveColorblind(backend: Backend | null, on: boolean): boolean {
  try {
    backend?.setItem(COLORBLIND_KEY, on ? '1' : '0');
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

/** Applique le mode : palette, motifs (attribut `data-colorblind` de `<html>`, lu par la feuille de style). */
export function applyColorblind(on: boolean): void {
  setColorblind(on);
  try {
    if (on) document.documentElement.dataset['colorblind'] = '1';
    else delete document.documentElement.dataset['colorblind'];
  } catch {
    // Pas de document (tests) : seule la palette change.
  }
}

/** Applique le choix mémorisé, avant le premier affichage. */
export function initColorblind(): void {
  applyColorblind(readColorblind(browserStorage()));
}

/** Bascule le mode, l'applique et le mémorise. */
export function toggleColorblind(): boolean {
  const on = !isColorblind();
  applyColorblind(on);
  saveColorblind(browserStorage(), on);
  return on;
}

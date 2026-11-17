/**
 * Disposition de l'historique des tirs : une colonne tant que tout tient dans la hauteur de la grille ; sinon
 * deux colonnes, la première (à gauche) remplie d'abord, la seconde (à droite, à l'emplacement de la colonne
 * unique, au contact de la grille) ensuite ; la barre de défilement légère n'apparaît que si deux colonnes ne
 * suffisent pas.
 *
 * Deux façons de faire de la place, par ordre de préférence :
 *  - « margin » : la colonne en plus s'ouvre dans la marge à gauche de la page, sans rien déplacer ;
 *  - « shift » : pas assez de marge, mais un grand écran : la page s'élargit d'une colonne et la grille
 *    rétrécit un peu (voir le CSS, `data-hist-fit`).
 */

/** Largeur de fenêtre à partir de laquelle on peut élargir la page pour une seconde colonne (en `rem`). */
export const WIDE_QUERY = '(min-width: 88rem)';

/** Distance minimale, en pixels, entre la colonne ouverte dans la marge et le bord de la fenêtre. */
const EDGE = 8;

export type HistoryFit = 'margin' | 'shift';

/**
 * Comment loger une seconde colonne : dans la marge si elle est assez large pour la contenir (la largeur
 * d'une colonne et de son écart), sinon en élargissant la page sur grand écran, sinon pas du tout.
 */
export function chooseFit(
  leftSpace: number,
  columnWidth: number,
  wide: boolean,
): HistoryFit | null {
  if (leftSpace >= columnWidth + EDGE) return 'margin';
  return wide ? 'shift' : null;
}

/** Nombre de cartes qui tiennent dans une colonne de cette hauteur (au moins une). */
export function capacity(available: number, card: number, gap: number): number {
  if (!(card > 0)) return 1;
  return Math.max(1, Math.floor((available + gap) / (card + gap)));
}

export interface HistoryPlan {
  cols: 1 | 2;
  /** Cartes par colonne en mode deux colonnes ; sans objet pour une seule. */
  rows: number;
}

/**
 * Une colonne si tout tient (ou si deux colonnes sont impossibles) ; sinon deux, la première remplie d'abord
 * tant que deux colonnes suffisent, puis réparties à parts égales (la liste défile alors).
 * `capacityOne` : capacité d'une colonne seule ; `capacityTwo` : capacité mesurée en mode deux colonnes (en mode
 * « shift », la grille est un peu plus petite, donc les colonnes aussi).
 */
export function planHistory(
  count: number,
  capacityOne: number,
  capacityTwo: number,
  canTwo: boolean,
): HistoryPlan {
  if (!canTwo || count <= capacityOne) return { cols: 1, rows: count };
  return { cols: 2, rows: count <= 2 * capacityTwo ? capacityTwo : Math.ceil(count / 2) };
}

function maxHeightOf(body: HTMLElement): number {
  return Number.parseFloat(getComputedStyle(body).maxHeight);
}

/** Mesure l'espace restant pour la liste (hauteur maximale de la zone moins le compteur) et la hauteur d'une carte. */
function measure(
  body: HTMLElement,
  list: HTMLElement,
): { available: number; card: number; gap: number } | null {
  const max = maxHeightOf(body);
  const first = list.firstElementChild as HTMLElement | null;
  if (!Number.isFinite(max) || !first) return null;
  const gap = Number.parseFloat(getComputedStyle(list).rowGap) || 6;
  return { available: max - (list.offsetTop - body.offsetTop), card: first.offsetHeight, gap };
}

/** Largeur d'une colonne d'historique et de son écart, en pixels (12 rem + 6 px, comme le CSS). */
function columnWidth(): number {
  const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  return 12 * rem + 6;
}

/**
 * Applique la disposition à la page affichée : `data-hist-cols` et `data-hist-fit` sur `.play`, `data-cols` et
 * `--rows` sur la liste. À appeler après chaque affichage et au redimensionnement.
 */
export function layoutHistory(root: ParentNode, wide = matchMedia(WIDE_QUERY).matches): void {
  const play = root.querySelector<HTMLElement>('.play');
  const aside = root.querySelector<HTMLElement>('.play-history');
  const body = aside?.querySelector<HTMLElement>('.scroll-body');
  const list = body?.querySelector<HTMLElement>('.history');
  if (!play || !aside || !body || !list) return;
  // On repart d'une seule colonne pour mesurer.
  play.removeAttribute('data-hist-cols');
  play.removeAttribute('data-hist-fit');
  list.removeAttribute('data-cols');
  list.style.removeProperty('--rows');
  const count = list.children.length;
  const one = measure(body, list);
  if (!one || count === 0) return;
  const capacityOne = capacity(one.available, one.card, one.gap);
  if (count <= capacityOne) return;
  const fit = chooseFit(aside.getBoundingClientRect().left, columnWidth(), wide);
  if (fit === null) return;
  play.setAttribute('data-hist-cols', '2');
  play.setAttribute('data-hist-fit', fit);
  list.setAttribute('data-cols', '2');
  // En mode « shift » la grille rétrécit : on mesure de nouveau avant de répartir.
  const two = fit === 'shift' ? (measure(body, list) ?? one) : one;
  const plan = planHistory(count, capacityOne, capacity(two.available, two.card, two.gap), true);
  list.style.setProperty('--rows', String(plan.rows));
}

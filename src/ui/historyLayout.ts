/**
 * Disposition de l'historique des tirs : une colonne tant que tout tient dans la hauteur de la grille ; sinon
 * deux colonnes (la première, remplie d'abord, est la plus proche de la grille, la seconde s'ouvre à sa
 * gauche) ; la barre de défilement légère n'apparaît que si deux colonnes ne suffisent pas. Les deux colonnes
 * ne sont proposées que sur grand écran : elles élargissent la page d'une colonne.
 */

/** Largeur de fenêtre à partir de laquelle l'historique peut prendre deux colonnes (en `rem` du navigateur). */
export const WIDE_QUERY = '(min-width: 88rem)';

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
 * Une colonne si tout tient (ou si l'écran est étroit) ; sinon deux, la première remplie d'abord tant que
 * deux colonnes suffisent, puis réparties à parts égales (la liste défile alors).
 * `capacityOne` : capacité d'une colonne seule ; `capacityTwo` : capacité mesurée en mode deux colonnes (la
 * grille est un peu plus petite, donc les colonnes aussi).
 */
export function planHistory(
  count: number,
  capacityOne: number,
  capacityTwo: number,
  wide: boolean,
): HistoryPlan {
  if (!wide || count <= capacityOne) return { cols: 1, rows: count };
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

/**
 * Applique la disposition à la page affichée : attribut `data-hist-cols` sur `.play` (qui élargit la mise en
 * page) et `data-cols` / `--rows` sur la liste. À appeler après chaque affichage et au redimensionnement.
 */
export function layoutHistory(root: ParentNode, wide = matchMedia(WIDE_QUERY).matches): void {
  const play = root.querySelector<HTMLElement>('.play');
  const body = root.querySelector<HTMLElement>('.play-history .scroll-body');
  const list = body?.querySelector<HTMLElement>('.history');
  if (!play || !body || !list) return;
  // On repart d'une seule colonne pour mesurer.
  play.removeAttribute('data-hist-cols');
  list.removeAttribute('data-cols');
  list.style.removeProperty('--rows');
  const count = list.children.length;
  const one = measure(body, list);
  if (!wide || !one || count === 0) return;
  const capacityOne = capacity(one.available, one.card, one.gap);
  if (count <= capacityOne) return;
  // Deux colonnes : la grille rétrécit un peu, on mesure de nouveau avant de répartir.
  play.setAttribute('data-hist-cols', '2');
  list.setAttribute('data-cols', '2');
  const two = measure(body, list) ?? one;
  const plan = planHistory(count, capacityOne, capacity(two.available, two.card, two.gap), wide);
  list.style.setProperty('--rows', String(plan.rows));
}

/**
 * Gemmes du joueur : la réserve (à droite de la grille, ou dans la grille du mode plein écran) et le
 * dessin d'une gemme, posée ou non. Dessin en SVG ; les interactions (glisser-déposer, clavier) sont
 * dans app.ts.
 */
import { cellLabel } from '../game/board';
import { GRID_COLS } from '../game/constants';
import {
  EXTENSION_GEM_IDS,
  GEM_SHAPES,
  type GemId,
  isRotatable,
  orientedPolygon,
  placedPivot,
  placedPolygon,
  buttonOffset,
} from '../game/gems';
import { translate } from '../game/geometry';
import type { SolutionIssue } from '../game/solution';
import { type Solution, gemsOf, sizeOf } from '../game/solution';
import { gemPolygons } from './palette';
import { t } from './strings';

/** Vrai si la partie compte le Diamant ou le Corps noir. */
export function hasExtensions(solution: Solution): boolean {
  return EXTENSION_GEM_IDS.some((gem) => solution[gem] !== undefined);
}

/** Réserve à droite de la grille (affichage normal, « panel ») ou dans la grille (plein écran, « side »). */
export type TrayLayout = 'panel' | 'side';

/** Réserve de l'affichage normal : largeur et hauteur, en cases (la même échelle que la grille). */
export const PANEL_WIDTH = 6.6;
const PANEL_HEIGHT = 6.8;
const PANEL_HEIGHT_EXTENDED = 8.2;

/** Emplacement de chaque gemme dans la réserve « panel » (coin haut-gauche, orientation de départ). */
const PANEL_SLOTS: Record<GemId, readonly [number, number]> = {
  'blue-triangle': [0.3, 0.3],
  'yellow-triangle': [4.3, 0.3],
  'white-triangle': [0.3, 2.8],
  'white-rhombus': [4.3, 2.8],
  'red-parallelogram': [0.3, 5.3],
  diamond: [0.3, 6.6],
  'black-body': [3.0, 6.6],
};

/** Emplacements de la réserve placée dans la grille du plein écran (téléphone en paysage). */
const SIDE_SLOTS: Record<GemId, readonly [number, number]> = {
  'blue-triangle': [12.0, 0.2],
  'white-triangle': [12.0, 2.6],
  'white-rhombus': [12.0, 5.0],
  'yellow-triangle': [14.6, 5.0],
  'red-parallelogram': [12.0, 7.4],
  diamond: [12.0, 8.2],
  'black-body': [14.4, 8.2],
};

/** Mêmes emplacements, resserrés pour faire de la place à la rangée des extensions. */
const SIDE_SLOTS_EXTENDED: Record<GemId, readonly [number, number]> = {
  ...SIDE_SLOTS,
  'blue-triangle': [12.0, -0.1],
  'white-triangle': [12.0, 2.1],
  'white-rhombus': [12.0, 4.3],
  'yellow-triangle': [14.6, 4.3],
  'red-parallelogram': [12.0, 6.5],
  diamond: [12.0, 7.7],
  'black-body': [14.4, 7.7],
};

function slotOf(layout: TrayLayout, solution: Solution, gem: GemId): readonly [number, number] {
  if (layout === 'panel') return PANEL_SLOTS[gem];
  return (hasExtensions(solution) ? SIDE_SLOTS_EXTENDED : SIDE_SLOTS)[gem];
}

/**
 * Coin haut-gauche actuel de la gemme : sur la grille si elle est posée (coordonnées de la grille),
 * sinon dans la réserve (coordonnées de la réserve).
 */
export function gemOrigin(
  solution: Solution,
  gem: GemId,
  layout: TrayLayout = 'panel',
): [number, number] {
  const placement = solution[gem];
  if (placement) return [placement.col, placement.row];
  const [x, y] = slotOf(layout, solution, gem);
  return [x, y];
}

export interface GemsView {
  solution: Solution;
  selected: GemId | null;
  issues: readonly SolutionIssue[];
}

export function gemGroupSvg(view: GemsView, gem: GemId, layout: TrayLayout = 'panel'): string {
  const shape = GEM_SHAPES[gem];
  const placement = view.solution[gem];
  const polygon = placement
    ? placedPolygon(placement)
    : translate(
        orientedPolygon(shape, { rotation: 0, flipped: false }),
        ...slotOf(layout, view.solution, gem),
      );
  const bad = view.issues.some((issue) => issue.gemIds.includes(gem));
  const where = placement
    ? `posée en ${cellLabel({ row: placement.row, col: placement.col })}`
    : 'dans la réserve';
  const classes = [
    'gem-g',
    view.selected === gem ? 'is-selected' : '',
    bad ? 'is-bad' : '',
    placement ? 'is-placed' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return `<g class="${classes}" data-gem="${gem}" tabindex="0" role="button" aria-label="${shape.label}, ${where}${bad ? ', règle enfreinte' : ''}">${gemPolygons(polygon, shape.color)}</g>`;
}

/** Taille d'une gemme dans son orientation actuelle (pour tester si elle est sur la grille). */
export function gemSize(solution: Solution, gem: GemId): { width: number; height: number } {
  return sizeOf(gem, solution[gem]?.orientation ?? { rotation: 0, flipped: false });
}

/** Jusqu'où un bouton peut déborder de la grille (la marge du cadre est de 1,1 case, le bouton fait 0,46 de rayon). */
const BUTTON_OVERFLOW = 0.6;

/**
 * Boutons ronds de la gemme sélectionnée : pivoter (sauf le losange, identique dans ses quatre quarts de
 * tour) et, pour la rouge, retourner. Ils sont ancrés à l'axe de rotation de la gemme, au coin haut-droit
 * de la gemme dans son orientation de référence (`buttonOffset`) : l'axe ne bouge pas quand elle pivote,
 * donc le bouton reste sous le doigt pour cliquer plusieurs fois. Il reste dans le cadre de la grille.
 */
export function gemButtonsSvg(view: Pick<GemsView, 'solution' | 'selected'>): string {
  const gem = view.selected;
  const placement = gem ? view.solution[gem] : null;
  if (!gem || !placement) return '';
  const shape = GEM_SHAPES[gem];
  const [pivotX, pivotY] = placedPivot(placement);
  const [offsetX, offsetY] = buttonOffset(shape);
  const cx = Math.min(pivotX + offsetX, GRID_COLS + BUTTON_OVERFLOW);
  const cy = Math.max(pivotY + offsetY, -BUTTON_OVERFLOW);
  const button = (action: 'rotate' | 'flip', y: number, icon: string, label: string): string =>
    `<g class="gem-btn" data-action="${action}" role="button" tabindex="0" aria-label="${label}"><title>${label}</title><circle cx="${cx}" cy="${y}" r="0.46"/><text x="${cx}" y="${y + 0.03}">${icon}</text></g>`;
  const rotate = isRotatable(shape) ? button('rotate', cy, '↻', t.actions.rotate) : '';
  const flipY = rotate ? cy + 1.05 : cy;
  const flip = shape.flippable ? button('flip', flipY, '⇋', t.actions.flip) : '';
  return `${rotate}${flip}`;
}

/**
 * Réserve des gemmes à poser, à droite de la grille : une grille SVG à part, à la même échelle que
 * la grille de jeu (le CSS donne la même taille à la case). Les gemmes déjà posées n'y figurent plus.
 */
export function trayHtml(view: GemsView): string {
  const height = hasExtensions(view.solution) ? PANEL_HEIGHT_EXTENDED : PANEL_HEIGHT;
  const gems = gemsOf(view.solution)
    .filter((gem) => view.solution[gem] === null)
    .map((gem) => gemGroupSvg(view, gem, 'panel'))
    .join('');
  return `<svg class="tray-svg" viewBox="0 0 ${PANEL_WIDTH} ${height}" role="group" aria-label="Gemmes à placer" style="--tray-h:${height}"><rect class="tray" x="0" y="0" width="${PANEL_WIDTH}" height="${height}" rx="0.3"/>${gems}</svg>`;
}

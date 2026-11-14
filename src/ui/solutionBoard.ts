/**
 * Grille de solution : le joueur y pose ses gemmes. Dessin en SVG ; les interactions
 * (glisser-déposer, clavier) sont dans app.ts.
 */
import { cellLabel } from '../game/board';
import { GRID_COLS, GRID_ROWS } from '../game/constants';
import {
  EXTENSION_GEM_IDS,
  GEM_SHAPES,
  type GemId,
  orientedPolygon,
  placedPolygon,
} from '../game/gems';
import { translate } from '../game/geometry';
import type { ShotResult } from '../game/laser';
import type { Notes } from '../game/notes';
import type { ShotRecord } from '../game/session';
import { type Solution, type SolutionIssue, gemsOf, sizeOf } from '../game/solution';
import { boardFrame, entryLabelsSvg } from './board';
import { notesLayerSvg } from './notesLayer';
import { RAY_COLOR, gemPolygons } from './palette';
import { t } from './strings';

/** Haut de la réserve, sous la grille et ses repères. */
export const TRAY_TOP = GRID_ROWS + 1.7;
/** Hauteur de la réserve : une rangée de plus quand le Diamant ou le diamant noir sont en jeu. */
const TRAY_HEIGHT = 5.4;
const TRAY_HEIGHT_EXTENDED = 6.8;

/** Vrai si la partie compte le Diamant ou le diamant noir. */
export function hasExtensions(solution: Solution): boolean {
  return EXTENSION_GEM_IDS.some((gem) => solution[gem] !== undefined);
}

function trayHeight(solution: Solution): number {
  return hasExtensions(solution) ? TRAY_HEIGHT_EXTENDED : TRAY_HEIGHT;
}

/** Hauteur ajoutée sous la grille pour la réserve. */
function trayExtra(solution: Solution): number {
  return TRAY_TOP + trayHeight(solution) - GRID_ROWS - 1.1 + 0.2;
}

/** Emplacement de chaque gemme dans la réserve (coin haut-gauche, orientation de départ). */
const SLOTS: Record<GemId, readonly [number, number]> = {
  'blue-triangle': [0.4, TRAY_TOP + 0.4],
  'white-triangle': [5.6, TRAY_TOP + 0.4],
  'red-parallelogram': [0.4, TRAY_TOP + 3.3],
  'yellow-triangle': [4.2, TRAY_TOP + 2.9],
  'white-rhombus': [7.0, TRAY_TOP + 2.9],
  diamond: [0.4, TRAY_TOP + 5.3],
  'black-body': [3.6, TRAY_TOP + 5.3],
};

/** Emplacements de la réserve placée à droite de la grille (plein écran en paysage). */
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
  if (layout === 'bottom') return SLOTS[gem];
  return (hasExtensions(solution) ? SIDE_SLOTS_EXTENDED : SIDE_SLOTS)[gem];
}

/** Réserve sous la grille (affichage normal) ou à sa droite (plein écran). */
export type TrayLayout = 'bottom' | 'side';

/** Coin haut-gauche actuel de la gemme : sur la grille si elle est posée, sinon dans la réserve. */
export function gemOrigin(
  solution: Solution,
  gem: GemId,
  layout: TrayLayout = 'bottom',
): [number, number] {
  const placement = solution[gem];
  if (placement) return [placement.col, placement.row];
  const [x, y] = slotOf(layout, solution, gem);
  return [x, y];
}

export interface SolutionView {
  solution: Solution;
  selected: GemId | null;
  issues: readonly SolutionIssue[];
  shots: readonly ShotRecord[];
  /** Tir simulé sur la grille du joueur, dont on dessine le trajet. */
  hypothesis: ShotResult | null;
  /** Notes du joueur, en transparence sous les gemmes ; null pour les masquer. */
  notes: Notes | null;
}

function points(list: readonly (readonly [number, number])[]): string {
  return list.map(([x, y]) => `${x},${y}`).join(' ');
}

export function gemGroupSvg(
  view: Pick<SolutionView, 'solution' | 'selected' | 'issues'>,
  gem: GemId,
  layout: TrayLayout = 'bottom',
): string {
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

/** Bouton rond posé au coin haut-droit de la gemme sélectionnée : pivoter, et retourner pour la rouge. */
export function gemButtonsSvg(view: Pick<SolutionView, 'solution' | 'selected'>): string {
  const gem = view.selected;
  const placement = gem ? view.solution[gem] : null;
  if (!gem || !placement) return '';
  const { width } = sizeOf(gem, placement.orientation);
  const cx = placement.col + width + 0.15;
  const cy = placement.row - 0.15;
  const button = (action: 'rotate' | 'flip', y: number, icon: string, label: string): string =>
    `<g class="gem-btn" data-action="${action}" role="button" tabindex="0" aria-label="${label}"><title>${label}</title><circle cx="${cx}" cy="${y}" r="0.46"/><text x="${cx}" y="${y + 0.03}">${icon}</text></g>`;
  const rotate = button('rotate', cy, '↻', t.actions.rotate);
  const flip = GEM_SHAPES[gem].flippable ? button('flip', cy + 1.05, '⇋', t.actions.flip) : '';
  return `${rotate}${flip}`;
}

export function solutionBoardSvg(view: SolutionView): string {
  const tray = `<rect class="tray" x="0" y="${TRAY_TOP}" width="${GRID_COLS}" height="${trayHeight(view.solution)}" rx="0.3"/>`;
  const gems = gemsOf(view.solution)
    .map((gem) => gemGroupSvg(view, gem))
    .join('');
  const ray = view.hypothesis
    ? `<polyline class="ray-outline" points="${points(view.hypothesis.path)}"/><polyline class="ray" points="${points(view.hypothesis.path)}" stroke="${RAY_COLOR[view.hypothesis.color]}"/>`
    : '';
  const marks = { shots: view.shots, selected: null };
  const ghostNotes = view.notes ? `<g class="ghost-notes">${notesLayerSvg(view.notes)}</g>` : '';
  return boardFrame(
    "Grille de solution : posez les gemmes à l'endroit où vous pensez qu'elles sont",
    `${tray}${ghostNotes}${gems}${ray}${entryLabelsSvg(marks, 'hypo')}${gemButtonsSvg(view)}`,
    'solution-svg',
    trayExtra(view.solution),
  );
}

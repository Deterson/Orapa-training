/**
 * Dessin de la grille en SVG : cases, repères du bord et marques des tirs.
 * Aucune logique de jeu ici, seulement de l'affichage.
 */
import { ENTRY_POINTS, type EntryPoint } from '../game/board';
import { GRID_COLS, GRID_ROWS } from '../game/constants';
import type { ShotRecord } from '../game/session';
import { RAY_COLOR } from './palette';

export interface ShotMarks {
  shots: readonly ShotRecord[];
  /** Numéro du tir mis en avant. */
  selected: number | null;
}

/** Marge autour de la grille pour les repères, en cases. */
export const BOARD_MARGIN = 1.1;

/** Centre du repère d'un point du bord, en coordonnées de la grille. */
export function labelCenter(entry: EntryPoint): [number, number] {
  const middle = entry.index + 0.5;
  switch (entry.side) {
    case 'top':
      return [middle, -0.5];
    case 'bottom':
      return [middle, GRID_ROWS + 0.5];
    case 'left':
      return [-0.5, middle];
    case 'right':
      return [GRID_COLS + 0.5, middle];
  }
}

export function gridLinesSvg(): string {
  const lines: string[] = [];
  for (let x = 0; x <= GRID_COLS; x++) {
    lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${GRID_ROWS}"/>`);
  }
  for (let y = 0; y <= GRID_ROWS; y++) {
    lines.push(`<line x1="0" y1="${y}" x2="${GRID_COLS}" y2="${y}"/>`);
  }
  return `<g class="grid">${lines.join('')}</g>`;
}

/** Repères du bord, cliquables, avec les marques des tirs déjà faits. */
export function entryLabelsSvg(marks: ShotMarks | null, action = 'fire'): string {
  return ENTRY_POINTS.map((entry) => {
    const [x, y] = labelCenter(entry);
    const from = marks?.shots.find((shot) => shot.entry === entry.label);
    const to = marks?.shots.filter((shot) => shot.exit === entry.label).at(-1);
    const highlighted = marks?.shots.find((shot) => shot.n === marks.selected);
    const selected = highlighted?.entry === entry.label || highlighted?.exit === entry.label;
    const classes = [
      'entry',
      from ? 'is-from' : '',
      to ? 'is-to' : '',
      selected ? 'is-selected' : '',
    ]
      .filter(Boolean)
      .join(' ');
    const badge = from
      ? `<circle class="badge" cx="${x + 0.34}" cy="${y - 0.34}" r="0.24"/><text class="badge-text" x="${x + 0.34}" y="${y - 0.34}">${from.n}</text>`
      : '';
    const dot = to
      ? `<circle class="dot" cx="${x + 0.3}" cy="${y + 0.3}" r="0.18" fill="${RAY_COLOR[to.color]}"/>`
      : '';
    return `<g class="${classes}" data-${action}="${entry.label}" role="button" tabindex="0" aria-label="Tirer un laser depuis le repère ${entry.label}"><rect x="${x - 0.45}" y="${y - 0.45}" width="0.9" height="0.9" rx="0.2"/><text class="label" x="${x}" y="${y}">${entry.label}</text>${badge}${dot}</g>`;
  }).join('');
}

/** Cadre commun des grilles : viewBox, fond et lignes. */
export function boardFrame(label: string, content: string, extraClass = ''): string {
  const size = `${-BOARD_MARGIN} ${-BOARD_MARGIN} ${GRID_COLS + 2 * BOARD_MARGIN} ${GRID_ROWS + 2 * BOARD_MARGIN}`;
  return `<svg class="board-svg ${extraClass}" viewBox="${size}" role="group" aria-label="${label}">
      <rect class="board" x="0" y="0" width="${GRID_COLS}" height="${GRID_ROWS}"/>
      ${gridLinesSvg()}
      ${content}
    </svg>`;
}

/** Grille de tir : aucune gemme n'est visible, seulement les résultats des tirs. */
export function shotBoardSvg(marks: ShotMarks): string {
  return boardFrame(
    'Grille de tir : 10 colonnes, 8 lignes, repères du bord cliquables',
    entryLabelsSvg(marks),
  );
}

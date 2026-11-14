/**
 * Dessin de la grille en SVG : cases, repères du bord et marques des tirs.
 * Aucune logique de jeu ici, seulement de l'affichage.
 */
import { ENTRY_POINTS, type EntryPoint, cellLabel, parseCell } from '../game/board';
import { GEM_PAINT_LABELS } from '../game/colors';
import { GRID_COLS, GRID_ROWS } from '../game/constants';
import { GEM_SHAPES, type Placement, placedPolygon } from '../game/gems';
import { isAbsorbed } from '../game/laser';
import type { Notes } from '../game/notes';
import type { ProbeRecord, ShotRecord } from '../game/session';
import { notesLayerSvg } from './notesLayer';
import {
  GEM_FILL,
  PAINT_LETTER,
  PATTERN_DEFS,
  RAY_COLOR,
  gemPolygons,
  lostSignalSvg,
  readableOn,
} from './palette';

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
export function entryLabelsSvg(
  marks: ShotMarks | null,
  action = 'fire',
  interactive = true,
): string {
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
    // Pastille de sortie : le même numéro que l'entrée, dans la couleur obtenue. Pour
    // « transparent », pas de pastille : le numéro seul.
    let dot = '';
    if (from && isAbsorbed(from)) {
      // Rayon absorbé : pas de point de sortie, le pictogramme « signal perdu » à sa place.
      dot = lostSignalSvg(x + 0.34, y + 0.34, 0.62);
    } else if (to) {
      const dx = x + 0.34;
      const dy = y + 0.34;
      if (to.color === 'transparent') {
        dot = `<text class="exit-number" x="${dx}" y="${dy}">${to.n}</text>`;
      } else {
        const fill = RAY_COLOR[to.color];
        dot = `<circle class="dot" cx="${dx}" cy="${dy}" r="0.24" fill="${fill}"/><text class="dot-text" x="${dx}" y="${dy}" fill="${readableOn(fill)}">${to.n}</text>`;
      }
    }
    if (!interactive) {
      return `<g class="${classes}" aria-hidden="true"><rect x="${x - 0.45}" y="${y - 0.45}" width="0.9" height="0.9" rx="0.2"/><text class="label" x="${x}" y="${y}">${entry.label}</text>${badge}${dot}</g>`;
    }
    return `<g class="${classes}" data-${action}="${entry.label}" role="button" tabindex="0" aria-label="${action === 'fire' || action === 'explore' ? 'Tirer un laser depuis' : 'Tester sur votre grille un tir depuis'} le repère ${entry.label}"><rect x="${x - 0.45}" y="${y - 0.45}" width="0.9" height="0.9" rx="0.2"/><text class="label" x="${x}" y="${y}">${entry.label}</text>${badge}${dot}</g>`;
  }).join('');
}

/** Cadre commun des grilles : viewBox, fond et lignes. */
export function boardFrame(
  label: string,
  content: string,
  extraClass = '',
  extraHeight = 0,
  extraWidth = 0,
): string {
  const size = `${-BOARD_MARGIN} ${-BOARD_MARGIN} ${GRID_COLS + 2 * BOARD_MARGIN + extraWidth} ${GRID_ROWS + 2 * BOARD_MARGIN + extraHeight}`;
  return `<svg class="board-svg ${extraClass}" viewBox="${size}" role="group" aria-label="${label}">
      ${PATTERN_DEFS}
      <rect class="board" x="0" y="0" width="${GRID_COLS}" height="${GRID_ROWS}"/>
      ${gridLinesSvg()}
      ${content}
    </svg>`;
}

export interface ShotBoardOptions {
  /** Gemmes posées par le joueur, affichées en transparence sous les repères. */
  gems?: readonly Placement[];
  /** Notes du joueur, affichées en transparence ; null pour les masquer. */
  notes?: Notes | null;
  probes?: readonly ProbeRecord[];
  /** Les cases sont cliquables pour sonder (partie en cours). */
  probeable?: boolean;
  /** Case du curseur clavier, pour sonder sans souris. */
  cursor?: { row: number; col: number };
}

export function probeMarksSvg(probes: readonly ProbeRecord[]): string {
  return probes
    .map((probe) => {
      const cell = parseCell(probe.cell);
      if (cell === null) return '';
      const cx = cell.col + 0.5;
      const cy = cell.row + 0.5;
      if (probe.content === 'nothing') {
        return `<circle class="probe-nothing" cx="${cx}" cy="${cy}" r="0.17"><title>Case ${probe.cell} : rien</title></circle>`;
      }
      if (probe.content === 'black') {
        return `<g class="probe-gem probe-lost"><rect x="${cell.col + 0.12}" y="${cell.row + 0.12}" width="0.76" height="0.76" rx="0.1" fill="${GEM_FILL.black}"/>${lostSignalSvg(cx, cy, 0.62)}<title>Case ${probe.cell} : signal perdu</title></g>`;
      }
      return `<g class="probe-gem"><rect x="${cell.col + 0.18}" y="${cell.row + 0.18}" width="0.64" height="0.64" rx="0.1" fill="${GEM_FILL[probe.content]}"/><text x="${cx}" y="${cy + 0.02}">${PAINT_LETTER[probe.content]}</text><title>Case ${probe.cell} : gemme ${GEM_PAINT_LABELS[probe.content]}</title></g>`;
    })
    .join('');
}

export function probeTargetsSvg(): string {
  const targets: string[] = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const label = cellLabel({ row, col });
      targets.push(
        `<rect class="probe-target" x="${col}" y="${row}" width="1" height="1" data-probe="${label}"/>`,
      );
    }
  }
  return targets.join('');
}

/** Curseur clavier : un seul arrêt de tabulation, déplacé aux flèches, Entrée pour sonder. */
function cursorSvg({ row, col }: { row: number; col: number }): string {
  const label = cellLabel({ row, col });
  return `<rect class="cell-cursor" data-cursor tabindex="0" role="button" aria-label="Case ${label} : Entrée pour sonder, flèches pour changer de case" x="${col}" y="${row}" width="1" height="1"/>`;
}

/** Gemmes du joueur en transparence, affichées sous les repères (onglets Tirs et Notes). */
export function ghostGemsSvg(gems: readonly Placement[]): string {
  if (gems.length === 0) return '';
  return `<g class="ghost-gems">${gems
    .map((placement) => {
      const shape = GEM_SHAPES[placement.gem];
      return gemPolygons(placedPolygon(placement), shape.color, 'real-gem');
    })
    .join('')}</g>`;
}

/** Grille de tir : aucune gemme n'est visible, seulement les résultats des tirs et des sondes. */
export function shotBoardSvg(marks: ShotMarks, options: ShotBoardOptions = {}): string {
  const { probes = [], probeable = false, cursor, gems = [], notes = null } = options;
  const ghostGems = ghostGemsSvg(gems);
  const ghostNotes = notes ? `<g class="ghost-notes">${notesLayerSvg(notes)}</g>` : '';
  return boardFrame(
    'Grille de tir : 10 colonnes, 8 lignes, repères du bord cliquables',
    `${ghostGems}${ghostNotes}${entryLabelsSvg(marks)}${probeMarksSvg(probes)}${probeable ? probeTargetsSvg() : ''}${probeable && cursor ? cursorSvg(cursor) : ''}`,
    probeable ? 'is-probeable' : '',
  );
}

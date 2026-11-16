/**
 * Dessin de la grille en SVG : cases, repères du bord et marques des tirs.
 * Aucune logique de jeu ici, seulement de l'affichage.
 */
import { ENTRY_POINTS, type EntryPoint, cellLabel, parseCell } from '../game/board';
import { GEM_PAINT_LABELS } from '../game/colors';
import { GRID_COLS, GRID_ROWS } from '../game/constants';
import { isAbsorbed } from '../game/laser';
import type { ProbeRecord, ShotRecord } from '../game/session';
import { t } from './strings';
import {
  CLEAR_FILL_OPACITY,
  GEM_FILL,
  PAINT_LETTER,
  PATTERN_DEFS,
  RAY_COLOR,
  lostSignalSvg,
  readableOn,
} from './palette';

export interface ShotMarks {
  shots: readonly ShotRecord[];
  /** Numéro du tir mis en avant. */
  selected: number | null;
  /** Numéro du tir qui vient d'être fait : ses pastilles apparaissent avec une petite animation. */
  fresh?: number | null;
}

/** Tir ou sonde en attente d'un second clic, annoncé par une bulle. */
export type Pending = { kind: 'fire'; label: string } | { kind: 'probe'; cell: string };

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
    const popped = (n: number, markup: string): string =>
      marks?.fresh === n ? `<g class="pop">${markup}</g>` : markup;
    const badge = from
      ? popped(
          from.n,
          `<circle class="badge" cx="${x + 0.34}" cy="${y - 0.34}" r="0.24"/><text class="badge-text" x="${x + 0.34}" y="${y - 0.34}">${from.n}</text>`,
        )
      : '';
    // Pastille de sortie : le même numéro que l'entrée, dans la couleur obtenue. Pour
    // « transparent », pas de pastille : le numéro seul.
    let dot = '';
    if (from && isAbsorbed(from)) {
      // Rayon absorbé : pas de point de sortie, le pictogramme « signal perdu » à sa place.
      dot = popped(from.n, lostSignalSvg(x + 0.34, y + 0.34, 0.62));
    } else if (to) {
      const dx = x + 0.34;
      const dy = y + 0.34;
      if (to.color === 'transparent') {
        dot = popped(to.n, `<text class="exit-number" x="${dx}" y="${dy}">${to.n}</text>`);
      } else {
        const fill = RAY_COLOR[to.color];
        dot = popped(
          to.n,
          `<circle class="dot" cx="${dx}" cy="${dy}" r="0.24" fill="${fill}"/><text class="dot-text" x="${dx}" y="${dy}" fill="${readableOn(fill)}">${to.n}</text>`,
        );
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

/** `fresh` : la case qui vient d'être sondée, dont la marque apparaît avec une petite animation. */
export function probeMarksSvg(probes: readonly ProbeRecord[], fresh: string | null = null): string {
  return probes
    .map((probe) => {
      const cell = parseCell(probe.cell);
      if (cell === null) return '';
      const cx = cell.col + 0.5;
      const cy = cell.row + 0.5;
      const pop = probe.cell === fresh ? ' pop' : '';
      if (probe.content === 'nothing') {
        return `<circle class="probe-nothing${pop}" cx="${cx}" cy="${cy}" r="0.17"><title>Case ${probe.cell} : rien</title></circle>`;
      }
      if (probe.content === 'black') {
        return `<g class="probe-gem probe-lost${pop}"><rect x="${cell.col + 0.12}" y="${cell.row + 0.12}" width="0.76" height="0.76" rx="0.1" fill="${GEM_FILL.black}"/>${lostSignalSvg(cx, cy, 0.62)}<title>Case ${probe.cell} : signal perdu</title></g>`;
      }
      return `<g class="probe-gem${pop}"><rect x="${cell.col + 0.18}" y="${cell.row + 0.18}" width="0.64" height="0.64" rx="0.1" fill="${GEM_FILL[probe.content]}"${probe.content === 'clear' ? ` fill-opacity="${CLEAR_FILL_OPACITY}" stroke="#2b6fa8" stroke-width="0.06"` : ''}/><text x="${cx}" y="${cy + 0.02}">${PAINT_LETTER[probe.content]}</text><title>Case ${probe.cell} : gemme ${GEM_PAINT_LABELS[probe.content]}</title></g>`;
    })
    .join('');
}

/**
 * Bulle verte « Tirer en E ? » / « Tirer en E4 ? » : le premier clic sur un repère ou une case l'affiche,
 * le second effectue le tir. Elle se pose à l'intérieur de la grille, la queue pointée vers le repère ou
 * la case, et laisse passer le pointeur (le second clic tombe sur le repère ou la case).
 */
export function bubbleSvg(pending: Pending | null): string {
  if (!pending) return '';
  const text =
    pending.kind === 'fire' ? t.bubble.fire(pending.label) : t.bubble.probe(pending.cell);
  const width = 0.3 * text.length + 0.7;
  const height = 0.95;
  const clampX = (x: number): number =>
    Math.min(Math.max(x, -BOARD_MARGIN + 0.2), GRID_COLS + BOARD_MARGIN - 0.2 - width);
  // Corps de la bulle (x0, y0), sens de la queue et point visé (tx, ty).
  let x0: number;
  let y0: number;
  let from: 'top' | 'bottom' | 'left' | 'right';
  let tx: number;
  let ty: number;
  if (pending.kind === 'fire') {
    const entry = ENTRY_POINTS.find((candidate) => candidate.label === pending.label);
    if (!entry) return '';
    const [x, y] = labelCenter(entry);
    from = entry.side;
    tx = x;
    ty = y;
    switch (entry.side) {
      case 'top':
        [x0, y0, ty] = [clampX(x - width / 2), 0.3, 0.02];
        break;
      case 'bottom':
        [x0, y0, ty] = [clampX(x - width / 2), GRID_ROWS - 0.3 - height, GRID_ROWS - 0.02];
        break;
      case 'left':
        [x0, y0, tx] = [0.3, y - height / 2, 0.02];
        break;
      case 'right':
        [x0, y0, tx] = [GRID_COLS - 0.3 - width, y - height / 2, GRID_COLS - 0.02];
        break;
    }
  } else {
    const cell = parseCell(pending.cell);
    if (cell === null) return '';
    tx = cell.col + 0.5;
    x0 = clampX(tx - width / 2);
    // Au-dessus de la case ; en dessous pour les deux premières lignes (le haut est pris par les repères).
    if (cell.row >= 2) {
      from = 'bottom';
      y0 = cell.row - 0.3 - height;
      ty = cell.row + 0.1;
    } else {
      from = 'top';
      y0 = cell.row + 1.3;
      ty = cell.row + 0.9;
    }
  }
  const tail = 0.2;
  let points: string;
  if (from === 'top' || from === 'bottom') {
    const base = from === 'top' ? y0 : y0 + height;
    points = `${tx - tail},${base} ${tx + tail},${base} ${tx},${ty}`;
  } else {
    const base = from === 'left' ? x0 : x0 + width;
    points = `${base},${y0 + height / 2 - tail} ${base},${y0 + height / 2 + tail} ${tx},${y0 + height / 2}`;
  }
  return `<g class="shot-bubble from-${from}" role="status" aria-label="${text}"><rect x="${x0}" y="${y0}" width="${width}" height="${height}" rx="0.3"/><polygon points="${points}"/><text x="${x0 + width / 2}" y="${y0 + height / 2 + 0.02}">${text}</text></g>`;
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
export function cursorSvg({ row, col }: { row: number; col: number }): string {
  const label = cellLabel({ row, col });
  return `<rect class="cell-cursor" data-cursor tabindex="0" role="button" aria-label="Case ${label} : Entrée pour sonder, flèches pour changer de case" x="${col}" y="${row}" width="1" height="1"/>`;
}

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
    // `late` : la pastille de résultat apparaît un demi-seconde après celle du tir (voir `.pop-late`).
    const popped = (n: number, markup: string, late = false): string =>
      marks?.fresh === n ? `<g class="pop${late ? ' pop-late' : ''}">${markup}</g>` : markup;
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
      dot = popped(from.n, lostSignalSvg(x + 0.34, y + 0.34, 0.62), true);
    } else if (to) {
      const dx = x + 0.34;
      const dy = y + 0.34;
      if (to.color === 'transparent') {
        dot = popped(to.n, `<text class="exit-number" x="${dx}" y="${dy}">${to.n}</text>`, true);
      } else {
        const fill = RAY_COLOR[to.color];
        dot = popped(
          to.n,
          `<circle class="dot" cx="${dx}" cy="${dy}" r="0.24" fill="${fill}"/><text class="dot-text" x="${dx}" y="${dy}" fill="${readableOn(fill)}">${to.n}</text>`,
          true,
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

/** Contour d'une case sondée : caché, sauf sélectionné ou survolé dans l'historique (voir `.probe-ring`). */
export function probeRingSvg(cell: string, selected: string | null): string {
  const position = parseCell(cell);
  if (position === null) return '';
  return `<rect class="probe-ring${cell === selected ? ' is-selected' : ''}" data-cell="${cell}" x="${position.col + 0.06}" y="${position.row + 0.06}" width="0.88" height="0.88" rx="0.12"/>`;
}

/**
 * `fresh` : la case qui vient d'être sondée, dont la marque apparaît avec une petite animation.
 * `selected` : la case de la sonde sélectionnée dans l'historique. Chaque sonde porte aussi un contour
 * (`.probe-ring`), caché sauf s'il est sélectionné ou survolé dans l'historique (voir app.ts).
 */
export function probeMarksSvg(
  probes: readonly ProbeRecord[],
  fresh: string | null = null,
  selected: string | null = null,
): string {
  return probes
    .map((probe) => {
      const cell = parseCell(probe.cell);
      if (cell === null) return '';
      const ring = probeRingSvg(probe.cell, selected);
      const cx = cell.col + 0.5;
      const cy = cell.row + 0.5;
      const pop = probe.cell === fresh ? ' pop pop-late' : '';
      if (probe.content === 'nothing') {
        return `${ring}<circle class="probe-nothing${pop}" cx="${cx}" cy="${cy}" r="0.17"><title>Case ${probe.cell} : rien</title></circle>`;
      }
      if (probe.content === 'black') {
        return `${ring}<g class="probe-gem probe-lost${pop}"><rect x="${cell.col + 0.12}" y="${cell.row + 0.12}" width="0.76" height="0.76" rx="0.1" fill="${GEM_FILL.black}"/>${lostSignalSvg(cx, cy, 0.62)}<title>Case ${probe.cell} : signal perdu</title></g>`;
      }
      return `${ring}<g class="probe-gem${pop}"><rect x="${cell.col + 0.18}" y="${cell.row + 0.18}" width="0.64" height="0.64" rx="0.1" fill="${GEM_FILL[probe.content]}"${probe.content === 'clear' ? ` fill-opacity="${CLEAR_FILL_OPACITY}" stroke="#2b6fa8" stroke-width="0.06"` : ''}/><text x="${cx}" y="${cy + 0.02}">${PAINT_LETTER[probe.content]}</text><title>Case ${probe.cell} : gemme ${GEM_PAINT_LABELS[probe.content]}</title></g>`;
    })
    .join('');
}

/** Pointeur précis (souris) : la grille est affichée grande, la bulle est alors réduite. */
function finePointer(): boolean {
  try {
    return window.matchMedia('(pointer: fine)').matches;
  } catch {
    return false;
  }
}

/**
 * Bulle verte « Tirer en E ? » / « Tirer en E4 ? » : le premier clic sur un repère ou une case l'affiche et
 * entoure en vert la cible ; le second effectue le tir. La bulle se pose au-dessus de la cible, la queue
 * pointée vers elle (au-dessous pour les repères du haut et la première ligne, faute de place), plus petite
 * à la souris. Elle laisse passer le pointeur : le second clic tombe sur le repère ou la case.
 */
export function bubbleSvg(pending: Pending | null): string {
  if (!pending) return '';
  const text =
    pending.kind === 'fire' ? t.bubble.fire(pending.label) : t.bubble.probe(pending.cell);
  const scale = finePointer() ? 0.72 : 1;
  const width = (0.3 * text.length + 0.7) * scale;
  const height = 0.95 * scale;
  const tail = 0.22 * scale;
  const half = 0.18 * scale;
  const clampX = (x: number): number =>
    Math.min(Math.max(x, -BOARD_MARGIN + 0.2), GRID_COLS + BOARD_MARGIN - 0.2 - width);
  // Cible : centre (tx) et bords haut et bas (top, bottom) du repère ou de la case, et son contour vert.
  let tx: number;
  let top: number;
  let bottom: number;
  let ring: string;
  let belowOnly = false;
  if (pending.kind === 'fire') {
    const entry = ENTRY_POINTS.find((candidate) => candidate.label === pending.label);
    if (!entry) return '';
    const [x, y] = labelCenter(entry);
    [tx, top, bottom] = [x, y - 0.45, y + 0.45];
    belowOnly = entry.side === 'top';
    ring = `<rect class="pending-ring" x="${x - 0.52}" y="${y - 0.52}" width="1.04" height="1.04" rx="0.26"/>`;
  } else {
    const cell = parseCell(pending.cell);
    if (cell === null) return '';
    [tx, top, bottom] = [cell.col + 0.5, cell.row, cell.row + 1];
    ring = `<rect class="pending-ring" x="${cell.col + 0.05}" y="${cell.row + 0.05}" width="0.9" height="0.9" rx="0.12"/>`;
  }
  // Au-dessus de la cible si la bulle tient dans le cadre, sinon au-dessous.
  const aboveY = top - 0.03 - tail - height;
  const above =
    !belowOnly && aboveY >= -BOARD_MARGIN + 0.1 && !(pending.kind === 'probe' && aboveY < -0.2);
  const x0 = clampX(tx - width / 2);
  const y0 = above ? aboveY : bottom + 0.03 + tail;
  const base = above ? y0 + height : y0;
  const tip = above ? top - 0.03 : bottom + 0.03;
  const points = `${tx - half},${base} ${tx + half},${base} ${tx},${tip}`;
  const side = above ? 'bottom' : 'top';
  return `${ring}<g class="shot-bubble from-${side}" role="status" aria-label="${text}"><rect x="${x0}" y="${y0}" width="${width}" height="${height}" rx="${0.3 * scale}"/><polygon points="${points}"/><text x="${x0 + width / 2}" y="${y0 + height / 2 + 0.02}" style="font-size:${0.48 * scale}px">${text}</text></g>`;
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

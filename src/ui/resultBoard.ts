/**
 * Écran de résultat : la vraie mine, avec les gemmes du joueur en pointillés (vert si bien
 * placée, rouge sinon), et le détail gemme par gemme.
 */
import { cellLabel } from '../game/board';
import { GEM_SHAPES, placedPolygon } from '../game/gems';
import type { ShotResult } from '../game/laser';
import { parseEntryLabel } from '../game/board';
import type { ShotRecord } from '../game/session';
import type { GemDiff } from '../game/verify';
import { boardFrame, entryLabelsSvg, labelCenter } from './board';
import { RAY_COLOR, gemPolygons } from './palette';

function points(list: readonly (readonly [number, number])[]): string {
  return list.map(([x, y]) => `${x},${y}`).join(' ');
}

/** Anneau autour d'un repère du bord. */
function ringSvg(label: string): string {
  const entry = parseEntryLabel(label);
  if (entry === null) return '';
  const [x, y] = labelCenter(entry);
  return `<rect class="explore-ring" x="${x - 0.5}" y="${y - 0.5}" width="1" height="1" rx="0.25"/>`;
}

/**
 * La vraie mine et la proposition du joueur. Les 36 repères restent cliquables : la partie est
 * finie, on peut donc tirer des lasers librement et en voir le trajet dans la mine révélée.
 */
export function resultBoardSvg(
  diffs: readonly GemDiff[],
  shots: readonly ShotRecord[] = [],
  explored: ShotResult | null = null,
): string {
  const actual = diffs
    .map(({ actual: placement }) => {
      const shape = GEM_SHAPES[placement.gem];
      return gemPolygons(points(placedPolygon(placement)), shape.color, 'real-gem', shape.label);
    })
    .join('');
  const guesses = diffs
    .filter((diff) => diff.guess !== null)
    .map(
      (diff) =>
        `<polygon class="guess-gem ${diff.status === 'correct' ? 'is-correct' : 'is-wrong'}" points="${points(placedPolygon(diff.guess!))}"/>`,
    )
    .join('');
  const path = explored ? points(explored.path) : '';
  const ray = explored
    ? `<polyline class="ray-outline" points="${path}"/><polyline class="ray" points="${path}" stroke="${RAY_COLOR[explored.color]}"/>${ringSvg(explored.entry)}${ringSvg(explored.exit)}`
    : '';
  return boardFrame(
    'La vraie mine et votre proposition : touchez un repère pour tirer un laser',
    `${actual}${guesses}${ray}${entryLabelsSvg({ shots, selected: null }, 'explore')}`,
    'result-svg',
  );
}

function whereIs(placement: GemDiff['actual']): string {
  return cellLabel({ row: placement.row, col: placement.col });
}

/** Ligne de détail pour une gemme, la plus courte possible. */
export function diffLine(diff: GemDiff): string {
  const label = GEM_SHAPES[diff.gem].label;
  if (diff.status === 'correct') return `✔ ${label} · ${whereIs(diff.actual)}`;
  if (diff.guess === null) return `✘ ${label} · ${whereIs(diff.actual)}`;
  const guess = whereIs(diff.guess);
  const actual = whereIs(diff.actual);
  return guess === actual
    ? `✘ ${label} · ${actual}, orientation`
    : `✘ ${label} · ${guess} → ${actual}`;
}

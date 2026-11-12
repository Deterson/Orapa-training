/**
 * Écran de résultat : la vraie mine, avec les gemmes du joueur en pointillés (vert si bien
 * placée, rouge sinon), et le détail gemme par gemme.
 */
import { cellLabel } from '../game/board';
import { GEM_SHAPES, placedPolygon } from '../game/gems';
import type { GemDiff } from '../game/verify';
import { boardFrame } from './board';
import { gemPolygons } from './palette';

function points(list: readonly (readonly [number, number])[]): string {
  return list.map(([x, y]) => `${x},${y}`).join(' ');
}

export function resultBoardSvg(diffs: readonly GemDiff[]): string {
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
  return boardFrame('La vraie mine et votre proposition', `${actual}${guesses}`, 'result-svg');
}

function whereIs(placement: GemDiff['actual']): string {
  return cellLabel({ row: placement.row, col: placement.col });
}

/** Phrase de détail pour une gemme. */
export function diffLine(diff: GemDiff): string {
  const label = GEM_SHAPES[diff.gem].label;
  if (diff.status === 'correct') return `✔ ${label} : bien placée en ${whereIs(diff.actual)}.`;
  if (diff.guess === null) {
    return `✘ ${label} : non posée, elle était en ${whereIs(diff.actual)}.`;
  }
  const same = whereIs(diff.guess) === whereIs(diff.actual);
  return same
    ? `✘ ${label} : bonne case (${whereIs(diff.actual)}) mais mauvaise orientation.`
    : `✘ ${label} : vous l'aviez en ${whereIs(diff.guess)}, elle est en ${whereIs(diff.actual)}.`;
}

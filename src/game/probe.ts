/**
 * « Qu'y a-t-il en E4 ? » : seconde action du livret. La réponse est « Rien » ou la couleur
 * de la gemme qui occupe la case. Source : docs/regles.md (« Autre type de question »).
 */
import { type Cell } from './board';
import type { GemPaint } from './colors';
import { GEM_SHAPES, type Placement, placedPolygon } from './gems';
import { type Polygon, relation } from './geometry';

/**
 * Réponse à une sonde : « rien », ou la couleur de la gemme présente. « clear » est le Diamant ;
 * « black » le Corps noir (le signal est absorbé).
 */
export type ProbeContent = 'nothing' | GemPaint;

function cellPolygon({ row, col }: Cell): Polygon {
  return [
    [col, row],
    [col + 1, row],
    [col + 1, row + 1],
    [col, row + 1],
  ];
}

/**
 * Une case contient une gemme si l'intérieur de la case et celui de la gemme se recouvrent,
 * même en partie (un triangle coupe une case en deux). Deux gemmes ne peuvent pas se partager
 * l'intérieur d'une même case : leurs côtés sont sur les diagonales de la case, et deux gemmes
 * ne peuvent pas être côte à côte.
 */
export function probeCell(placements: readonly Placement[], cell: Cell): ProbeContent {
  const square = cellPolygon(cell);
  for (const placement of placements) {
    if (relation(square, placedPolygon(placement)) === 'overlap') {
      return GEM_SHAPES[placement.gem].color;
    }
  }
  return 'nothing';
}

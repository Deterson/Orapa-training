/**
 * Dispositions d'exemple, utiles aux tests et au banc d'essai.
 */
import { type Placement, placementFromPolygon } from './gems';

/**
 * Disposition du schéma de la page 2 du livret (partie de base, 5 gemmes).
 *
 * Positions du parallélogramme rouge, du losange blanc et du grand triangle bleu : relevées sur
 * le schéma et confirmées par ses deux exemples (I → rouge en I ; 15 → violet clair en 8).
 * Positions du petit triangle jaune et du grand triangle blanc : lues sur le schéma, non
 * éprouvées par ces exemples.
 */
export const BOOKLET_LAYOUT: readonly Placement[] = [
  [
    'red-parallelogram',
    [
      [1, 1],
      [3, 1],
      [2, 2],
      [0, 2],
    ],
  ],
  [
    'white-rhombus',
    [
      [2, 4],
      [3, 5],
      [2, 6],
      [1, 5],
    ],
  ],
  [
    'yellow-triangle',
    [
      [3, 6],
      [5, 6],
      [3, 8],
    ],
  ],
  [
    'white-triangle',
    [
      [6, 6],
      [10, 6],
      [8, 8],
    ],
  ],
  [
    'blue-triangle',
    [
      [7, 2],
      [9, 0],
      [9, 4],
    ],
  ],
].map(([gem, vertices]) => {
  const placement = placementFromPolygon(gem as Placement['gem'], vertices as [number, number][]);
  if (placement === null) {
    throw new Error(`Disposition du livret impossible pour ${String(gem)}`);
  }
  return placement;
});

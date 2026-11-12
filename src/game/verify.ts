/**
 * Correction d'une proposition. La mine générée est la seule disposition possible : la
 * correction est donc une égalité stricte, gemme par gemme. Source : CLAUDE.md.
 */
import { type GemId, type Placement, placedPolygon } from './gems';
import { polygonKey } from './geometry';

/** Deux poses de la même gemme sont identiques si elles occupent exactement le même polygone. */
export function samePlacement(a: Placement, b: Placement): boolean {
  return a.gem === b.gem && polygonKey(placedPolygon(a)) === polygonKey(placedPolygon(b));
}

export interface GemDiff {
  gem: GemId;
  /** Bonne place, mauvaise place ou gemme non posée par le joueur. */
  status: 'correct' | 'wrong' | 'missing';
  actual: Placement;
  guess: Placement | null;
}

/** Compare, gemme par gemme, la vraie mine et la proposition du joueur. */
export function compareSolution(
  actual: readonly Placement[],
  guess: readonly Placement[],
): GemDiff[] {
  return actual.map((real) => {
    const proposed = guess.find((p) => p.gem === real.gem) ?? null;
    const status =
      proposed === null ? 'missing' : samePlacement(real, proposed) ? 'correct' : 'wrong';
    return { gem: real.gem, status, actual: real, guess: proposed };
  });
}

/** Vrai si toutes les gemmes sont à la bonne place, et seulement elles. */
export function isCorrect(actual: readonly Placement[], guess: readonly Placement[]): boolean {
  return (
    actual.length === guess.length &&
    compareSolution(actual, guess).every((diff) => diff.status === 'correct')
  );
}

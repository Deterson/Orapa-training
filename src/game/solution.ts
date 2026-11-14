/**
 * La solution du joueur : où il pense que les gemmes sont. Logique pure (sans DOM) pour poser,
 * déplacer, pivoter et retourner les gemmes, vérifier les règles de placement, et comparer sa
 * grille aux tirs déjà faits. Source : docs/regles.md.
 */
import { GRID_COLS, GRID_ROWS } from './constants';
import {
  ALL_GEM_IDS,
  BASE_GEM_IDS,
  GEM_SHAPES,
  type GemId,
  type Orientation,
  type Placement,
  orientedPolygon,
} from './gems';
import { boundingBox } from './geometry';
import { shoot } from './laser';
import { type Violation, validatePlacements } from './placement';
import type { ShotRecord } from './session';
import { visibilityViolations } from './visibility';

/**
 * Pour chaque gemme de la partie : sa pose sur la grille, ou null si elle est encore dans la
 * réserve. Les gemmes absentes de la partie (extensions non choisies) n'ont pas d'entrée.
 */
export type Solution = Readonly<Partial<Record<GemId, Placement | null>>>;

const DEFAULT_ORIENTATION: Orientation = { rotation: 0, flipped: false };

/** Solution vide pour ces gemmes (par défaut, celles de la partie de base). */
export function emptySolution(gems: readonly GemId[] = BASE_GEM_IDS): Solution {
  return Object.fromEntries(gems.map((gem) => [gem, null])) as Solution;
}

/** Les gemmes de la partie, dans l'ordre du jeu. */
export function gemsOf(solution: Solution): GemId[] {
  return ALL_GEM_IDS.filter((gem) => solution[gem] !== undefined);
}

/** Les gemmes posées, dans l'ordre du jeu. */
export function placedGems(solution: Solution): Placement[] {
  return ALL_GEM_IDS.flatMap((gem) => {
    const placement = solution[gem];
    return placement ? [placement] : [];
  });
}

export function isComplete(solution: Solution): boolean {
  return gemsOf(solution).every((gem) => solution[gem] !== null);
}

/** Largeur et hauteur de la gemme dans cette orientation, en cases. */
export function sizeOf(gem: GemId, orientation: Orientation): { width: number; height: number } {
  const box = boundingBox(orientedPolygon(GEM_SHAPES[gem], orientation));
  return { width: box.maxX, height: box.maxY };
}

/** Ramène la pose dans le plateau : une gemme ne peut pas dépasser (règle c). */
function clamped(placement: Placement): Placement {
  const { width, height } = sizeOf(placement.gem, placement.orientation);
  return {
    ...placement,
    col: Math.min(Math.max(Math.round(placement.col), 0), GRID_COLS - width),
    row: Math.min(Math.max(Math.round(placement.row), 0), GRID_ROWS - height),
  };
}

function withPlacement(solution: Solution, placement: Placement | null, gem: GemId): Solution {
  return { ...solution, [gem]: placement };
}

/**
 * Pose la gemme avec son coin haut-gauche près de (col, row), ramenée dans le plateau.
 * Une gemme déjà posée garde son orientation ; sinon elle prend l'orientation de départ.
 */
export function dropGem(solution: Solution, gem: GemId, col: number, row: number): Solution {
  if (solution[gem] === undefined) return solution;
  const orientation = solution[gem]?.orientation ?? DEFAULT_ORIENTATION;
  return withPlacement(solution, clamped({ gem, orientation, col, row }), gem);
}

/** Déplace une gemme posée d'un nombre de cases. */
export function nudgeGem(solution: Solution, gem: GemId, dCol: number, dRow: number): Solution {
  const placement = solution[gem];
  if (!placement) return solution;
  return withPlacement(
    solution,
    clamped({ ...placement, col: placement.col + dCol, row: placement.row + dRow }),
    gem,
  );
}

/** Pivote la gemme d'un quart de tour (sens horaire), en la gardant dans le plateau. */
export function rotateGem(solution: Solution, gem: GemId): Solution {
  const placement = solution[gem];
  if (!placement) return solution;
  const rotation = ((placement.orientation.rotation + 1) % 4) as Orientation['rotation'];
  return withPlacement(
    solution,
    clamped({ ...placement, orientation: { ...placement.orientation, rotation } }),
    gem,
  );
}

/** Retourne la gemme. Seule la gemme rouge a un quadrillage sur ses deux faces. */
export function flipGem(solution: Solution, gem: GemId): Solution {
  const placement = solution[gem];
  if (!placement || !GEM_SHAPES[gem].flippable) return solution;
  const orientation = { ...placement.orientation, flipped: !placement.orientation.flipped };
  return withPlacement(solution, clamped({ ...placement, orientation }), gem);
}

/** Remet la gemme dans la réserve. */
export function removeGem(solution: Solution, gem: GemId): Solution {
  return withPlacement(solution, null, gem);
}

export interface SolutionIssue extends Violation {
  /** Gemmes concernées, par identifiant. */
  gemIds: GemId[];
}

/**
 * Règles de placement enfreintes par la solution (a à d, recouvrement) et gemmes qu'aucun
 * laser ne pourrait atteindre en ligne droite (règle e : la vraie mine la respecte, donc une
 * solution qui l'enfreint est forcément fausse).
 */
export function solutionIssues(solution: Solution): SolutionIssue[] {
  const placed = placedGems(solution);
  const violations = [...validatePlacements(placed), ...visibilityViolations(placed)];
  return violations.map((violation) => ({
    ...violation,
    gemIds: violation.gems.flatMap((index) => {
      const placement = placed[index];
      return placement ? [placement.gem] : [];
    }),
  }));
}

/** Vrai si la solution est complète et respecte toutes les règles : elle peut être soumise. */
export function isSubmittable(solution: Solution): boolean {
  return isComplete(solution) && solutionIssues(solution).length === 0;
}

/**
 * Pour chaque tir déjà fait, la grille du joueur donne-t-elle le même résultat (sortie et
 * couleur) ? C'est l'outil de vérification d'hypothèse : il n'utilise que les réponses déjà
 * annoncées, jamais la mine.
 */
export function compareWithShots(
  solution: Solution,
  shots: readonly ShotRecord[],
): Map<number, boolean> {
  const placed = placedGems(solution);
  const result = new Map<number, boolean>();
  for (const shot of shots) {
    try {
      const mine = shoot(placed, shot.entry);
      result.set(shot.n, mine.exit === shot.exit && mine.color === shot.color);
    } catch {
      // Pose invalide qui empêche de suivre le rayon : le tir ne correspond pas.
      result.set(shot.n, false);
    }
  }
  return result;
}

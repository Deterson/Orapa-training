/**
 * Validation du placement des gemmes. Source : docs/regles.md (« Placement des gemmes »).
 *
 * Règles a à d et recouvrement sont vérifiées ici ; la règle e (visibilité) l'est dans
 * visibility.ts, car elle demande de lancer des rayons.
 */
import { GRID_COLS, GRID_ROWS } from './constants';
import { GEM_SHAPES, type Placement, placedPolygon } from './gems';
import { boundingBox, relation } from './geometry';

export type Rule =
  /** a. Face quadrillée visible : seule la gemme rouge peut être retournée. */
  | 'a'
  /** b. Coins sur les coins de la grille, pas de pose de travers. */
  | 'b'
  /** c. Dans le plateau. */
  | 'c'
  /** d. Pas côte à côte : seul un contact par un point est permis. */
  | 'd'
  /** e. Chaque gemme est atteignable en ligne droite depuis un bord. */
  | 'e'
  /** Deux gemmes ne peuvent pas occuper le même espace. */
  | 'overlap'
  /** Une même gemme posée plusieurs fois. */
  | 'duplicate';

export interface Violation {
  rule: Rule;
  /** Indices (dans la liste de placements) des gemmes concernées. */
  gems: readonly number[];
  /** Explication en français, prête à afficher. */
  message: string;
}

function name(placement: Placement): string {
  return GEM_SHAPES[placement.gem].label;
}

/** Une pose est alignée sur la grille si sa position et sa rotation sont des entiers valides. */
function isGridAligned(placement: Placement): boolean {
  const { col, row, orientation } = placement;
  return (
    Number.isInteger(col) &&
    Number.isInteger(row) &&
    Number.isInteger(orientation.rotation) &&
    orientation.rotation >= 0 &&
    orientation.rotation <= 3
  );
}

/**
 * Liste les règles de placement enfreintes (règles a à d, recouvrement, doublons).
 * Une liste vide veut dire que le placement est valide pour ces règles.
 */
export function validatePlacements(placements: readonly Placement[]): Violation[] {
  const violations: Violation[] = [];
  const geometric: number[] = [];

  placements.forEach((placement, index) => {
    if (!isGridAligned(placement)) {
      violations.push({
        rule: 'b',
        gems: [index],
        message: `${name(placement)} : chaque coin doit tomber sur un coin de la grille (règle b).`,
      });
      return;
    }
    geometric.push(index);

    if (placement.orientation.flipped && !GEM_SHAPES[placement.gem].flippable) {
      violations.push({
        rule: 'a',
        gems: [index],
        message: `${name(placement)} ne peut pas être retournée : seule la gemme rouge a un quadrillage sur ses deux faces (règle a).`,
      });
    }

    const box = boundingBox(placedPolygon(placement));
    if (box.minX < 0 || box.minY < 0 || box.maxX > GRID_COLS || box.maxY > GRID_ROWS) {
      violations.push({
        rule: 'c',
        gems: [index],
        message: `${name(placement)} dépasse du plateau (règle c).`,
      });
    }
  });

  geometric.forEach((i, position) => {
    const first = placements[i];
    if (first === undefined) return;
    for (const j of geometric.slice(position + 1)) {
      const second = placements[j];
      if (second === undefined) continue;

      if (first.gem === second.gem) {
        violations.push({
          rule: 'duplicate',
          gems: [i, j],
          message: `${name(first)} est posée plusieurs fois.`,
        });
        continue;
      }

      const contact = relation(placedPolygon(first), placedPolygon(second));
      if (contact === 'overlap') {
        violations.push({
          rule: 'overlap',
          gems: [i, j],
          message: `${name(first)} et ${name(second)} se chevauchent.`,
        });
      } else if (contact === 'segment') {
        violations.push({
          rule: 'd',
          gems: [i, j],
          message: `${name(first)} et ${name(second)} sont côte à côte : elles ne peuvent se toucher que par un point (règle d).`,
        });
      }
    }
  });

  return violations;
}

/** Vrai si les règles a à d, le recouvrement et les doublons sont respectés. */
export function isValidPlacement(placements: readonly Placement[]): boolean {
  return validatePlacements(placements).length === 0;
}

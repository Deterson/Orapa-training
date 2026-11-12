/**
 * Règle e : « Chaque gemme doit être accessible depuis au moins un bord du plateau
 * (il doit être possible de tracer une ligne pour l'atteindre). » Source : docs/regles.md.
 *
 * Lecture retenue : une gemme est visible s'il existe un point d'entrée dont le rayon, allant
 * tout droit et sans aucun rebond préalable, la touche comme première gemme rencontrée.
 */
import { ENTRY_POINTS } from './board';
import { GEM_SHAPES, type Placement, placedPolygon } from './gems';
import { findFirstHit, startOf } from './laser';
import type { Violation } from './placement';

/** Indices des gemmes qu'un rayon droit touche en premier depuis au moins un des 36 bords. */
export function visibleGemIndices(placements: readonly Placement[]): Set<number> {
  const polygons = placements.map(placedPolygon);
  const visible = new Set<number>();
  for (const entry of ENTRY_POINTS) {
    const { from, dir } = startOf(entry);
    const hit = findFirstHit(polygons, from, dir);
    if (hit !== null) {
      visible.add(hit.gem);
    }
  }
  return visible;
}

/** Indices des gemmes qu'aucun rayon droit ne peut atteindre. */
export function hiddenGemIndices(placements: readonly Placement[]): number[] {
  const visible = visibleGemIndices(placements);
  return placements.map((_, index) => index).filter((index) => !visible.has(index));
}

/** Vrai si chaque gemme est atteignable en ligne droite depuis un bord (règle e). */
export function isVisible(placements: readonly Placement[]): boolean {
  return hiddenGemIndices(placements).length === 0;
}

/** Une violation de la règle e par gemme cachée. */
export function visibilityViolations(placements: readonly Placement[]): Violation[] {
  return hiddenGemIndices(placements).flatMap((index): Violation[] => {
    const placement = placements[index];
    if (placement === undefined) return [];
    return [
      {
        rule: 'e',
        gems: [index],
        message: `${GEM_SHAPES[placement.gem].label} est cachée : aucun laser ne peut l'atteindre en ligne droite depuis un bord (règle e).`,
      },
    ];
  });
}

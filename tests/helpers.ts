import type { GemId, Placement } from '../src/game/gems';
import {
  BASE_GEM_IDS,
  GEM_SHAPES,
  distinctOrientations,
  placementFromPolygon,
} from '../src/game/gems';
import { GRID_COLS, GRID_ROWS } from '../src/game/constants';
import { boundingBox } from '../src/game/geometry';
import { orientedPolygon } from '../src/game/gems';
import { validatePlacements } from '../src/game/placement';

/** Pose une gemme à partir de ses sommets en coordonnées de la grille. */
export function place(gem: GemId, vertices: readonly (readonly [number, number])[]): Placement {
  const placement = placementFromPolygon(gem, vertices);
  if (placement === null) {
    throw new Error(`Aucune orientation de ${gem} ne donne ces sommets`);
  }
  return placement;
}

/** Petit générateur pseudo-aléatoire à graine (mulberry32), pour des tests reproductibles. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Tire une disposition valide (règles a à d) des 5 gemmes de la partie de base, par essais
 * successifs. Sert à éprouver le simulateur sur des configurations variées avant que le
 * vrai générateur n'existe.
 */
export function randomValidLayout(random: () => number): Placement[] | null {
  const placements: Placement[] = [];
  for (const gem of BASE_GEM_IDS) {
    const shape = GEM_SHAPES[gem];
    const orientations = distinctOrientations(shape);
    let placed = false;
    for (let attempt = 0; attempt < 200 && !placed; attempt++) {
      const orientation = orientations[Math.floor(random() * orientations.length)];
      if (orientation === undefined) continue;
      const box = boundingBox(orientedPolygon(shape, orientation));
      const width = box.maxX - box.minX;
      const height = box.maxY - box.minY;
      const candidate: Placement = {
        gem,
        orientation,
        col: Math.floor(random() * (GRID_COLS - width + 1)),
        row: Math.floor(random() * (GRID_ROWS - height + 1)),
      };
      if (validatePlacements([...placements, candidate]).length === 0) {
        placements.push(candidate);
        placed = true;
      }
    }
    if (!placed) return null;
  }
  return placements;
}

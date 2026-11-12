/**
 * Génération aléatoire d'une mine. Source : CLAUDE.md (« Génération aléatoire »).
 *
 * Une mine est acceptée si :
 *  - ses gemmes respectent les règles de placement a à d (aucun recouvrement, pas côte à côte) ;
 *  - chaque gemme est atteignable en ligne droite depuis un bord (règle e) ;
 *  - elle est la seule disposition possible qui produise ses 36 résultats de tir (unicité).
 *
 * La graine détermine entièrement le résultat : même graine et même GENERATOR_VERSION, même mine.
 */
import { GRID_COLS, GRID_ROWS } from './constants';
import {
  BASE_GEM_IDS,
  GEM_SHAPES,
  type GemId,
  type Placement,
  distinctOrientations,
  orientedPolygon,
} from './gems';
import { boundingBox } from './geometry';
import { validatePlacements } from './placement';
import { type Rng, createRng } from './rng';
import { isUnique } from './solve';
import { isVisible } from './visibility';

/**
 * À incrémenter à chaque changement qui modifie la mine produite par une graine (algorithme de
 * tirage, ordre des gemmes, règles). Les sauvegardes stockent la mine elle-même, pas seulement
 * la graine, pour rester lisibles après un tel changement.
 */
export const GENERATOR_VERSION = 1;

export interface Mine {
  seed: string;
  generatorVersion: number;
  placements: Placement[];
}

const PLACEMENT_TRIES = 100;

/** Tire une disposition valide (règles a à d) de ces gemmes, ou null si le tirage échoue. */
export function randomLayout(rng: Rng, gems: readonly GemId[] = BASE_GEM_IDS): Placement[] | null {
  const placements: Placement[] = [];
  for (const gem of gems) {
    const shape = GEM_SHAPES[gem];
    const orientations = distinctOrientations(shape);
    let placed = false;
    for (let attempt = 0; attempt < PLACEMENT_TRIES && !placed; attempt++) {
      const orientation = rng.pick(orientations);
      const box = boundingBox(orientedPolygon(shape, orientation));
      const candidate: Placement = {
        gem,
        orientation,
        col: rng.int(GRID_COLS - box.maxX + 1),
        row: rng.int(GRID_ROWS - box.maxY + 1),
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

export interface GenerationReport {
  mine: Mine;
  /** Nombre de dispositions tirées avant d'en accepter une. */
  attempts: number;
}

/** Génère la mine de cette graine et indique combien d'essais il a fallu. */
export function generateMineWithReport(seed: string, maxAttempts = 1000): GenerationReport {
  const rng = createRng(seed);
  for (let attempts = 1; attempts <= maxAttempts; attempts++) {
    const placements = randomLayout(rng);
    if (placements === null || !isVisible(placements) || !isUnique(placements)) continue;
    return { mine: { seed, generatorVersion: GENERATOR_VERSION, placements }, attempts };
  }
  throw new Error(`Aucune mine valide trouvée pour la graine « ${seed} » en ${maxAttempts} essais`);
}

/** Génère la mine de cette graine : toujours la même pour une graine et une version données. */
export function generateMine(seed: string): Mine {
  return generateMineWithReport(seed).mine;
}

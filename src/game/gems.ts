/**
 * Les gemmes de la partie de base, décrites comme données. Source : docs/regles.md (« Les gemmes »).
 *
 * ⚠️ Les formes sont lues sur les schémas du livret et restent à confirmer sur les pièces
 * (voir « Points à valider » dans docs/regles.md). Les extensions (Diamant, Corps noir) ne sont
 * pas modélisées : leurs formes sont inconnues.
 */
import type { GemColor } from './colors';
import {
  type Point,
  type Polygon,
  mirrorX,
  normalize,
  polygonKey,
  rotateQuarterTurn,
  translate,
  boundingBox,
} from './geometry';

export type GemId =
  'red-parallelogram' | 'yellow-triangle' | 'blue-triangle' | 'white-rhombus' | 'white-triangle';

export interface GemShape {
  id: GemId;
  color: GemColor;
  /** Nom affiché au joueur. */
  label: string;
  /** Sommets dans l'orientation de référence, en cases, boîte englobante en (0, 0). */
  vertices: Polygon;
  /**
   * Vrai si la pièce peut être retournée : quadrillage visible sur les deux faces.
   * C'est le cas de la gemme rouge seulement (précision du propriétaire du projet).
   */
  flippable: boolean;
}

const BIG_TRIANGLE: Polygon = [
  [0, 0],
  [4, 0],
  [2, 2],
];

export const GEM_SHAPES: Readonly<Record<GemId, GemShape>> = {
  'red-parallelogram': {
    id: 'red-parallelogram',
    color: 'red',
    label: 'Parallélogramme rouge',
    vertices: [
      [1, 0],
      [3, 0],
      [2, 1],
      [0, 1],
    ],
    flippable: true,
  },
  'yellow-triangle': {
    id: 'yellow-triangle',
    color: 'yellow',
    label: 'Petit triangle jaune',
    vertices: [
      [0, 0],
      [2, 0],
      [0, 2],
    ],
    flippable: false,
  },
  'blue-triangle': {
    id: 'blue-triangle',
    color: 'blue',
    label: 'Grand triangle bleu',
    vertices: BIG_TRIANGLE,
    flippable: false,
  },
  'white-rhombus': {
    id: 'white-rhombus',
    color: 'white',
    label: 'Losange blanc',
    vertices: [
      [1, 0],
      [2, 1],
      [1, 2],
      [0, 1],
    ],
    flippable: false,
  },
  'white-triangle': {
    id: 'white-triangle',
    color: 'white',
    label: 'Grand triangle blanc',
    vertices: BIG_TRIANGLE,
    flippable: false,
  },
};

/** Les 5 gemmes de la partie de base : 1 rouge, 1 jaune, 1 bleue, 2 blanches. */
export const BASE_GEM_IDS: readonly GemId[] = [
  'red-parallelogram',
  'yellow-triangle',
  'blue-triangle',
  'white-rhombus',
  'white-triangle',
];

/** Orientation : face retournée ou non (rouge seulement), puis rotation par quarts de tour. */
export interface Orientation {
  /** Nombre de quarts de tour dans le sens horaire. */
  rotation: 0 | 1 | 2 | 3;
  flipped: boolean;
}

/** Une gemme posée sur la grille. */
export interface Placement {
  gem: GemId;
  orientation: Orientation;
  /** Colonne du coin haut-gauche de la boîte englobante, à partir de 0. */
  col: number;
  /** Ligne du coin haut-gauche de la boîte englobante, à partir de 0. */
  row: number;
}

/** Sommets de la gemme dans cette orientation, boîte englobante recalée en (0, 0). */
export function orientedPolygon(shape: GemShape, orientation: Orientation): Polygon {
  let polygon: Polygon = orientation.flipped ? mirrorX(shape.vertices) : shape.vertices;
  for (let i = 0; i < orientation.rotation; i++) {
    polygon = rotateQuarterTurn(polygon);
  }
  return normalize(polygon);
}

/** Sommets de la gemme posée, en coordonnées de la grille (unité : la case). */
export function placedPolygon(placement: Placement): Polygon {
  const shape = GEM_SHAPES[placement.gem];
  return translate(orientedPolygon(shape, placement.orientation), placement.col, placement.row);
}

const ROTATIONS = [0, 1, 2, 3] as const;

/** Orientations qui donnent des positions différentes (une seule représentante par position). */
export function distinctOrientations(shape: GemShape): Orientation[] {
  const seen = new Set<string>();
  const result: Orientation[] = [];
  for (const flipped of shape.flippable ? [false, true] : [false]) {
    for (const rotation of ROTATIONS) {
      const orientation: Orientation = { rotation, flipped };
      const key = polygonKey(orientedPolygon(shape, orientation));
      if (!seen.has(key)) {
        seen.add(key);
        result.push(orientation);
      }
    }
  }
  return result;
}

/**
 * Retrouve la pose qui donne exactement ces sommets (en coordonnées de la grille).
 * Renvoie null si aucune orientation autorisée de la gemme ne convient.
 */
export function placementFromPolygon(gem: GemId, vertices: readonly Point[]): Placement | null {
  const shape = GEM_SHAPES[gem];
  const { minX, minY } = boundingBox(vertices);
  const wanted = polygonKey(normalize(vertices));
  for (const orientation of distinctOrientations(shape)) {
    if (polygonKey(orientedPolygon(shape, orientation)) === wanted) {
      return { gem, orientation, col: minX, row: minY };
    }
  }
  return null;
}

/**
 * Les gemmes, décrites comme données. Source : docs/regles.md (« Les gemmes »).
 *
 * ⚠️ Les formes de la partie de base sont lues sur les schémas du livret et restent à confirmer
 * sur les pièces (voir « Points à valider » dans docs/regles.md). Celles des extensions (Diamant,
 * Corps noir) viennent du propriétaire du projet.
 */
import type { GemPaint } from './colors';
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
  | 'red-parallelogram'
  | 'yellow-triangle'
  | 'blue-triangle'
  | 'white-rhombus'
  | 'white-triangle'
  | 'diamond'
  | 'black-body';

export interface GemShape {
  id: GemId;
  /** Couleur qu'elle ajoute au rayon, ou « clear » (Diamant) et « black » (Corps noir, absorbe). */
  color: GemPaint;
  /** Nom affiché au joueur. */
  label: string;
  /** Sommets dans l'orientation de référence, en cases, boîte englobante en (0, 0). */
  vertices: Polygon;
  /**
   * Vrai si la pièce peut être retournée : quadrillage visible sur les deux faces.
   * C'est le cas de la gemme rouge seulement (précision du propriétaire du projet).
   */
  flippable: boolean;
  /**
   * Axe de rotation, dans l'orientation de référence : le point autour duquel la gemme pivote, et qui
   * reste en place quand on la fait tourner. Le centre de la boîte englobante, sauf pour les pièces
   * dont la boîte a une largeur et une hauteur de parités différentes (Diamant, Corps noir) : le
   * centre de leur case de droite, pour que le pivot tombe sur une case.
   */
  pivot: Point;
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
    pivot: [1.5, 0.5],
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
    pivot: [1, 1],
  },
  'blue-triangle': {
    id: 'blue-triangle',
    color: 'blue',
    label: 'Grand triangle bleu',
    vertices: BIG_TRIANGLE,
    flippable: false,
    pivot: [2, 1],
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
    pivot: [1, 1],
  },
  'white-triangle': {
    id: 'white-triangle',
    color: 'white',
    label: 'Grand triangle blanc',
    vertices: BIG_TRIANGLE,
    flippable: false,
    pivot: [2, 1],
  },
  diamond: {
    id: 'diamond',
    color: 'clear',
    label: 'Diamant',
    // Un demi-losange blanc : triangle de base 2 et de hauteur 1.
    vertices: [
      [0, 0],
      [2, 0],
      [1, 1],
    ],
    flippable: false,
    pivot: [1.5, 0.5],
  },
  'black-body': {
    id: 'black-body',
    color: 'black',
    label: 'Corps noir',
    // Sa base rectangulaire : il se pose toujours dessus, pointe vers le haut.
    vertices: [
      [0, 0],
      [2, 0],
      [2, 1],
      [0, 1],
    ],
    flippable: false,
    pivot: [1.5, 0.5],
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

/** Les deux gemmes des extensions, au choix du joueur en début de partie. */
export const EXTENSION_GEM_IDS: readonly GemId[] = ['diamond', 'black-body'];

/** Les 7 gemmes du jeu, dans l'ordre d'affichage et de tirage. */
export const ALL_GEM_IDS: readonly GemId[] = [...BASE_GEM_IDS, ...EXTENSION_GEM_IDS];

/** Extensions choisies pour une partie. */
export interface Extensions {
  diamond: boolean;
  blackBody: boolean;
}

export const NO_EXTENSIONS: Readonly<Extensions> = { diamond: false, blackBody: false };

/** Les gemmes d'une partie : celles de base, puis le Diamant et le Corps noir s'ils sont choisis. */
export function gemsFor(extensions: Readonly<Extensions>): GemId[] {
  return [
    ...BASE_GEM_IDS,
    ...(extensions.diamond ? (['diamond'] as const) : []),
    ...(extensions.blackBody ? (['black-body'] as const) : []),
  ];
}

/** Les extensions que contient cette liste de gemmes. */
export function extensionsOf(gems: readonly GemId[]): Extensions {
  return { diamond: gems.includes('diamond'), blackBody: gems.includes('black-body') };
}

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
  return normalize(turned(shape.vertices, orientation));
}

/** Applique le retournement puis les quarts de tour, sans recaler la boîte englobante. */
function turned(points: Polygon, orientation: Orientation): Polygon {
  let result: Polygon = orientation.flipped ? mirrorX(points) : points;
  for (let i = 0; i < orientation.rotation; i++) {
    result = rotateQuarterTurn(result);
  }
  return result;
}

/** Axe de rotation de la gemme dans cette orientation, relatif au coin haut-gauche de sa boîte. */
export function orientedPivot(shape: GemShape, orientation: Orientation): Point {
  const { minX, minY } = boundingBox(turned(shape.vertices, orientation));
  const [x, y] = turned([shape.pivot], orientation)[0] ?? shape.pivot;
  return [x - minX, y - minY];
}

/** Axe de rotation de la gemme posée, en coordonnées de la grille : il ne bouge pas quand elle tourne. */
export function placedPivot(placement: Placement): Point {
  const [x, y] = orientedPivot(GEM_SHAPES[placement.gem], placement.orientation);
  return [placement.col + x, placement.row + y];
}

/** Distance maximale de l'axe aux bords de la gemme, quelle que soit son orientation (en cases). */
export function pivotReach(shape: GemShape): number {
  const [px, py] = shape.pivot;
  return Math.max(...shape.vertices.map(([x, y]) => Math.max(Math.abs(x - px), Math.abs(y - py))));
}

/** Vrai si faire tourner la gemme change quelque chose (faux pour le losange, identique dans ses 4 quarts de tour). */
export function isRotatable(shape: GemShape): boolean {
  const keys = new Set(
    ([0, 1, 2, 3] as const).map((rotation) =>
      polygonKey(orientedPolygon(shape, { rotation, flipped: false })),
    ),
  );
  return keys.size > 1;
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

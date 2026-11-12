/**
 * Géométrie sur coordonnées entières (unité : la case).
 * Toutes les gemmes sont des polygones convexes dont les sommets sont sur des coins de grille.
 * Les calculs restent exacts : on ne manipule que des entiers (et des demi-entiers pour le laser).
 */

/** Point (x, y), x vers la droite, y vers le bas. */
export type Point = readonly [number, number];

/** Polygone convexe, sommets dans l'ordre du contour. */
export type Polygon = readonly Point[];

export type Edge = readonly [Point, Point];

/** Résultat de la comparaison de deux polygones convexes fermés. */
export type Relation =
  /** Aucun point commun. */
  | 'apart'
  /** Un seul point commun (coin contre coin, ou coin contre le milieu d'un côté). */
  | 'point'
  /** Un segment commun de longueur non nulle : les gemmes sont « côte à côte ». */
  | 'segment'
  /** Les intérieurs se recouvrent. */
  | 'overlap';

function at(polygon: Polygon, index: number): Point {
  const point = polygon[index];
  if (point === undefined) {
    throw new Error(`Sommet ${index} introuvable`);
  }
  return point;
}

/** Côtés du polygone, chacun comme une paire de sommets consécutifs. */
export function edgesOf(polygon: Polygon): Edge[] {
  return polygon.map((point, i) => [point, at(polygon, (i + 1) % polygon.length)] as const);
}

export function translate(polygon: Polygon, dx: number, dy: number): Polygon {
  return polygon.map(([x, y]): Point => [x + dx, y + dy]);
}

/** Miroir autour de l'axe vertical (x devient −x). */
export function mirrorX(polygon: Polygon): Polygon {
  return polygon.map(([x, y]): Point => [-x, y]);
}

/** Rotation d'un quart de tour dans le sens des aiguilles d'une montre (y vers le bas). */
export function rotateQuarterTurn(polygon: Polygon): Polygon {
  return polygon.map(([x, y]): Point => [-y, x]);
}

export interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function boundingBox(polygon: Polygon): BoundingBox {
  const xs = polygon.map(([x]) => x);
  const ys = polygon.map(([, y]) => y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

/** Recale le polygone pour que sa boîte englobante commence en (0, 0). */
export function normalize(polygon: Polygon): Polygon {
  const { minX, minY } = boundingBox(polygon);
  return translate(polygon, -minX, -minY);
}

/** Clé canonique : deux polygones convexes ont la même clé s'ils ont les mêmes sommets. */
export function polygonKey(polygon: Polygon): string {
  return polygon
    .map(([x, y]) => `${x},${y}`)
    .sort()
    .join(' ');
}

function dot(a: Point, b: Point): number {
  return a[0] * b[0] + a[1] * b[1];
}

function projectionRange(polygon: Polygon, axis: Point): [number, number] {
  const values = polygon.map((point) => dot(point, axis));
  return [Math.min(...values), Math.max(...values)];
}

/** Intervalle, le long de `tangent`, des sommets qui touchent la droite d'appui sur `axis`. */
function supportInterval(
  polygon: Polygon,
  axis: Point,
  extreme: 'min' | 'max',
  tangent: Point,
): [number, number] {
  const [min, max] = projectionRange(polygon, axis);
  const target = extreme === 'min' ? min : max;
  const along = polygon.filter((point) => dot(point, axis) === target).map((p) => dot(p, tangent));
  return [Math.min(...along), Math.max(...along)];
}

/**
 * Compare deux polygones convexes fermés : disjoints, un point commun, un segment commun, ou
 * recouvrement. Méthode des axes séparateurs (normales des côtés), en arithmétique entière.
 *
 * S'il existe une droite qui touche les deux polygones sans les traverser, l'intersection est
 * contenue dans cette droite : on regarde alors si les deux côtés d'appui se recouvrent sur
 * une longueur non nulle (segment), nulle (point) ou négative (aucun contact).
 */
export function relation(a: Polygon, b: Polygon): Relation {
  let touching: { normal: Point; aOnLowSide: boolean } | null = null;

  for (const [p, q] of [...edgesOf(a), ...edgesOf(b)]) {
    const normal: Point = [q[1] - p[1], p[0] - q[0]];
    const [minA, maxA] = projectionRange(a, normal);
    const [minB, maxB] = projectionRange(b, normal);
    if (maxA < minB || maxB < minA) {
      return 'apart';
    }
    if (touching === null && (maxA === minB || maxB === minA)) {
      touching = { normal, aOnLowSide: maxA === minB };
    }
  }

  if (touching === null) {
    return 'overlap';
  }

  const { normal, aOnLowSide } = touching;
  const tangent: Point = [-normal[1], normal[0]];
  const [aLow, aHigh] = supportInterval(a, normal, aOnLowSide ? 'max' : 'min', tangent);
  const [bLow, bHigh] = supportInterval(b, normal, aOnLowSide ? 'min' : 'max', tangent);
  const shared = Math.min(aHigh, bHigh) - Math.max(aLow, bLow);

  if (shared > 0) return 'segment';
  if (shared === 0) return 'point';
  return 'apart';
}

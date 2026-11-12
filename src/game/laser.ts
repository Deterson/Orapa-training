/**
 * Simulateur de laser. Source : docs/regles.md (« Le rayon »).
 *
 * Le rayon suit le milieu des lignes et des colonnes (les centres des cases, donc des
 * coordonnées de la forme k + 0,5), alors que tous les sommets des gemmes sont sur des
 * coins de grille (coordonnées entières). Conséquences :
 *   - le rayon ne touche jamais un sommet exactement ;
 *   - il ne rencontre un côté diagonal qu'en un point de coordonnées demi-entières ;
 *   - tous les calculs sont exacts en virgule flottante (multiples de 0,5).
 */
import {
  type EntryPoint,
  ENTRY_POINTS,
  entryDirection,
  entryPoint,
  exitSide,
  parseEntryLabel,
} from './board';
import { GRID_COLS, GRID_ROWS } from './constants';
import { type GemColor, type ResultColor, mixColors } from './colors';
import { GEM_SHAPES, type Placement, placedPolygon } from './gems';
import { type Point, type Polygon, edgesOf } from './geometry';

/** Un contact du rayon avec une gemme. */
export interface LaserHit {
  /** Indice de la gemme dans la liste de placements. */
  gem: number;
  /** Point d'impact. */
  point: Point;
}

export interface ShotResult {
  /** Repère du point d'entrée. */
  entry: string;
  /** Repère du point de sortie (identique à l'entrée si le rayon revient sur ses pas). */
  exit: string;
  /** Couleur annoncée. */
  color: ResultColor;
  /** Couleurs distinctes touchées, dans l'ordre du premier contact. */
  touched: GemColor[];
  /** Contacts avec les gemmes, dans l'ordre. */
  hits: LaserHit[];
  /** Trajet à dessiner : de l'entrée sur le bord à la sortie sur le bord. */
  path: Point[];
}

export type Vec = readonly [number, number];

export interface Hit {
  gem: number;
  /** Distance parcourue depuis le point de départ, dans l'unité de la case. */
  distance: number;
  point: Point;
  /** Direction du côté touché. */
  edgeVector: Vec;
}

/**
 * Premier côté de gemme rencontré par un rayon parti de `from` dans la direction `dir`
 * (horizontale ou verticale). Les contacts à distance nulle sont ignorés : c'est le côté sur
 * lequel le rayon vient de rebondir.
 */
export function findFirstHit(polygons: readonly Polygon[], from: Vec, dir: Vec): Hit | null {
  const along = dir[0] !== 0 ? 0 : 1;
  const across = 1 - along;
  const sign = dir[along] ?? 1;
  const line = from[across] ?? 0;
  let best: Hit | null = null;

  polygons.forEach((polygon, gem) => {
    for (const [a, b] of edgesOf(polygon)) {
      const aAcross = a[across] ?? 0;
      const bAcross = b[across] ?? 0;
      // Un côté parallèle au rayon ne peut pas être touché.
      if (aAcross === bAcross) continue;
      if (!(line > Math.min(aAcross, bAcross) && line < Math.max(aAcross, bAcross))) continue;

      const ratio = (line - aAcross) / (bAcross - aAcross);
      const aAlong = a[along] ?? 0;
      const bAlong = b[along] ?? 0;
      const hitAlong = aAlong + ratio * (bAlong - aAlong);
      const distance = (hitAlong - (from[along] ?? 0)) * sign;
      if (distance <= 0) continue;

      if (best === null || distance < best.distance) {
        const point: Point = along === 0 ? [hitAlong, line] : [line, hitAlong];
        best = { gem, distance, point, edgeVector: [b[0] - a[0], b[1] - a[1]] };
      }
    }
  });

  return best;
}

/** Nouvelle direction après un rebond sur un côté de direction `edge`. */
export function reflect(dir: Vec, edge: Vec): Vec {
  const [ex, ey] = edge;
  // Côté aligné sur la grille, forcément perpendiculaire au rayon : demi-tour.
  if (ex === 0 || ey === 0) {
    return [-dir[0], -dir[1]];
  }
  if (Math.abs(ex) !== Math.abs(ey)) {
    throw new Error(`Côté ni droit ni à 45° : (${ex}, ${ey})`);
  }
  // Côté à 45° : symétrie du rayon par rapport à la droite du côté (virage de 90°).
  const sx = Math.sign(ex);
  const sy = Math.sign(ey);
  const along = dir[0] * sx + dir[1] * sy;
  return [along * sx - dir[0], along * sy - dir[1]];
}

/** Point du bord par lequel sort un rayon qui avance depuis `position` dans la direction `dir`. */
export function exitPointAt(position: Vec, dir: Vec): EntryPoint {
  const across = dir[0] !== 0 ? 1 : 0;
  return entryPoint(exitSide(dir[0], dir[1]), Math.floor(position[across] ?? 0));
}

/** Garde-fou : un rayon réversible ne boucle jamais, mais une pose invalide pourrait y conduire. */
const MAX_BOUNCES = 1000;

interface Scene {
  polygons: Polygon[];
  colors: GemColor[];
}

function buildScene(placements: readonly Placement[]): Scene {
  return {
    polygons: placements.map(placedPolygon),
    colors: placements.map((placement) => GEM_SHAPES[placement.gem].color),
  };
}

/** Point de départ du rayon, un demi-case en dehors du plateau pour toucher les gemmes collées au bord. */
export function startOf(entry: EntryPoint): { from: Vec; dir: Vec; edgePoint: Point } {
  const dir = entryDirection(entry.side);
  const middle = entry.index + 0.5;
  switch (entry.side) {
    case 'top':
      return { from: [middle, -0.5], dir, edgePoint: [middle, 0] };
    case 'bottom':
      return { from: [middle, GRID_ROWS + 0.5], dir, edgePoint: [middle, GRID_ROWS] };
    case 'left':
      return { from: [-0.5, middle], dir, edgePoint: [0, middle] };
    case 'right':
      return { from: [GRID_COLS + 0.5, middle], dir, edgePoint: [GRID_COLS, middle] };
  }
}

function trace(scene: Scene, entry: EntryPoint): ShotResult {
  const { from, dir: startDir, edgePoint } = startOf(entry);
  let position: Vec = from;
  let dir: Vec = startDir;
  const path: Point[] = [edgePoint];
  const hits: LaserHit[] = [];
  const touched: GemColor[] = [];

  for (let bounce = 0; bounce <= MAX_BOUNCES; bounce++) {
    const hit = findFirstHit(scene.polygons, position, dir);

    if (hit === null) {
      const exit = exitPointAt(position, dir);
      const side = exit.side;
      const [x, y] = position;
      const end: Point =
        side === 'right'
          ? [GRID_COLS, y]
          : side === 'left'
            ? [0, y]
            : side === 'bottom'
              ? [x, GRID_ROWS]
              : [x, 0];
      path.push(end);
      return {
        entry: entry.label,
        exit: exit.label,
        color: mixColors(touched),
        touched,
        hits,
        path,
      };
    }

    const color = scene.colors[hit.gem];
    if (color !== undefined && !touched.includes(color)) {
      touched.push(color);
    }
    hits.push({ gem: hit.gem, point: hit.point });
    path.push(hit.point);
    position = hit.point;
    dir = reflect(dir, hit.edgeVector);
  }

  throw new Error('Le rayon ne sort pas de la grille : la pose des gemmes est invalide.');
}

/** Tire un laser depuis un point d'entrée (« 15 », « I »...) et renvoie son résultat. */
export function shoot(placements: readonly Placement[], entry: string | EntryPoint): ShotResult {
  const point = typeof entry === 'string' ? parseEntryLabel(entry) : entry;
  if (point === null) {
    throw new Error(`Point d'entrée inconnu : « ${String(entry)} »`);
  }
  return trace(buildScene(placements), point);
}

/** Tire un laser depuis chacun des 36 points d'entrée : la « signature » complète de la mine. */
export function shootAll(placements: readonly Placement[]): ShotResult[] {
  const scene = buildScene(placements);
  return ENTRY_POINTS.map((entry) => trace(scene, entry));
}

/** Résultat observable d'un tir : tout ce que le joueur apprend (le trajet n'en fait pas partie). */
export interface ShotOutcome {
  exit: string;
  color: ResultColor;
}

/** Les 36 résultats d'une mine, dans l'ordre de ENTRY_POINTS. */
export type Signature = readonly ShotOutcome[];

export function signatureOf(placements: readonly Placement[]): Signature {
  return shootAll(placements).map(({ exit, color }) => ({ exit, color }));
}

export function sameSignature(a: Signature, b: Signature): boolean {
  return (
    a.length === b.length && a.every((x, i) => x.exit === b[i]?.exit && x.color === b[i]?.color)
  );
}

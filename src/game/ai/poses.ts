/**
 * Catalogue des poses possibles de chaque gemme sur la grille (orientation, colonne, ligne), avec le
 * polygone et les cases recouvertes, calculés une fois. Sert à l'IA pour déplacer une gemme en un clin
 * d'œil sans refaire de géométrie. Logique pure, sans DOM.
 */
import { GRID_COLS, GRID_ROWS } from '../constants';
import {
  GEM_SHAPES,
  type GemId,
  type Placement,
  distinctOrientations,
  orientedPolygon,
  placedPolygon,
} from '../gems';
import { type Polygon, boundingBox, polygonKey, relation } from '../geometry';

export interface Pose {
  /** Identifiant unique de la pose : gemme et polygone occupé (indépendant de la façon de tourner). */
  key: string;
  placement: Placement;
  polygon: Polygon;
  /** Cases dont l'intérieur est recouvert, numérotées `ligne × 10 + colonne`. */
  cells: readonly number[];
  /** Boîte englobante, pour écarter vite les poses éloignées. */
  box: { minX: number; maxX: number; minY: number; maxY: number };
}

/** Numéro d'une case dans les tableaux de l'IA. */
export function cellIndex(row: number, col: number): number {
  return row * GRID_COLS + col;
}

export const CELL_COUNT = GRID_COLS * GRID_ROWS;

function coveredCells(polygon: Polygon): number[] {
  const box = boundingBox(polygon);
  const cells: number[] = [];
  for (let row = box.minY; row < box.maxY; row++) {
    for (let col = box.minX; col < box.maxX; col++) {
      const square: Polygon = [
        [col, row],
        [col + 1, row],
        [col + 1, row + 1],
        [col, row + 1],
      ];
      if (relation(square, polygon) === 'overlap') cells.push(cellIndex(row, col));
    }
  }
  return cells;
}

const catalog = new Map<GemId, Pose[]>();
const byKey = new Map<string, Pose>();
const byCell = new Map<GemId, Map<number, Pose[]>>();

/** Toutes les poses valides isolément de cette gemme (dans le plateau, orientations autorisées). */
export function posesOf(gem: GemId): readonly Pose[] {
  const known = catalog.get(gem);
  if (known) return known;
  const shape = GEM_SHAPES[gem];
  const poses: Pose[] = [];
  for (const orientation of distinctOrientations(shape)) {
    const box = boundingBox(orientedPolygon(shape, orientation));
    for (let row = 0; row + box.maxY <= GRID_ROWS; row++) {
      for (let col = 0; col + box.maxX <= GRID_COLS; col++) {
        const placement: Placement = { gem, orientation, col, row };
        const polygon = placedPolygon(placement);
        const pose: Pose = {
          key: `${gem}|${polygonKey(polygon)}`,
          placement,
          polygon,
          cells: coveredCells(polygon),
          box: boundingBox(polygon),
        };
        poses.push(pose);
        byKey.set(pose.key, pose);
      }
    }
  }
  catalog.set(gem, poses);
  return poses;
}

/** La pose du catalogue qui occupe exactement la place de cette gemme posée. */
export function poseOf(placement: Placement): Pose | undefined {
  posesOf(placement.gem);
  return byKey.get(`${placement.gem}|${polygonKey(placedPolygon(placement))}`);
}

/** Les poses de cette gemme qui recouvrent cette case. */
export function posesCovering(gem: GemId, cell: number): readonly Pose[] {
  let index = byCell.get(gem);
  if (!index) {
    index = new Map();
    for (const pose of posesOf(gem)) {
      for (const covered of pose.cells) {
        const list = index.get(covered);
        if (list) list.push(pose);
        else index.set(covered, [pose]);
      }
    }
    byCell.set(gem, index);
  }
  return index.get(cell) ?? [];
}

/** Deux poses de gemmes différentes sont compatibles si elles ne se chevauchent pas et ne sont pas côte à côte. */
export function compatible(a: Pose, b: Pose): boolean {
  if (a.placement.gem === b.placement.gem) return false;
  // Boîtes qui ne se touchent même pas : les gemmes sont loin l'une de l'autre.
  if (a.box.maxX < b.box.minX || b.box.maxX < a.box.minX) return true;
  if (a.box.maxY < b.box.minY || b.box.maxY < a.box.minY) return true;
  const contact = relation(a.polygon, b.polygon);
  return contact === 'apart' || contact === 'point';
}

/**
 * Grille, cases et points d'entrée/sortie. Source : docs/regles.md (« La grille »).
 *
 * Repères du livret :
 *   haut   1 à 10  (colonnes, gauche → droite, le rayon descend)
 *   droite 11 à 18 (lignes, haut → bas, le rayon va vers la gauche)
 *   bas    I à R   (colonnes, gauche → droite, le rayon monte)
 *   gauche A à H   (lignes, haut → bas, le rayon va vers la droite)
 */
import { GRID_COLS, GRID_ROWS } from './constants';

export type Side = 'top' | 'right' | 'bottom' | 'left';

/** Case de la grille, indices à partir de 0 : `row` 0 = ligne A, `col` 0 = colonne 1. */
export interface Cell {
  row: number;
  col: number;
}

const ROW_LETTERS = 'ABCDEFGH';
const BOTTOM_LETTERS = 'IJKLMNOPQR';

/** Libellé d'une case : « E4 » pour la ligne E, colonne 4. */
export function cellLabel({ row, col }: Cell): string {
  const letter = ROW_LETTERS[row];
  if (letter === undefined || !Number.isInteger(col) || col < 0 || col >= GRID_COLS) {
    throw new Error(`Case hors de la grille : ligne ${row}, colonne ${col}`);
  }
  return `${letter}${col + 1}`;
}

/** Lit un libellé de case (« E4 », « e4 »). Renvoie null s'il est invalide. */
export function parseCell(label: string): Cell | null {
  const match = /^([A-Ha-h])(\d{1,2})$/.exec(label.trim());
  if (!match) return null;
  const row = ROW_LETTERS.indexOf((match[1] ?? '').toUpperCase());
  const col = Number(match[2]) - 1;
  if (row < 0 || col < 0 || col >= GRID_COLS) return null;
  return { row, col };
}

/** Point d'entrée ou de sortie sur le bord du plateau. */
export interface EntryPoint {
  /** Repère du livret : « 1 » à « 18 », « A » à « R ». */
  label: string;
  side: Side;
  /** Colonne (haut et bas) ou ligne (gauche et droite), à partir de 0. */
  index: number;
}

/** Longueur du bord : nombre de colonnes en haut et en bas, de lignes à gauche et à droite. */
function sideLength(side: Side): number {
  return side === 'top' || side === 'bottom' ? GRID_COLS : GRID_ROWS;
}

function labelOf(side: Side, index: number): string {
  switch (side) {
    case 'top':
      return String(index + 1);
    case 'right':
      return String(GRID_COLS + index + 1);
    case 'bottom':
      return BOTTOM_LETTERS.charAt(index);
    case 'left':
      return ROW_LETTERS.charAt(index);
  }
}

/** Point du bord sur ce côté, à cette colonne ou ligne. */
export function entryPoint(side: Side, index: number): EntryPoint {
  if (!Number.isInteger(index) || index < 0 || index >= sideLength(side)) {
    throw new Error(`Point du bord inexistant : ${side} ${index}`);
  }
  return { label: labelOf(side, index), side, index };
}

const SIDES: readonly Side[] = ['top', 'right', 'bottom', 'left'];

/** Les 36 points d'entrée, dans l'ordre 1–10, 11–18, I–R, A–H. */
export const ENTRY_POINTS: readonly EntryPoint[] = SIDES.flatMap((side) =>
  Array.from({ length: sideLength(side) }, (_, index) => entryPoint(side, index)),
);

const BY_LABEL = new Map(ENTRY_POINTS.map((point) => [point.label, point]));

/** Lit un repère (« 15 », « I », « i »). Renvoie null s'il n'existe pas. */
export function parseEntryLabel(label: string): EntryPoint | null {
  return BY_LABEL.get(label.trim().toUpperCase()) ?? null;
}

/** Direction du rayon qui entre par ce côté (dx, dy), y vers le bas. */
export function entryDirection(side: Side): readonly [number, number] {
  switch (side) {
    case 'top':
      return [0, 1];
    case 'right':
      return [-1, 0];
    case 'bottom':
      return [0, -1];
    case 'left':
      return [1, 0];
  }
}

/** Côté par lequel sort un rayon qui avance dans cette direction. */
export function exitSide(dx: number, dy: number): Side {
  if (dx === 1) return 'right';
  if (dx === -1) return 'left';
  if (dy === 1) return 'bottom';
  return 'top';
}

/**
 * Notes du joueur : marques de cases (couleur, « vide », « doute ») et traits au crayon,
 * avec annuler / rétablir. Logique pure et sérialisable. Les notes n'ont aucun effet sur la
 * correction : elles ne servent qu'à poser des hypothèses.
 */
import { GRID_COLS, GRID_ROWS } from './constants';
import { cellLabel } from './board';

/** Marque posée sur une case : une couleur de gemme supposée, « vide » (stries) ou « doute ». */
export type CellMark = 'red' | 'yellow' | 'blue' | 'white' | 'empty' | 'maybe';

/** Couleur d'encre du crayon. */
export type Ink = 'ink' | 'red' | 'yellow' | 'blue';

export type NotePoint = readonly [number, number];

export interface Stroke {
  ink: Ink;
  /** Points du trait, en coordonnées de la grille (unité : la case). */
  points: readonly NotePoint[];
}

export interface Notes {
  /** Marque par case, indexée par libellé (« E4 »). */
  marks: Readonly<Record<string, CellMark>>;
  strokes: readonly Stroke[];
}

export interface NotesHistory {
  present: Notes;
  past: readonly Notes[];
  future: readonly Notes[];
}

/** Nombre maximal d'étapes gardées pour annuler. */
export const MAX_UNDO = 200;

export function emptyNotes(): Notes {
  return { marks: {}, strokes: [] };
}

export function newHistory(notes: Notes = emptyNotes()): NotesHistory {
  return { present: notes, past: [], future: [] };
}

export function isEmpty(notes: Notes): boolean {
  return Object.keys(notes.marks).length === 0 && notes.strokes.length === 0;
}

/** Enregistre `next` comme nouvel état si c'est un vrai changement ; vide la pile « rétablir ». */
export function commit(history: NotesHistory, next: Notes): NotesHistory {
  if (next === history.present) return history;
  return { present: next, past: [...history.past, history.present].slice(-MAX_UNDO), future: [] };
}

export function undo(history: NotesHistory): NotesHistory {
  const previous = history.past.at(-1);
  if (previous === undefined) return history;
  return {
    present: previous,
    past: history.past.slice(0, -1),
    future: [history.present, ...history.future],
  };
}

export function redo(history: NotesHistory): NotesHistory {
  const [next, ...rest] = history.future;
  if (next === undefined) return history;
  return { present: next, past: [...history.past, history.present], future: rest };
}

/** Libellé de la case qui contient ce point, ou null s'il est hors de la grille. */
export function cellAt([x, y]: NotePoint): string | null {
  const col = Math.floor(x);
  const row = Math.floor(y);
  if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return null;
  return cellLabel({ row, col });
}

/** Pose la marque sur la case ; poser la même marque une seconde fois l'enlève. */
export function toggleMark(notes: Notes, cell: string, mark: CellMark): Notes {
  const marks = { ...notes.marks };
  if (marks[cell] === mark) {
    delete marks[cell];
  } else {
    marks[cell] = mark;
  }
  return { ...notes, marks };
}

export function addStroke(notes: Notes, stroke: Stroke): Notes {
  return stroke.points.length === 0 ? notes : { ...notes, strokes: [...notes.strokes, stroke] };
}

function distanceToSegment(p: NotePoint, a: NotePoint, b: NotePoint): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.min(1, Math.max(0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSquared));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Un trait est touché si le point est à moins de `radius` de l'un de ses segments. */
export function strokeNear(stroke: Stroke, point: NotePoint, radius: number): boolean {
  const { points } = stroke;
  const first = points[0];
  if (first === undefined) return false;
  if (points.length === 1) return Math.hypot(point[0] - first[0], point[1] - first[1]) <= radius;
  return points.some((p, i) => {
    const previous = points[i - 1];
    return previous !== undefined && distanceToSegment(point, previous, p) <= radius;
  });
}

/** Gomme : efface la marque de la case sous le point et les traits qui passent à proximité. */
export function eraseAt(notes: Notes, point: NotePoint, radius = 0.3): Notes {
  const cell = cellAt(point);
  const hasMark = cell !== null && notes.marks[cell] !== undefined;
  const strokes = notes.strokes.filter((stroke) => !strokeNear(stroke, point, radius));
  if (!hasMark && strokes.length === notes.strokes.length) return notes;
  const marks = { ...notes.marks };
  if (cell !== null) delete marks[cell];
  return { marks, strokes };
}

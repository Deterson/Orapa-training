/**
 * Format de la sauvegarde locale et validation. Une sauvegarde lue dans le navigateur peut être
 * vide, ancienne, tronquée ou modifiée à la main : `parseSave` ne renvoie une partie que si tout
 * est cohérent, sinon null, et le jeu repart d'une partie neuve sans jamais planter.
 */
import { parseCell, parseEntryLabel } from './board';
import type { Mine } from './generate';
import { BASE_GEM_IDS, GEM_SHAPES, type GemId, type Placement } from './gems';
import type { CellMark, Ink, Notes, Stroke } from './notes';
import { validatePlacements } from './placement';
import { MAX_ATTEMPTS, type GameStatus, type SessionSnapshot } from './session';
import type { Solution } from './solution';

/** À incrémenter quand le format change de façon incompatible : l'ancienne sauvegarde est alors ignorée. */
export const SAVE_VERSION = 1;

export interface SaveData {
  version: typeof SAVE_VERSION;
  savedAt: number;
  session: SessionSnapshot;
  solution: Solution;
  notes: Notes;
  /** Confirmations des tirs et sondes désactivées pour cette partie. */
  skipConfirm: boolean;
}

type Json = Record<string, unknown>;

const isRecord = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isInt = (value: unknown): value is number => Number.isInteger(value);
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

function parsePlacement(value: unknown): Placement | null {
  if (!isRecord(value) || !isRecord(value['orientation'])) return null;
  const { gem, col, row } = value;
  const { rotation, flipped } = value['orientation'];
  if (typeof gem !== 'string' || !(gem in GEM_SHAPES)) return null;
  if (!isInt(col) || !isInt(row) || !isInt(rotation) || rotation < 0 || rotation > 3) return null;
  if (typeof flipped !== 'boolean') return null;
  return {
    gem: gem as GemId,
    orientation: { rotation: rotation as 0 | 1 | 2 | 3, flipped },
    col,
    row,
  };
}

function parseMine(value: unknown): Mine | null {
  if (!isRecord(value) || !Array.isArray(value['placements'])) return null;
  const { seed, generatorVersion } = value;
  if (typeof seed !== 'string' || !isInt(generatorVersion)) return null;
  const placements = value['placements'].map(parsePlacement);
  if (placements.some((p) => p === null)) return null;
  const list = placements as Placement[];
  // Exactement les gemmes de la partie de base, posées selon les règles.
  const gems = list.map((p) => p.gem).sort();
  if (gems.join() !== [...BASE_GEM_IDS].sort().join()) return null;
  if (validatePlacements(list).length > 0) return null;
  return { seed, generatorVersion, placements: list };
}

function parseLabels(value: unknown, valid: (label: string) => boolean): string[] | null {
  if (!Array.isArray(value)) return null;
  const labels = value.filter((v): v is string => typeof v === 'string');
  if (labels.length !== value.length || !labels.every(valid)) return null;
  return new Set(labels).size === labels.length ? labels : null;
}

const STATUSES: readonly GameStatus[] = ['playing', 'won', 'lost', 'abandoned'];

function parseSnapshot(value: unknown): SessionSnapshot | null {
  if (!isRecord(value)) return null;
  const mine = parseMine(value['mine']);
  const shots = parseLabels(value['shots'], (label) => parseEntryLabel(label) !== null);
  const probes = parseLabels(value['probes'], (label) => parseCell(label) !== null);
  const { attempts, status, elapsedMs } = value;
  if (mine === null || shots === null || probes === null) return null;
  if (!isInt(attempts) || attempts < 0 || attempts > MAX_ATTEMPTS) return null;
  if (typeof status !== 'string' || !STATUSES.includes(status as GameStatus)) return null;
  if (!isFiniteNumber(elapsedMs) || elapsedMs < 0) return null;
  return { mine, shots, probes, attempts, status: status as GameStatus, elapsedMs };
}

function parseSolution(value: unknown): Solution | null {
  if (!isRecord(value)) return null;
  const result: Partial<Record<GemId, Placement | null>> = {};
  for (const gem of BASE_GEM_IDS) {
    const entry = value[gem];
    if (entry === null) {
      result[gem] = null;
      continue;
    }
    const placement = parsePlacement(entry);
    if (placement === null || placement.gem !== gem) return null;
    result[gem] = placement;
  }
  return result as Solution;
}

const MARKS: readonly CellMark[] = ['red', 'yellow', 'blue', 'white', 'empty', 'maybe'];
const INKS: readonly Ink[] = ['ink', 'red', 'yellow', 'blue', 'green'];
const MAX_STROKES = 2000;
const MAX_POINTS = 5000;

function parseStroke(value: unknown): Stroke | null {
  if (!isRecord(value) || !Array.isArray(value['points'])) return null;
  const { ink } = value;
  if (typeof ink !== 'string' || !INKS.includes(ink as Ink)) return null;
  if (value['points'].length === 0 || value['points'].length > MAX_POINTS) return null;
  const points = value['points'].map((p): [number, number] | null =>
    Array.isArray(p) && p.length === 2 && isFiniteNumber(p[0]) && isFiniteNumber(p[1])
      ? [p[0], p[1]]
      : null,
  );
  if (points.some((p) => p === null)) return null;
  return { ink: ink as Ink, points: points as [number, number][] };
}

function parseNotes(value: unknown): Notes | null {
  if (!isRecord(value) || !isRecord(value['marks']) || !Array.isArray(value['strokes']))
    return null;
  const marks: Record<string, CellMark> = {};
  for (const [cell, mark] of Object.entries(value['marks'])) {
    // « grey » : ancienne marque « grisée », devenue « vide » (stries).
    const current = mark === 'grey' ? 'empty' : mark;
    if (
      parseCell(cell) === null ||
      typeof current !== 'string' ||
      !MARKS.includes(current as CellMark)
    ) {
      return null;
    }
    marks[cell] = current as CellMark;
  }
  if (value['strokes'].length > MAX_STROKES) return null;
  const strokes = value['strokes'].map(parseStroke);
  if (strokes.some((stroke) => stroke === null)) return null;
  return { marks, strokes: strokes as Stroke[] };
}

/** Lit une sauvegarde déjà décodée du JSON. Renvoie null si elle n'est pas entièrement valide. */
export function parseSave(raw: unknown): SaveData | null {
  if (!isRecord(raw) || raw['version'] !== SAVE_VERSION) return null;
  const session = parseSnapshot(raw['session']);
  const solution = parseSolution(raw['solution']);
  const notes = parseNotes(raw['notes']);
  const savedAt = raw['savedAt'];
  if (session === null || solution === null || notes === null || !isFiniteNumber(savedAt)) {
    return null;
  }
  // Absent des anciennes sauvegardes : les confirmations restent alors actives.
  const skipConfirm = raw['skipConfirm'] === true;
  return { version: SAVE_VERSION, savedAt, session, solution, notes, skipConfirm };
}
